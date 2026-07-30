import base64
import asyncio
import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from app.schemas.summary import SummaryRequest, SummaryResponse
from app.services.pdf_service import get_extracted_data, render_pdf_page


logger = logging.getLogger("uvicorn")

DEFAULT_AI_BASE_URL = "https://api.xah.io/v1"
DEFAULT_AI_MODEL = "vuduythanh2023/gemini-3.5-flash"
MAX_VISION_PAGES = 3

SUMMARY_SYSTEM_PROMPT = """
Bạn là VLearn Slide2Study, bộ xử lý tài liệu học tập dựa trên bằng chứng.

Mục tiêu học tập:
- Giúp học viên trong vài giây trả lời được hai câu: "Phần này nói về điều gì?"
  và "Điều gì cần nhớ để học tiếp?".
- Tóm tắt đúng phạm vi được yêu cầu, không biến kết quả thành bài giảng mở rộng.

Cách đọc nguồn:
- Dùng ẢNH để xác định tiêu đề, bố cục, hàng/cột, nhãn, mũi tên và quan hệ
  giữa các thành phần.
- Dùng CHỮ TRÍCH XUẤT để giữ chính xác câu chữ, số liệu, thuật ngữ và dấu
  tiếng Việt.
- Khi ảnh và chữ trích xuất có vẻ mâu thuẫn, chỉ nêu điều có thể xác nhận;
  không tự ghép số liệu với nhãn nếu quan hệ chưa rõ.

Quy tắc bắt buộc:
1. Chỉ sử dụng thông tin xuất hiện trong dữ liệu được cung cấp.
2. Không thêm kiến thức nền, nguyên nhân, ví dụ, định nghĩa hoặc kết luận không
   có trong nguồn.
3. Giữ nguyên tên riêng, thuật ngữ và từ viết tắt. Không tự khai triển hoặc dịch
   từ viết tắt nếu slide không giải thích.
4. Không biến ví dụ thành kết luận chung. Không đổi mức độ chắc chắn của slide.
5. Gộp ý trùng lặp; bỏ chân trang, số thứ tự điều hướng và chi tiết trang trí.
6. Nếu nguồn không đủ rõ, nêu giới hạn ngắn gọn thay vì tự điền.
7. Mỗi ý quan trọng phải cụ thể và kết thúc bằng trích dẫn "— Trang N". Chỉ
   được trích dẫn các trang có trong phạm vi.
8. Với một trang: summary dài 1-2 câu và có 3-5 key_points. Với nhiều trang:
   summary dài 2-4 câu và có tối đa 7 key_points, nhóm theo chủ đề thay vì kể
   lần lượt từng trang.
9. Mỗi key_point tối đa khoảng 35 từ, không lặp lại nguyên văn summary.
10. Phần giải thích dùng ngôn ngữ người dùng yêu cầu.

Chỉ trả về một JSON hợp lệ, không dùng Markdown và không thêm chữ ngoài JSON:
{
  "summary": "Bản tóm tắt đúng độ dài theo phạm vi",
  "key_points": [
    "Ý cụ thể — Trang N",
    "Ý cụ thể — Trang M"
  ]
}
""".strip()


def _select_pages(
    pages: List[Dict[str, Any]],
    req: SummaryRequest,
) -> tuple[List[Dict[str, Any]], str]:
    total_pages = len(pages)
    if req.current_page is not None:
        selected = [
            page for page in pages if page["page_number"] == req.current_page
        ]
        scope = f"Trang {req.current_page}"
    elif req.start_page is not None and req.end_page is not None:
        selected = [
            page
            for page in pages
            if req.start_page <= page["page_number"] <= req.end_page
        ]
        scope = f"Khoảng trang {req.start_page} - {req.end_page}"
    else:
        selected = pages
        scope = f"Toàn bộ slide ({total_pages} trang)"

    return selected, scope


def _page_context(page: Dict[str, Any], include_layout: bool) -> str:
    page_number = page["page_number"]
    title = page.get("title", f"Trang {page_number}")
    clean_text = page.get("clean_text") or page.get("text", "")
    context = [
        f'<slide page="{page_number}" title="{title}">',
        "<extracted_text>",
        clean_text,
        "</extracted_text>",
    ]
    if include_layout and page.get("layout_text"):
        context.extend(
            [
                "<spatial_layout>",
                page["layout_text"],
                "</spatial_layout>",
            ]
        )
    context.append("</slide>")
    return "\n".join(context)


def _build_user_content(
    req: SummaryRequest,
    scope: str,
    selected_pages: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], List[int]]:
    use_images = len(selected_pages) <= MAX_VISION_PAGES
    text_context = "\n\n".join(
        # layout_text vẫn hữu ích khi tóm tắt toàn bộ deck và không gửi ảnh.
        _page_context(page, include_layout=True) for page in selected_pages
    )
    content: List[Dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Ngôn ngữ phản hồi: {req.language}\n"
                f"Phạm vi: {scope}\n\n"
                f"{text_context}"
            ),
        }
    ]
    vision_pages: List[int] = []

    if use_images:
        for page in selected_pages:
            page_number = page["page_number"]
            try:
                image_path = render_pdf_page(req.doc_id, page_number)
                image_base64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
                content.extend(
                    [
                        {
                            "type": "text",
                            "text": f"Ảnh gốc của trang {page_number}:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ]
                )
                vision_pages.append(page_number)
            except Exception as error:
                logger.warning(
                    "Không render được ảnh trang %s: %s",
                    page_number,
                    error,
                )

    return content, vision_pages


def _extract_json_object(raw_content: str) -> Dict[str, Any]:
    cleaned = raw_content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("AI không trả về JSON")
        payload = json.loads(match.group(0))

    summary = payload.get("summary")
    key_points = payload.get("key_points")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("JSON thiếu summary hợp lệ")
    if not isinstance(key_points, list):
        raise ValueError("JSON thiếu key_points hợp lệ")

    normalized_points = [
        str(point).strip()
        for point in key_points
        if str(point).strip()
    ]
    if not normalized_points:
        raise ValueError("JSON không có key point")

    return {
        "summary": summary.strip(),
        "key_points": normalized_points[:7],
    }


def _post_chat_completion(
    url: str,
    api_key: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Send UTF-8 multimodal JSON without blocking the FastAPI event loop."""
    request = urllib.request.Request(
        url,
        # ASCII escaping avoids Windows/http.client attempting latin-1 encoding
        # on Vietnamese characters while preserving exact Unicode after JSON decode.
        data=json.dumps(payload, ensure_ascii=True).encode("ascii"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"XAH HTTP {error.code}: {body[:500]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Không kết nối được XAH: {error.reason}") from error


async def generate_summary(req: SummaryRequest) -> SummaryResponse:
    """Tóm tắt một trang, một khoảng trang hoặc toàn bộ slide."""
    try:
        data = get_extracted_data(req.doc_id)
    except (FileNotFoundError, ValueError) as error:
        return SummaryResponse(
            doc_id=req.doc_id,
            summary="Không tìm thấy tài liệu slide.",
            key_points=[],
            scope_description="Chưa xác định",
            provider="mock",
            notice=str(error),
        )

    pages: List[Dict[str, Any]] = data.get("pages", [])
    selected_pages, scope = _select_pages(pages, req)
    if not selected_pages:
        return SummaryResponse(
            doc_id=req.doc_id,
            summary="Không có trang nào trong phạm vi được chọn.",
            key_points=[],
            scope_description=scope,
            provider="mock",
            notice="Hãy kiểm tra lại số trang.",
        )

    api_key = os.getenv("XAH_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        logger.warning("Chưa cấu hình XAH_API_KEY/AI_API_KEY; dùng mock.")
        return _generate_mock_summary(
            req.doc_id,
            scope,
            selected_pages,
            req.language,
        )

    base_url = os.getenv("AI_BASE_URL", DEFAULT_AI_BASE_URL).rstrip("/")
    model = os.getenv("AI_MODEL", DEFAULT_AI_MODEL)
    content, vision_pages = _build_user_content(req, scope, selected_pages)

    try:
        result = await asyncio.to_thread(
            _post_chat_completion,
            f"{base_url}/chat/completions",
            api_key,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": content},
                ],
                "temperature": 0.1,
            },
        )
        choices = result.get("choices") or []
        raw_content = (
            choices[0].get("message", {}).get("content", "")
            if choices
            else ""
        )
        parsed = _extract_json_object(raw_content)

        notice: Optional[str] = None
        if vision_pages:
            notice = (
                "Đã đối chiếu chữ PDF với ảnh bố cục ở trang "
                + ", ".join(map(str, vision_pages))
                + "."
            )

        return SummaryResponse(
            doc_id=req.doc_id,
            summary=parsed["summary"],
            key_points=parsed["key_points"],
            scope_description=scope,
            provider="xah",
            notice=notice,
        )
    except Exception as error:
        logger.exception("Lỗi gọi AI summary")
        mock = _generate_mock_summary(
            req.doc_id,
            scope,
            selected_pages,
            req.language,
        )
        mock.notice = f"AI service lỗi: {error}. Đã chuyển sang dữ liệu dự phòng."
        return mock


def _generate_mock_summary(
    doc_id: str,
    scope: str,
    selected_pages: List[Dict[str, Any]],
    language: str,
) -> SummaryResponse:
    """Dữ liệu dự phòng tối thiểu, không giả vờ là kết quả AI thật."""
    titles = [
        page.get("title", f"Trang {page['page_number']}")
        for page in selected_pages
    ]
    title_preview = "; ".join(titles[:3])

    if language == "EN":
        summary = f"Selected scope: {scope}. Main slide headings: {title_preview}."
        key_points = []
        for page in selected_pages[:5]:
            page_number = page["page_number"]
            title = page.get("title") or f"Page {page_number}"
            key_points.append(f"{title} — Page {page_number}")
    else:
        summary = f"Phạm vi đã chọn: {scope}. Các tiêu đề chính: {title_preview}."
        key_points = []
        for page in selected_pages[:5]:
            page_number = page["page_number"]
            title = page.get("title") or f"Trang {page_number}"
            key_points.append(f"{title} — Trang {page_number}")

    return SummaryResponse(
        doc_id=doc_id,
        summary=summary,
        key_points=key_points,
        scope_description=scope,
        provider="mock",
        notice=(
            "[MOCK] Chưa cấu hình XAH_API_KEY hoặc AI_API_KEY. "
            "Kết quả chỉ liệt kê tiêu đề đã parse, không phải tóm tắt AI."
        ),
    )
