import asyncio
import base64
import logging
import os
from typing import Any, Dict, List, Optional

from app.schemas.tutor import TutorChatRequest, TutorChatResponse
from app.services.pdf_service import get_extracted_data, render_pdf_page
from app.services.summary_service import (
    DEFAULT_AI_BASE_URL,
    DEFAULT_AI_MODEL,
    _post_chat_completion,
)


logger = logging.getLogger("uvicorn")

TUTOR_SYSTEM_PROMPT = """
Bạn là VLearn AI Tutor, trợ lý học tập dựa trên đúng nội dung slide.

Quy tắc:
1. Trả lời trực tiếp câu hỏi của học viên bằng ngôn ngữ được yêu cầu.
2. Chỉ dùng nội dung slide, đoạn được bôi đen và ảnh trang được cung cấp.
3. Chữ trích xuất là nguồn chính xác cho thuật ngữ, số liệu và chính tả; ảnh
   dùng để hiểu bố cục, bảng, cột và quan hệ giữa các thành phần.
4. Không bịa tác giả, mục tiêu, ví dụ hoặc kiến thức không xuất hiện trong nguồn.
5. Nếu đoạn bôi đen được cung cấp, giải thích đúng đoạn đó trong ngữ cảnh trang.
6. Nếu câu hỏi rộng như "slide nói về điều gì", nêu ý chính và 2-4 điểm cụ thể.
7. Trích dẫn số trang trong câu trả lời. Nếu nguồn chưa đủ, nói rõ giới hạn.
8. Trả lời ngắn gọn, dễ học; có thể dùng Markdown nhưng không mở đầu dài dòng.
""".strip()


def _find_page(
    pages: List[Dict[str, Any]],
    page_number: int,
) -> Optional[Dict[str, Any]]:
    return next(
        (page for page in pages if page["page_number"] == page_number),
        None,
    )


def _fallback_response(
    req: TutorChatRequest,
    page: Optional[Dict[str, Any]],
    sources: List[str],
    notice: str,
) -> TutorChatResponse:
    if page:
        content_lines = (page.get("clean_text") or page.get("text") or "").splitlines()
        preview = "\n".join(f"- {line}" for line in content_lines[:5])
        if req.language == "EN":
            reply = (
                f"AI is temporarily unavailable. Extracted content from page "
                f"{req.page_context}:\n{preview}"
            )
        else:
            reply = (
                f"AI đang tạm thời không khả dụng. Nội dung đã trích xuất từ "
                f"trang {req.page_context}:\n{preview}"
            )
    else:
        reply = (
            "AI đang tạm thời không khả dụng và không tìm thấy trang được yêu cầu."
            if req.language != "EN"
            else "AI is temporarily unavailable and the requested page was not found."
        )

    return TutorChatResponse(
        reply=reply,
        provider="mock",
        sources=sources,
        notice=notice,
    )


async def chat_with_tutor(req: TutorChatRequest) -> TutorChatResponse:
    """Trả lời dựa trên text parse và ảnh của đúng trang slide."""
    try:
        extracted = get_extracted_data("lesson-01")
        page = _find_page(extracted.get("pages", []), req.page_context)
    except Exception as error:
        logger.exception("Không đọc được dữ liệu slide")
        page = None
        extracted_error = str(error)
    else:
        extracted_error = ""

    slide_title = (
        page.get("title")
        if page
        else req.slide_title or f"Trang {req.page_context}"
    )
    sources = [f"Slide: {slide_title} (Trang {req.page_context})"]
    if req.selected_text:
        sources.append(f'Đoạn chọn: "{req.selected_text[:80]}"')

    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        return _fallback_response(
            req,
            page,
            sources,
            "[MOCK] Chưa cấu hình XAH_API_KEY hoặc AI_API_KEY.",
        )
    if not page:
        return _fallback_response(
            req,
            page,
            sources,
            f"[MOCK] Không đọc được trang: {extracted_error}",
        )

    clean_text = page.get("clean_text") or page.get("text", "")
    layout_text = page.get("layout_text", "")
    selected_context = req.selected_text or "(Không có đoạn bôi đen)"
    user_text = f"""
Ngôn ngữ phản hồi: {req.language}
Trang hiện tại: {req.page_context}
Tiêu đề: {slide_title}

<extracted_text>
{clean_text}
</extracted_text>

<spatial_layout>
{layout_text}
</spatial_layout>

<selected_text>
{selected_context}
</selected_text>

<student_question>
{req.message}
</student_question>
""".strip()

    content: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
    try:
        image_path = render_pdf_page("lesson-01", req.page_context)
        image_base64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{image_base64}",
                    "detail": "high",
                },
            }
        )
    except Exception as error:
        logger.warning("Không render được ảnh cho Tutor: %s", error)

    base_url = os.getenv("AI_BASE_URL", DEFAULT_AI_BASE_URL).rstrip("/")
    model = os.getenv("AI_MODEL", DEFAULT_AI_MODEL)
    try:
        result = await asyncio.to_thread(
            _post_chat_completion,
            f"{base_url}/chat/completions",
            api_key,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": TUTOR_SYSTEM_PROMPT},
                    {"role": "user", "content": content},
                ],
                "temperature": 0.2,
            },
        )
        choices = result.get("choices") or []
        reply = (
            choices[0].get("message", {}).get("content", "")
            if choices
            else ""
        )
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError("XAH không trả về nội dung")

        return TutorChatResponse(
            reply=reply.strip(),
            provider="xah",
            sources=sources,
            notice=None,
        )
    except Exception as error:
        logger.exception("Lỗi gọi XAH Tutor")
        return _fallback_response(
            req,
            page,
            sources,
            f"[MOCK] XAH lỗi: {error}",
        )
