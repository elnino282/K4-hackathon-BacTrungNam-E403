from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.services.pdf_service import get_extracted_data, get_pdf_file_path

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("/{doc_id}")
async def get_document_extracted_data(doc_id: str = "lesson-01"):
    """
    Lấy dữ liệu JSON đã trích xuất từ PDF slide.
    """
    try:
        data = get_extracted_data(doc_id)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy dữ liệu tài liệu: {str(e)}")


@router.get("/{doc_id}/file")
async def get_document_pdf_file(doc_id: str = "lesson-01"):
    """
    Trả về trực tiếp binary file PDF để React PDF Viewer hiển thị (Single Source of Truth).
    """
    pdf_path = get_pdf_file_path(doc_id)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"File PDF '{doc_id}.pdf' không tồn tại trên server.")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"{doc_id}.pdf"
    )
