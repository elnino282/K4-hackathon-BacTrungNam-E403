import asyncio
import json
import logging
import os
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List

from app.schemas.note import (
    AINoteRequest,
    AINoteResponse,
    NoteSelectionInput,
)
from app.services.evidence_service import normalize_evidence_text
from app.services.pdf_service import get_extracted_data
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    generate_content,
    get_gemini_configuration,
)


logger = logging.getLogger("uvicorn")

NOTE_SYSTEM_PROMPT = """
Bạn là VLearn AI Note, công cụ biến đúng những vùng học viên chủ động khoanh
trên slide thành một ghi chú học tập ngắn, dễ tra cứu.

Quy tắc:
1. Chỉ tập trung vào các <selection>; page_context chỉ dùng để hiểu ngữ cảnh.
2. Không đưa phần ngoài vùng khoanh thành ý chính.
3. Gộp các vùng liên quan nhưng không làm mất khác biệt giữa các trang.
4. Sửa lỗi ngắt dòng/OCR hiển nhiên như "work- flow" thành "workflow", nhưng
   không được thay đổi số liệu hoặc ý nghĩa.
5. title phải gọi tên khái niệm hoặc quyết định chính; không đặt kiểu chung chung
   như "Ghi chú trang 22".
6. summary gồm 1-2 câu, tối đa 60 từ, trả lời "điều quan trọng cần hiểu là gì?".
   Phải diễn giải và tái cấu trúc, không chép lại nguyên khối selected_text.
7. key_takeaways có 2-4 ý khác nhau, mỗi ý tối đa 25 từ. Không lặp summary,
   không lặp nhau, giữ nguyên số liệu và thuật ngữ quan trọng.
8. Nếu vùng khoanh là bảng so sánh hoặc cây quyết định, chuyển thành các quy tắc
   "khi nào chọn gì" thay vì đọc lại từng ô theo thứ tự OCR.
9. example là ví dụ minh họa do AI tạo để giúp hiểu; không giả vờ ví dụ có
   trong slide. Nếu không thể tạo ví dụ an toàn, trả null.
10. misconception nêu một điểm dễ hiểu sai dựa trên chính nội dung đã khoanh;
   nếu không có thì trả null.
11. Nếu đầu vào có <must_preserve_terms>, giữ nguyên từng thuật ngữ này ít nhất
   một lần trong title, summary hoặc key_takeaways; không dịch hoặc đổi nhãn.
12. Không dùng Markdown, không tạo bullet rỗng và không thêm chữ ngoài JSON.

Schema:
{
  "title": "Tên ghi chú",
  "summary": "Giải thích ngắn",
  "key_takeaways": ["Ý 1", "Ý 2"],
  "example": "Ví dụ minh họa do AI tạo hoặc null",
  "misconception": "Điểm dễ hiểu sai hoặc null"
}
""".strip()


NOTE_COMPLETE_MODE_PROMPT = """
CHẾ ĐỘ HIỆN TẠI: GHI ĐỦ Ý.
Các quy tắc dưới đây thay thế giới hạn độ dài ở quy tắc 6-8:
- Mục tiêu là bảo toàn toàn bộ ý có nghĩa trong mọi vùng khoanh, không phải rút gọn tối đa.
- summary chỉ đóng vai trò câu dẫn 1-3 câu, tối đa 100 từ.
- key_takeaways gồm 2-10 ý. Tách riêng từng định nghĩa, điều kiện, bước, so sánh,
  cảnh báo, ngoại lệ và kết luận; mỗi ý tối đa 45 từ.
- Mỗi selection phải xuất hiện trong ít nhất một ý. Không được ưu tiên selection đầu rồi bỏ
  các selection sau.
- Giữ nguyên mọi con số, phần trăm, nhãn và thuật ngữ quan trọng. Được sửa OCR/ngắt dòng
  và sắp xếp lại, nhưng không được làm mất quan hệ như nguyên nhân-kết quả hay khi-thì.
- Không dán nguyên cả khối selected_text vào summary. Hãy chia thành các ý độc lập, dễ tra cứu.
""".strip()


def _note_system_prompt(mode: str) -> str:
    if mode == "complete":
        return NOTE_SYSTEM_PROMPT + "\n\n" + NOTE_COMPLETE_MODE_PROMPT
    return NOTE_SYSTEM_PROMPT + "\n\nCHẾ ĐỘ HIỆN TẠI: TÓM TẮT NGẮN."


class NoteScopeError(ValueError):
    """Vùng khoanh có cấu trúc hợp lệ nhưng không thuộc tài liệu."""


class NoteQualityError(ValueError):
    """AI Note đúng schema nhưng chưa tạo ra giá trị hơn nguồn đã khoanh."""


PRESERVE_ACTION_TERMS = {
    "action",
    "deploy",
    "draft",
    "suggest",
}


def _extract_must_preserve_terms(source_excerpts: List[str]) -> List[str]:
    """Keep short labels and decision terms that lose meaning when translated."""
    terms: List[str] = []
    total_words = sum(len(source.split()) for source in source_excerpts)

    def add(term: str) -> None:
        cleaned = re.sub(r"\s+", " ", term).strip(" \t\r\n.,;()[]")
        if not cleaned or len(cleaned) > 60:
            return
        normalized = normalize_evidence_text(cleaned)
        if normalized and all(
            normalize_evidence_text(existing) != normalized
            for existing in terms
        ):
            terms.append(cleaned)

    for source in source_excerpts:
        prefix = source.split(":", 1)[0].strip()
        if (
            prefix
            and prefix.isascii()
            and 1 <= len(prefix.split()) <= 5
        ):
            add(prefix)

        for phrase in re.findall(
            r"\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){1,3}\b",
            source,
        ):
            add(phrase)
        for acronym in re.findall(r"\b[A-Z]{2,}[A-Z0-9]*\b", source):
            add(acronym)

        if total_words <= 45:
            for token in re.findall(r"\b[A-Za-z][A-Za-z0-9_-]*\b", source):
                if token.casefold() in PRESERVE_ACTION_TERMS:
                    add(token)

    return terms[:12]


def _normalized_note_text(value: str) -> str:
    return " ".join(normalize_evidence_text(value).split())


def _note_texts_are_similar(left: str, right: str) -> bool:
    normalized_left = _normalized_note_text(left)
    normalized_right = _normalized_note_text(right)
    if not normalized_left or not normalized_right:
        return False
    if normalized_left == normalized_right:
        return True
    shorter, longer = sorted(
        (normalized_left, normalized_right),
        key=len,
    )
    if len(shorter) >= 60 and shorter in longer:
        return True
    return SequenceMatcher(
        None,
        normalized_left,
        normalized_right,
    ).ratio() >= 0.88


def _copies_long_source_phrase(candidate: str, source: str) -> bool:
    candidate_words = _normalized_note_text(candidate).split()
    source_words = _normalized_note_text(source).split()
    if len(candidate_words) < 18 or len(source_words) < 18:
        return False
    match = SequenceMatcher(
        None,
        candidate_words,
        source_words,
    ).find_longest_match()
    return match.size >= 12 and match.size / len(candidate_words) >= 0.55


def _extract_note_json(
    raw_content: str,
    mode: str = "summary",
) -> Dict[str, Any]:
    cleaned = raw_content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("AI không trả về JSON ghi chú")
        payload = json.loads(match.group(0))

    title = payload.get("title")
    summary = payload.get("summary")
    takeaways = payload.get("key_takeaways")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Ghi chú thiếu title")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Ghi chú thiếu summary")
    if not isinstance(takeaways, list):
        raise ValueError("Ghi chú thiếu key_takeaways")
    normalized_takeaways: List[str] = []
    for item in takeaways:
        takeaway = str(item).strip()
        if not takeaway or _note_texts_are_similar(takeaway, summary):
            continue
        if any(
            _note_texts_are_similar(takeaway, existing)
            for existing in normalized_takeaways
        ):
            continue
        normalized_takeaways.append(takeaway)
        max_takeaways = 10 if mode == "complete" else 4
        if len(normalized_takeaways) >= max_takeaways:
            break
    if not normalized_takeaways:
        raise NoteQualityError("Các ý cần nhớ đang rỗng hoặc lặp phần tóm tắt")

    example = payload.get("example")
    misconception = payload.get("misconception")
    return {
        "title": title.strip()[:120],
        "summary": summary.strip()[:1200],
        "key_takeaways": normalized_takeaways,
        "example": (
            example.strip()[:1200]
            if isinstance(example, str) and example.strip()
            else None
        ),
        "misconception": (
            misconception.strip()[:1200]
            if isinstance(misconception, str) and misconception.strip()
            else None
        ),
    }


def _validate_note_quality(
    note: Dict[str, Any],
    source_excerpts: List[str],
    must_preserve_terms: List[str],
    mode: str = "summary",
) -> None:
    if re.match(
        r"^(?:ghi chú|note)(?:\s+(?:trang|page))?\b",
        note["title"],
        flags=re.IGNORECASE,
    ):
        raise NoteQualityError("Tiêu đề còn chung chung")
    max_summary_words = 120 if mode == "complete" else 80
    if len(note["summary"].split()) > max_summary_words:
        raise NoteQualityError("Phần tóm tắt quá dài")
    if any(
        _copies_long_source_phrase(note["summary"], source)
        for source in source_excerpts
    ):
        raise NoteQualityError("Phần tóm tắt đang chép nguyên văn nguồn")
    for takeaway in note["key_takeaways"]:
        max_takeaway_words = 45 if mode == "complete" else 35
        if len(takeaway.split()) > max_takeaway_words:
            raise NoteQualityError("Một ý cần nhớ quá dài")
        if mode == "summary" and any(
            _copies_long_source_phrase(takeaway, source)
            for source in source_excerpts
        ):
            raise NoteQualityError("Ý cần nhớ đang chép nguyên văn nguồn")
    if mode == "complete":
        minimum_takeaways = min(4, max(2, len(source_excerpts)))
        if len(note["key_takeaways"]) < minimum_takeaways:
            raise NoteQualityError(
                "Chế độ Ghi đủ ý chưa tách đủ các ý trong vùng khoanh"
            )
    note_core = " ".join(
        [
            note["title"],
            note["summary"],
            *note["key_takeaways"],
        ]
    )
    normalized_core = normalize_evidence_text(note_core)
    missing_terms = [
        term
        for term in must_preserve_terms
        if normalize_evidence_text(term) not in normalized_core
    ]
    if missing_terms:
        raise NoteQualityError(
            "Thiếu thuật ngữ cần giữ nguyên: " + ", ".join(missing_terms)
        )

    if mode == "complete":
        source_numbers = list(dict.fromkeys(
            number
            for source in source_excerpts
            for number in re.findall(r"(?<!\w)\d+(?:[.,]\d+)*(?:%|\b)", source)
        ))
        missing_numbers = [
            number
            for number in source_numbers
            if number not in note_core
        ]
        if missing_numbers:
            raise NoteQualityError(
                "Chế độ Ghi đủ ý làm mất số liệu: " + ", ".join(missing_numbers)
            )


def _selection_is_in_page(
    selection: NoteSelectionInput,
    page: Dict[str, Any],
) -> bool:
    if not selection.text.strip():
        return False
    selected = normalize_evidence_text(selection.text)
    page_text = normalize_evidence_text(
        page.get("clean_text") or page.get("text") or ""
    )
    if selected in page_text:
        return True
    selected_tokens = set(selected.split())
    if not selected_tokens:
        return False
    page_tokens = set(page_text.split())
    return len(selected_tokens & page_tokens) / len(selected_tokens) >= 0.75


def _fallback_note(
    req: AINoteRequest,
    page_lookup: Dict[int, Dict[str, Any]],
    verified_count: int,
    notice: str,
) -> AINoteResponse:
    pages = sorted({selection.page for selection in req.selections})
    excerpts = [
        selection.text.strip()
        for selection in req.selections
        if selection.text.strip()
    ]
    title = (
        f"Saved selection · Page {', '.join(map(str, pages))}"
        if req.language == "EN"
        else f"Vùng đã lưu · Trang {', '.join(map(str, pages))}"
    )
    summary = (
        (
            f"Saved {len(req.selections)} selected region(s). "
            "AI has not converted them into a study note yet; please retry."
        )
        if req.language == "EN"
        else (
            f"Đã lưu {len(req.selections)} vùng bạn khoanh. "
            "AI chưa chuyển chúng thành ghi chú học tập; hãy thử tạo lại."
        )
    )
    return AINoteResponse(
        title=title,
        summary=summary,
        key_takeaways=[],
        example=None,
        misconception=None,
        source_pages=pages,
        source_excerpts=excerpts,
        verified_selections=verified_count,
        provider="local",
        status="fallback",
        mode=req.mode,
        notice=notice,
    )


async def generate_ai_note(req: AINoteRequest) -> AINoteResponse:
    data = get_extracted_data(req.doc_id)
    pages = data.get("pages", [])
    page_lookup = {
        page["page_number"]: page
        for page in pages
    }
    missing_pages = sorted({
        selection.page
        for selection in req.selections
        if selection.page not in page_lookup
    })
    if missing_pages:
        raise NoteScopeError(
            "Các trang nằm ngoài tài liệu: "
            + ", ".join(map(str, missing_pages))
        )

    verified_count = sum(
        _selection_is_in_page(selection, page_lookup[selection.page])
        for selection in req.selections
    )
    source_pages = sorted({
        selection.page
        for selection in req.selections
    })
    source_excerpts = [
        selection.text.strip()
        for selection in req.selections
        if selection.text.strip()
    ]
    must_preserve_terms = _extract_must_preserve_terms(source_excerpts)

    try:
        get_gemini_configuration()
    except GeminiConfigurationError:
        return _fallback_note(
            req,
            page_lookup,
            verified_count,
            "Chưa kết nối dịch vụ AI; vùng khoanh vẫn được lưu.",
        )

    text_blocks: List[str] = []
    content: List[Dict[str, Any]] = []
    for index, selection in enumerate(req.selections, start=1):
        page = page_lookup[selection.page]
        page_text = page.get("clean_text") or page.get("text") or ""
        page_context = page_text[:2500]
        block = f"""
<selection id="{index}" page="{selection.page}"
  x="{selection.x:.4f}" y="{selection.y:.4f}"
  width="{selection.width:.4f}" height="{selection.height:.4f}">
<selected_text>
{selection.text.strip() or "(Vùng hình ảnh, không có chữ trích xuất)"}
</selected_text>
<page_context>
{page_context}
</page_context>
</selection>
""".strip()
        text_blocks.append(block)
        if selection.image_data_url:
            content.extend(
                [
                    {
                        "type": "text",
                        "text": f"Ảnh crop của selection {index}:",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": selection.image_data_url,
                            "detail": "high",
                        },
                    },
                ]
            )

    content.insert(
        0,
        {
            "type": "text",
            "text": (
                f"Ngôn ngữ phản hồi: {req.language}\n"
                f"Chế độ ghi chú: {req.mode}\n\n"
                + "<must_preserve_terms>"
                + json.dumps(must_preserve_terms, ensure_ascii=False)
                + "</must_preserve_terms>\n\n"
                + "\n\n".join(text_blocks)
            ),
        },
    )
    try:
        messages: List[Dict[str, Any]] = [
            {"role": "user", "content": content}
        ]
        parsed: Dict[str, Any] | None = None
        for attempt in range(2):
            raw_content = await generate_content(
                system_instruction=_note_system_prompt(req.mode),
                messages=messages,
                temperature=0.15,
                response_mime_type="application/json",
            )
            try:
                candidate = _extract_note_json(raw_content, req.mode)
                _validate_note_quality(
                    candidate,
                    source_excerpts,
                    must_preserve_terms,
                    req.mode,
                )
                parsed = candidate
                break
            except ValueError as quality_error:
                if attempt > 0:
                    raise
                logger.info(
                    "AI Note chưa đạt chất lượng; yêu cầu model tự sửa một lượt."
                )
                messages.extend(
                    [
                        {
                            "role": "assistant",
                            "content": raw_content[:6000],
                        },
                        {
                            "role": "user",
                            "content": (
                                "Kết quả trên chưa đạt vì: "
                                f"{quality_error}. Viết lại toàn bộ JSON: "
                                + (
                                    "tách và giữ đủ mọi ý từ tất cả selection; "
                                    "không bỏ điều kiện, con số hoặc kết luận. "
                                    if req.mode == "complete"
                                    else "tóm lược thay vì copy, bỏ mọi ý trùng. "
                                )
                                + "Đặt tiêu đề theo khái niệm chính. Phải giữ "
                                "nguyên từng thuật ngữ trong "
                                f"must_preserve_terms: {must_preserve_terms}."
                            ),
                        },
                    ]
                )
        if parsed is None:
            raise NoteQualityError("AI không tạo được ghi chú đạt chất lượng")
        return AINoteResponse(
            **parsed,
            source_pages=source_pages,
            source_excerpts=source_excerpts,
            verified_selections=verified_count,
            provider="gemini",
            status="generated",
            mode=req.mode,
            notice=None,
        )
    except GeminiProviderError:
        logger.warning("Gemini AI Note tạm thời không khả dụng.")
        return _fallback_note(
            req,
            page_lookup,
            verified_count,
            "Không gọi được Gemini; vùng khoanh vẫn được lưu để bạn thử lại.",
        )
    except Exception:
        logger.exception("Lỗi gọi AI Note")
        return _fallback_note(
            req,
            page_lookup,
            verified_count,
            "AI Note đang tạm thời không khả dụng; vùng khoanh vẫn được lưu.",
        )

