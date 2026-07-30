from fastapi import APIRouter, HTTPException
from app.schemas.summary import SummaryRequest, SummaryResponse
from app.services.summary_service import SummaryScopeError, generate_summary

router = APIRouter(prefix="/api/summaries", tags=["Summaries"])


@router.post("/generate", response_model=SummaryResponse)
async def generate_slide_summary(req: SummaryRequest):
    """
    Tạo tóm tắt bài giảng slide (hỗ trợ tóm tắt trang hiện tại, khoảng trang, hoặc toàn bộ slide).
    """
    try:
        res = await generate_summary(req)
        return res
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy tài liệu '{req.doc_id}'",
        ) from e
    except SummaryScopeError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Lỗi hệ thống khi tạo tóm tắt",
        ) from e
