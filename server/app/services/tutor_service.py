import os
import logging
from typing import List, Optional
import httpx
from app.schemas.tutor import TutorChatRequest, TutorChatResponse
from app.services.pdf_service import get_extracted_data

logger = logging.getLogger("uvicorn")


async def chat_with_tutor(req: TutorChatRequest) -> TutorChatResponse:
    """
    Xử lý câu hỏi của học viên với AI Tutor theo ngữ cảnh đoạn văn bôi đen & trang slide.
    """
    # 1. Trích xuất ngữ cảnh slide hiện tại từ pdf_service
    page_text = ""
    slide_title = req.slide_title or f"Trang {req.page_context}"
    try:
        extracted = get_extracted_data("lesson-01")
        pages = extracted.get("pages", [])
        matched = [p for p in pages if p["page_number"] == req.page_context]
        if matched:
            page_text = matched[0].get("text", "")
            slide_title = matched[0].get("title", slide_title)
    except Exception as e:
        logger.warning(f"Không thể lấy ngữ cảnh trang {req.page_context}: {e}")

    sources = [f"Slide: {slide_title} (Trang {req.page_context})"]
    if req.selected_text:
        sources.append(f"Đoạn chọn: \"{req.selected_text[:60]}...\"")

    # 2. Kiểm tra Gemini API Key
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        logger.warning("GEMINI_API_KEY chưa được cấu hình cho Tutor Service. Trả về Mock Response.")
        return _generate_mock_tutor_reply(req, slide_title, sources)

    # 3. Gọi Gemini API
    try:
        context_str = f"Trang slide {req.page_context} ({slide_title}):\n{page_text}"
        if req.selected_text:
            context_str += f"\n\nĐoạn học viên bôi đen:\n\"{req.selected_text}\""

        prompt = f"""
Bạn là VLearn AI Tutor - Trợ lý giảng dạy thông minh, thân thiện và chính xác cho sinh viên.
Hãy trả lời câu hỏi của học viên dựa trên ngữ cảnh bài giảng được cung cấp bên dưới.

Ngữ cảnh:
{context_str}

Câu hỏi của học viên: {req.message}
Ngôn ngữ phản hồi: {req.language} (Trả lời trực tiếp, rõ ràng, dễ hiểu).
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]}
            )

        if resp.status_code == 200:
            result = resp.json()
            reply_text = result['candidates'][0]['content']['parts'][0]['text']

            return TutorChatResponse(
                reply=reply_text,
                provider="gemini",
                sources=sources,
                notice=None
            )
        else:
            logger.error(f"Gemini API Tutor Error {resp.status_code}: {resp.text}")
            mock_res = _generate_mock_tutor_reply(req, slide_title, sources)
            mock_res.notice = f"Gemini API status {resp.status_code}. Đã chuyển sang Mock data."
            return mock_res

    except Exception as e:
        logger.error(f"Exception khi gọi Tutor Gemini API: {e}")
        mock_res = _generate_mock_tutor_reply(req, slide_title, sources)
        mock_res.notice = f"Lỗi gọi AI Service: {str(e)}. Đã chuyển sang Mock data."
        return mock_res


def _generate_mock_tutor_reply(
    req: TutorChatRequest,
    slide_title: str,
    sources: List[str]
) -> TutorChatResponse:
    """Tạo câu trả lời Mock trực quan nếu không có Gemini API Key"""
    is_vi = req.language == "VI"

    if req.selected_text:
        reply = (
            f"Về đoạn bạn đã chọn ('{req.selected_text[:50]}...'): "
            f"Đây là điểm cốt lõi trong slide '{slide_title}'. "
            f"Nó giải thích cách xác định vấn đề rõ ràng trước khi xây dựng mô hình AI."
            if is_vi else
            f"Regarding your selected snippet ('{req.selected_text[:50]}...'): "
            f"This is a core point in slide '{slide_title}'. "
            f"It clarifies the problem definition before building AI models."
        )
    else:
        reply = (
            f"Dựa trên nội dung trang {req.page_context} ({slide_title}): "
            f"Câu hỏi '{req.message}' chạm tới mục tiêu trọng tâm của bài học. "
            f"Yếu tố cốt lõi là đảm bảo dữ liệu và bài toán được định nghĩa chính xác theo chuẩn nghiệm thu."
            if is_vi else
            f"Based on page {req.page_context} ({slide_title}): "
            f"Your question '{req.message}' addresses the key goal of this topic. "
            f"The essential factor is ensuring data and problem scope are defined accurately."
        )

    return TutorChatResponse(
        reply=reply,
        provider="mock",
        sources=sources,
        notice="[MOCK PROVIDER] GEMINI_API_KEY chưa được cấu hình. Phản hồi được sinh từ dữ liệu ngữ cảnh Mock."
    )
