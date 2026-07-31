import asyncio
import json
import logging
import os
import re
from typing import Any, Dict
from uuid import uuid4

from app.schemas.study import (
    AssessmentStartRequest,
    AssessmentStartResponse,
    QuizEvaluateRequest,
    QuizEvaluateResponse,
    QuizGenerateRequest,
    QuizGenerateResponse,
)
from app.services.evidence_service import normalize_evidence_text, verify_key_points
from app.services.pdf_service import get_extracted_data
from app.services.summary_service import (
    DEFAULT_AI_BASE_URL,
    DEFAULT_AI_MODEL,
    _post_chat_completion,
)


logger = logging.getLogger("uvicorn")

QUIZ_SYSTEM_PROMPT = """
Bạn là VLearn Checkpoint. Hãy tạo đúng một câu hỏi ngắn để kiểm tra người học
thực sự hiểu ý được cung cấp, không chỉ nhớ mặt chữ.

- Chỉ dùng claim và evidence.
- Không để lộ đáp án trong câu hỏi.
- Ưu tiên câu hỏi "tại sao", "phân biệt" hoặc áp dụng rất ngắn.
- hint chỉ gợi hướng suy nghĩ, không đưa đáp án.
- Trả JSON: {"question": "...", "hint": "... hoặc null"}.
""".strip()

EVALUATE_SYSTEM_PROMPT = """
Bạn là VLearn Checkpoint, chấm câu trả lời của người học theo đúng evidence.

- correct: đúng đủ ý cốt lõi; không đòi đúng nguyên văn.
- partial: đúng một phần nhưng thiếu ý quan trọng.
- incorrect: sai bản chất, trái nguồn hoặc không trả lời.
- feedback nói rõ phần đã đúng và phần còn thiếu, tối đa 3 câu.
- next_step là một hành động ngắn; không đưa thêm kiến thức ngoài evidence.
- Trả JSON:
  {"verdict":"correct|partial|incorrect","feedback":"...","next_step":"..."}.
""".strip()

ASSESSMENT_SYSTEM_PROMPT = """
Bạn là VLearn Learning Measurement. Hãy tạo hai câu hỏi ngắn để đo mức hiểu
trước và sau khi người học xem một Study Card.

- Chỉ dùng claim và evidence đã cung cấp.
- Hai câu phải kiểm tra cùng một ý cốt lõi, có độ khó tương đương nhưng khác
  cách diễn đạt hoặc tình huống.
- Không chép claim/evidence vào câu hỏi và không để lộ đáp án.
- pre_question ưu tiên giải thích hoặc phân biệt.
- post_question ưu tiên áp dụng ngắn hoặc diễn đạt lại trong tình huống mới.
- Mỗi câu chỉ hỏi một việc và có thể trả lời trong 1-3 câu.
- Trả JSON:
  {"pre_question":"...","post_question":"..."}.
""".strip()

SCORE_BY_VERDICT = {
    "incorrect": 0,
    "partial": 50,
    "correct": 100,
}


class StudyScopeError(ValueError):
    """Nguồn Study Card không khớp tài liệu."""


def _parse_json(raw_content: str) -> Dict[str, Any]:
    cleaned = raw_content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("AI không trả về JSON")
        return json.loads(match.group(0))


def _validated_page(doc_id: str, source) -> Dict[str, Any]:
    data = get_extracted_data(doc_id)
    page = next(
        (
            page
            for page in data.get("pages", [])
            if page["page_number"] == source.page
        ),
        None,
    )
    if page is None:
        raise StudyScopeError(f"Trang {source.page} nằm ngoài tài liệu")
    verified, rejected = verify_key_points(
        [
            {
                "claim": source.claim,
                "page": source.page,
                "evidence_quote": source.evidence_quote,
            }
        ],
        [page],
    )
    if not verified:
        reason = rejected[0]["reason"] if rejected else "unknown"
        raise StudyScopeError(
            f"Nguồn Study Card không vượt kiểm tra PDF: {reason}"
        )
    return page


def _local_quiz(req: QuizGenerateRequest, notice: str) -> QuizGenerateResponse:
    question = (
        f"Hãy giải thích bằng lời của bạn: {req.source.claim}"
        if req.language != "EN"
        else f"Explain in your own words: {req.source.claim}"
    )
    return QuizGenerateResponse(
        question=question,
        hint=(
            f"Xem lại ý chính ở trang {req.source.page}."
            if req.language != "EN"
            else f"Review the key idea on page {req.source.page}."
        ),
        source_page=req.source.page,
        provider="local",
        status="fallback",
        notice=notice,
    )


def _local_assessment(
    req: AssessmentStartRequest,
    notice: str,
) -> AssessmentStartResponse:
    if req.language == "EN":
        pre_question = (
            f"Without reopening page {req.source.page}, what is the core idea "
            "you remember from this part?"
        )
        post_question = (
            "After reviewing the Study Card, explain the same core idea in "
            "your own words and give one brief implication."
        )
    else:
        pre_question = (
            f"Không mở lại trang {req.source.page}, bạn nhớ ý cốt lõi nào "
            "trong phần này?"
        )
        post_question = (
            "Sau khi xem Study Card, hãy diễn đạt lại đúng ý cốt lõi bằng lời "
            "của bạn và nêu một hệ quả ngắn."
        )
    return AssessmentStartResponse(
        assessment_id=uuid4().hex,
        pre_question=pre_question,
        post_question=post_question,
        source_page=req.source.page,
        provider="local",
        status="fallback",
        notice=notice,
    )


async def generate_assessment(
    req: AssessmentStartRequest,
) -> AssessmentStartResponse:
    _validated_page(req.doc_id, req.source)
    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        return _local_assessment(req, "AI tạm thời không khả dụng.")

    base_url = os.getenv("AI_BASE_URL", DEFAULT_AI_BASE_URL).rstrip("/")
    model = os.getenv("AI_MODEL", DEFAULT_AI_MODEL)
    user_text = f"""
Ngôn ngữ: {req.language}
Trang: {req.source.page}
<claim>{req.source.claim}</claim>
<evidence>{req.source.evidence_quote}</evidence>
""".strip()
    try:
        result = await asyncio.to_thread(
            _post_chat_completion,
            f"{base_url}/chat/completions",
            api_key,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": ASSESSMENT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_text},
                ],
                "temperature": 0.2,
            },
        )
        choices = result.get("choices") or []
        raw = (
            choices[0].get("message", {}).get("content", "")
            if choices
            else ""
        )
        parsed = _parse_json(raw)
        pre_question = parsed.get("pre_question")
        post_question = parsed.get("post_question")
        if not isinstance(pre_question, str) or not pre_question.strip():
            raise ValueError("Assessment thiếu pre_question")
        if not isinstance(post_question, str) or not post_question.strip():
            raise ValueError("Assessment thiếu post_question")
        normalized_pre = normalize_evidence_text(pre_question)
        normalized_post = normalize_evidence_text(post_question)
        if normalized_pre == normalized_post:
            raise ValueError("Hai câu assessment không độc lập")
        return AssessmentStartResponse(
            assessment_id=uuid4().hex,
            pre_question=pre_question.strip()[:1500],
            post_question=post_question.strip()[:1500],
            source_page=req.source.page,
            provider="xah",
            status="generated",
        )
    except Exception:
        logger.exception("Lỗi tạo assessment")
        return _local_assessment(
            req,
            "Không thể tạo cặp câu hỏi bằng AI; dùng câu hỏi dự phòng.",
        )


async def generate_quiz(req: QuizGenerateRequest) -> QuizGenerateResponse:
    _validated_page(req.doc_id, req.source)
    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        return _local_quiz(req, "AI tạm thời không khả dụng.")

    base_url = os.getenv("AI_BASE_URL", DEFAULT_AI_BASE_URL).rstrip("/")
    model = os.getenv("AI_MODEL", DEFAULT_AI_MODEL)
    user_text = f"""
Ngôn ngữ: {req.language}
Trang: {req.source.page}
<claim>{req.source.claim}</claim>
<evidence>{req.source.evidence_quote}</evidence>
""".strip()
    try:
        result = await asyncio.to_thread(
            _post_chat_completion,
            f"{base_url}/chat/completions",
            api_key,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
                    {"role": "user", "content": user_text},
                ],
                "temperature": 0.2,
            },
        )
        choices = result.get("choices") or []
        raw = (
            choices[0].get("message", {}).get("content", "")
            if choices
            else ""
        )
        parsed = _parse_json(raw)
        question = parsed.get("question")
        hint = parsed.get("hint")
        if not isinstance(question, str) or not question.strip():
            raise ValueError("Quiz thiếu question")
        return QuizGenerateResponse(
            question=question.strip()[:1500],
            hint=(
                hint.strip()[:800]
                if isinstance(hint, str) and hint.strip()
                else None
            ),
            source_page=req.source.page,
            provider="xah",
            status="generated",
        )
    except Exception:
        logger.exception("Lỗi tạo quiz")
        return _local_quiz(req, "Không thể tạo quiz bằng AI; dùng câu hỏi dự phòng.")


def _local_evaluation(
    req: QuizEvaluateRequest,
    notice: str,
) -> QuizEvaluateResponse:
    expected_tokens = {
        token
        for token in normalize_evidence_text(
            req.source.claim + " " + req.source.evidence_quote
        ).split()
        if len(token) >= 4
    }
    answer_tokens = set(normalize_evidence_text(req.answer).split())
    overlap = (
        len(expected_tokens & answer_tokens) / len(expected_tokens)
        if expected_tokens
        else 0
    )
    if overlap >= 0.35:
        verdict = "correct"
    elif overlap >= 0.15:
        verdict = "partial"
    else:
        verdict = "incorrect"
    labels = {
        "correct": "Bạn đã nêu được phần lớn ý cốt lõi.",
        "partial": "Bạn đã đúng một phần nhưng còn thiếu ý quan trọng.",
        "incorrect": "Câu trả lời chưa khớp với ý cốt lõi trong nguồn.",
    }
    return QuizEvaluateResponse(
        verdict=verdict,
        score=SCORE_BY_VERDICT[verdict],
        feedback=(
            labels[verdict]
            if req.language != "EN"
            else {
                "correct": "You covered most of the core idea.",
                "partial": "You are partly correct but missed an important idea.",
                "incorrect": "Your answer does not yet match the source.",
            }[verdict]
        ),
        next_step=(
            f"Mở lại nguồn trang {req.source.page} và đối chiếu."
            if req.language != "EN"
            else f"Open page {req.source.page} and compare with the source."
        ),
        source_page=req.source.page,
        provider="local",
        status="fallback",
        notice=notice,
    )


async def evaluate_quiz(
    req: QuizEvaluateRequest,
) -> QuizEvaluateResponse:
    _validated_page(req.doc_id, req.source)
    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        return _local_evaluation(req, "Đang dùng đánh giá từ khóa dự phòng.")

    base_url = os.getenv("AI_BASE_URL", DEFAULT_AI_BASE_URL).rstrip("/")
    model = os.getenv("AI_MODEL", DEFAULT_AI_MODEL)
    user_text = f"""
Ngôn ngữ: {req.language}
Trang: {req.source.page}
<question>{req.question}</question>
<student_answer>{req.answer}</student_answer>
<claim>{req.source.claim}</claim>
<evidence>{req.source.evidence_quote}</evidence>
""".strip()
    try:
        result = await asyncio.to_thread(
            _post_chat_completion,
            f"{base_url}/chat/completions",
            api_key,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": EVALUATE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_text},
                ],
                "temperature": 0.05,
            },
        )
        choices = result.get("choices") or []
        raw = (
            choices[0].get("message", {}).get("content", "")
            if choices
            else ""
        )
        parsed = _parse_json(raw)
        verdict = parsed.get("verdict")
        feedback = parsed.get("feedback")
        next_step = parsed.get("next_step")
        if verdict not in {"correct", "partial", "incorrect"}:
            raise ValueError("Kết quả chấm thiếu verdict")
        if not isinstance(feedback, str) or not feedback.strip():
            raise ValueError("Kết quả chấm thiếu feedback")
        if not isinstance(next_step, str) or not next_step.strip():
            raise ValueError("Kết quả chấm thiếu next_step")
        return QuizEvaluateResponse(
            verdict=verdict,
            score=SCORE_BY_VERDICT[verdict],
            feedback=feedback.strip()[:1500],
            next_step=next_step.strip()[:800],
            source_page=req.source.page,
            provider="xah",
            status="evaluated",
        )
    except Exception:
        logger.exception("Lỗi chấm quiz")
        return _local_evaluation(
            req,
            "Không thể chấm bằng AI; dùng đánh giá từ khóa dự phòng.",
        )
