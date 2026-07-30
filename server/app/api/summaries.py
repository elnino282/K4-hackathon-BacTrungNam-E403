from fastapi import APIRouter, HTTPException
from app.schemas.summary import SummaryRequest, SummaryResponse
from app.services.summary_service import generate_summary

router = APIRouter(prefix="/api/summaries", tags=["Summaries"])


@router.post("/generate", response_model=SummaryResponse)
async def generate_slide_summary(req: SummaryRequest):
    """
    Tạo tóm tắt bài giảng slide (hỗ trợ tóm tắt trang hiện tại, khoảng trang, hoặc toàn bộ slide).
    """
    try:
        res = await generate_summary(req)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi tạo tóm tắt: {str(e)}")
