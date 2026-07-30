from fastapi import APIRouter, HTTPException
from app.schemas.tutor import TutorChatRequest, TutorChatResponse
from app.services.tutor_service import chat_with_tutor

router = APIRouter(prefix="/api/tutor", tags=["AI Tutor"])


@router.post("/chat", response_model=TutorChatResponse)
async def tutor_chat_endpoint(req: TutorChatRequest):
    """
    API gửi câu hỏi trò chuyện cùng AI Tutor với ngữ cảnh slide & câu được bôi đen.
    """
    try:
        res = await chat_with_tutor(req)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống AI Tutor: {str(e)}")
