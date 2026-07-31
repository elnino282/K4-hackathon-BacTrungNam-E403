import asyncio
import json
import logging
import os
import re
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
4. title ngắn; summary trả lời "những vùng này muốn nói gì?".
5. key_takeaways có 1-5 ý cụ thể, giữ nguyên số liệu và thuật ngữ quan trọng.
6. example là ví dụ minh họa do AI tạo để giúp hiểu; không giả vờ ví dụ có
   trong slide. Nếu không thể tạo ví dụ an toàn, trả null.
7. misconception nêu một điểm dễ hiểu sai dựa trên chính nội dung đã khoanh;
   nếu không có thì trả null.
8. Không dùng Markdown và không thêm chữ ngoài JSON.

Schema:
{
  "title": "Tên ghi chú",
  "summary": "Giải thích ngắn",
  "key_takeaways": ["Ý 1", "Ý 2"],
  "example": "Ví dụ minh họa do AI tạo hoặc null",
  "misconception": "Điểm dễ hiểu sai hoặc null"
}
""".strip()


class NoteScopeError(ValueError):
    """Vùng khoanh có cấu trúc hợp lệ nhưng không thuộc tài liệu."""


def _extract_note_json(raw_content: str) -> Dict[str, Any]:
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
    normalized_takeaways = [
        str(item).strip()
        for item in takeaways
        if str(item).strip()
    ][:5]
    if not normalized_takeaways:
        raise ValueError("Ghi chú không có ý cần nhớ")

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
    preview = " ".join(excerpts)[:1000]
    title = (
        f"Note from page {', '.join(map(str, pages))}"
        if req.language == "EN"
        else f"Ghi chú trang {', '.join(map(str, pages))}"
    )
    summary = (
        preview
        or (
            "The selected image region was saved, but AI is unavailable."
            if req.language == "EN"
            else "Đã lưu vùng ảnh được khoanh nhưng AI đang không khả dụng."
        )
    )
    return AINoteResponse(
        title=title,
        summary=summary,
        key_takeaways=excerpts[:5] or [summary],
        example=None,
        misconception=None,
        source_pages=pages,
        source_excerpts=excerpts,
        verified_selections=verified_count,
        provider="local",
        status="fallback",
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
        block = f"""
<selection id="{index}" page="{selection.page}"
  x="{selection.x:.4f}" y="{selection.y:.4f}"
  width="{selection.width:.4f}" height="{selection.height:.4f}">
<selected_text>
{selection.text.strip() or "(Vùng hình ảnh, không có chữ trích xuất)"}
</selected_text>
<page_context>
{page_text}
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
                f"Ngôn ngữ phản hồi: {req.language}\n\n"
                + "\n\n".join(text_blocks)
            ),
        },
    )
    try:
        raw_content = await generate_content(
            system_instruction=NOTE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            temperature=0.15,
            response_mime_type="application/json",
        )
        parsed = _extract_note_json(raw_content)
        return AINoteResponse(
            **parsed,
            source_pages=source_pages,
            source_excerpts=source_excerpts,
            verified_selections=verified_count,
            provider="gemini",
            status="generated",
            notice=None,
        )
    except Exception:
        logger.exception("Lỗi gọi AI Note")
        return _fallback_note(
            req,
            page_lookup,
            verified_count,
            "AI Note đang tạm thời không khả dụng; vùng khoanh vẫn được lưu.",
        )

