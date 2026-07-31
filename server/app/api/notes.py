from fastapi import APIRouter, HTTPException

from app.schemas.note import AINoteRequest, AINoteResponse
from app.services.note_service import NoteScopeError, generate_ai_note


router = APIRouter(prefix="/api/notes", tags=["Notes"])


@router.post("/generate", response_model=AINoteResponse)
async def generate_note(req: AINoteRequest):
    try:
        return await generate_ai_note(req)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy tài liệu '{req.doc_id}'",
        ) from error
    except NoteScopeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Lỗi hệ thống khi tạo AI Note",
        ) from error
