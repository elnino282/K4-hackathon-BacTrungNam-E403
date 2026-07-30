import os
import logging
from typing import Optional, List, Dict, Any
import httpx
from app.schemas.summary import SummaryRequest, SummaryResponse
from app.services.pdf_service import get_extracted_data

logger = logging.getLogger("uvicorn")


async def generate_summary(req: SummaryRequest) -> SummaryResponse:
    """
    Tạo tóm tắt bài giảng slide:
    - Trang hiện tại (current_page)
    - Khoảng trang (start_page -> end_page)
    - Toàn bộ slide (khi không chọn trang)
    """
    # 1. Lấy dữ liệu trích xuất từ pdf_service
    try:
        data = get_extracted_data(req.doc_id)
    except FileNotFoundError:
        return SummaryResponse(
            doc_id=req.doc_id,
            summary="Không tìm thấy tài liệu slide.",
            key_points=[],
            scope_description="Chưa xác định",
            provider="mock",
            notice="Lỗi: File tài liệu chưa được trích xuất."
        )

    pages: List[Dict[str, Any]] = data.get("pages", [])
    total_pages = data.get("total_pages", len(pages))

    # 2. Lọc ngữ cảnh theo phạm vi trang yêu cầu
    selected_pages = []
    scope_desc = ""

    if req.current_page is not None:
        selected_pages = [p for p in pages if p["page_number"] == req.current_page]
        scope_desc = f"Trang {req.current_page}"
    elif req.start_page is not None and req.end_page is not None:
        selected_pages = [p for p in pages if req.start_page <= p["page_number"] <= req.end_page]
        scope_desc = f"Khoảng trang {req.start_page} - {req.end_page}"
    else:
        selected_pages = pages
        scope_desc = f"Toàn bộ slide ({total_pages} trang)"

    if not selected_pages:
        selected_pages = pages
        scope_desc = f"Toàn bộ slide ({total_pages} trang)"

    # Gom văn bản các trang đã chọn
    combined_text = "\n\n".join([
        f"--- Trang {p['page_number']}: {p.get('title', '')} ---\n{p.get('text', '')}"
        for p in selected_pages
    ])

    # 3. Kiểm tra Gemini API Key
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        logger.warning("GEMINI_API_KEY chưa được cấu hình. Sử dụng Mock Response.")
        return _generate_mock_summary(req.doc_id, scope_desc, selected_pages, req.language)

    # 4. Gọi Gemini API nếu có API Key
    try:
        prompt = f"""
Bạn là trợ lý giảng dạy AI xuất sắc. Hãy tóm tắt nội dung bài giảng dưới đây (Ngôn ngữ phản hồi: {req.language}).

Nội dung slide ({scope_desc}):
{combined_text}

Yêu cầu output:
1. Bản tóm tắt ngắn gọn, đúc kết ý cốt lõi (2-3 câu).
2. Danh sách 3-5 điểm quan trọng nhất (gạch đầu dòng).
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]}
            )

        if resp.status_code == 200:
            result = resp.json()
            raw_response = result['candidates'][0]['content']['parts'][0]['text']
            
            # Phân tách summary và key_points đơn giản
            lines = [l.strip() for l in raw_response.splitlines() if l.strip()]
            summary_text = raw_response
            key_points = [l.lstrip("-*• ") for l in lines if l.startswith(("-", "*", "•"))]

            if not key_points and len(lines) > 1:
                key_points = lines[1:5]

            return SummaryResponse(
                doc_id=req.doc_id,
                summary=summary_text,
                key_points=key_points,
                scope_description=scope_desc,
                provider="gemini",
                notice=None
            )
        else:
            logger.error(f"Gemini API Error {resp.status_code}: {resp.text}")
            mock_res = _generate_mock_summary(req.doc_id, scope_desc, selected_pages, req.language)
            mock_res.notice = f"Gemini API gặp lỗi status {resp.status_code}. Đã chuyển sang Mock data."
            return mock_res

    except Exception as e:
        logger.error(f"Exception khi gọi Gemini API: {e}")
        mock_res = _generate_mock_summary(req.doc_id, scope_desc, selected_pages, req.language)
        mock_res.notice = f"Lỗi gọi AI Service: {str(e)}. Đã chuyển sang Mock data."
        return mock_res


def _generate_mock_summary(
    doc_id: str,
    scope_desc: str,
    selected_pages: List[Dict[str, Any]],
    language: str
) -> SummaryResponse:
    """Tạo tóm tắt Mock trực quan rõ ràng dựa trên dữ liệu trích xuất"""
    is_vi = language == "VI"
    
    titles = [p.get("title", f"Trang {p['page_number']}") for p in selected_pages]
    title_str = ", ".join(titles[:3])

    if is_vi:
        summary = f"Bài giảng ({scope_desc}) tập trung vào chủ đề tổng quan: {title_str}. Mục tiêu chính là làm rõ các khái niệm nền tảng và bài toán cốt lõi trong học phần."
        key_points = [
            f"Nội dung trọng tâm thuộc {scope_desc}.",
            "Định nghĩa Problem Statement và định hướng giải quyết bằng AI.",
            "Tập trung làm rõ vai trò của dữ liệu và các thành phần bài toán.",
            "Chuẩn hóa quy trình triển khai và nghiệm thu kết quả."
        ]
    else:
        summary = f"The lecture ({scope_desc}) focuses on key concepts: {title_str}. The main objective is to clarify core foundations and problem statements."
        key_points = [
            f"Core content covering {scope_desc}.",
            "Definition of Problem Statement in AI development.",
            "Clarifying the role of data and model specifications.",
            "Standardizing execution and verification criteria."
        ]

    return SummaryResponse(
        doc_id=doc_id,
        summary=summary,
        key_points=key_points,
        scope_description=scope_desc,
        provider="mock",
        notice="[MOCK PROVIDER] GEMINI_API_KEY chưa được thiết lập. Dữ liệu tóm tắt được tạo tự động từ nội dung trích xuất."
    )
