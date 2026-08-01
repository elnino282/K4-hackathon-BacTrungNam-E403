from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from app.schemas.mind_map import MindMapRequest, MindMapResponse
from app.services.mind_map_service import (
    MindMapGenerationError,
    MindMapScopeError,
    generate_mind_map,
)
from app.services.pdf_service import (
    extract_pdf_to_json,
    get_extracted_data,
    get_pdf_file_path,
    render_pdf_page,
)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/{doc_id}/mind-map", response_model=MindMapResponse)
async def create_mind_map(doc_id: str, request: MindMapRequest):
    """Tạo sơ đồ tư duy chỉ từ nội dung thật của tài liệu và phạm vi đã chọn."""
    try:
        return await generate_mind_map(doc_id, request)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except MindMapScopeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except MindMapGenerationError as error:
        raise HTTPException(
            status_code=502,
            detail="Không thể tạo sơ đồ tư duy lúc này. Vui lòng thử lại.",
        ) from error


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


@router.post("/{doc_id}/parse")
async def parse_document(
    doc_id: str = "lesson-01",
    force: bool = Query(
        default=False,
        description="Parse lại ngay cả khi cache hiện tại vẫn hợp lệ",
    ),
):
    """Chạy phase parse PDF và trả JSON theo từng trang."""
    try:
        return extract_pdf_to_json(doc_id) if force else get_extracted_data(doc_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi parse PDF: {str(e)}")


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


@router.get("/{doc_id}/pages/{page_number}/image")
async def get_document_page_image(
    doc_id: str,
    page_number: int,
):
    """Render ảnh trang theo nhu cầu để AI hiểu bảng/cột/sơ đồ."""
    try:
        image_path = render_pdf_page(doc_id, page_number)
        return FileResponse(path=str(image_path), media_type="image/png")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi render trang PDF: {str(e)}")
