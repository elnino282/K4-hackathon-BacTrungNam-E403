import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import pypdf

logger = logging.getLogger("uvicorn")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SLIDES_DIR = BASE_DIR / "data" / "slides"
EXTRACTED_DIR = BASE_DIR / "data" / "extracted"

SLIDES_DIR.mkdir(parents=True, exist_ok=True)
EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)


def get_pdf_file_path(doc_id: str = "lesson-01") -> Path:
    """Trả về đường dẫn tới file PDF trong server/data/slides/"""
    return SLIDES_DIR / f"{doc_id}.pdf"


def get_extracted_file_path(doc_id: str = "lesson-01") -> Path:
    """Trả về đường dẫn tới file JSON đã trích xuất trong server/data/extracted/"""
    return EXTRACTED_DIR / f"{doc_id}.json"


def extract_pdf_to_json(doc_id: str = "lesson-01") -> Dict[str, Any]:
    """
    Trích xuất nội dung văn bản từ file PDF và lưu thành cấu trúc JSON.
    """
    pdf_path = get_pdf_file_path(doc_id)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file PDF: {pdf_path}")

    logger.info(f"Đang trích xuất nội dung từ PDF: {pdf_path.name}")
    reader = pypdf.PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    pages_data: List[Dict[str, Any]] = []

    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        raw_text = page.extract_text() or ""
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

        # Trích xuất tiêu đề trang từ dòng đầu tiên nếu có
        slide_title = lines[0] if lines else f"Trang {page_num}"

        pages_data.append({
            "page_number": page_num,
            "title": slide_title,
            "text": raw_text,
            "content_lines": lines
        })

    extracted_payload = {
        "doc_id": doc_id,
        "file_name": pdf_path.name,
        "total_pages": total_pages,
        "pages": pages_data
    }

    # Ghi ra JSON
    json_path = get_extracted_file_path(doc_id)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(extracted_payload, f, ensure_ascii=False, indent=2)

    logger.info(f"Đã trích xuất thành công {total_pages} trang vào {json_path.name}")
    return extracted_payload


def get_extracted_data(doc_id: str = "lesson-01") -> Dict[str, Any]:
    """
    Lấy dữ liệu trích xuất từ file JSON. Nếu chưa có, tự động extract 1 lần.
    """
    json_path = get_extracted_file_path(doc_id)
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    # Nếu chưa có JSON nhưng có PDF, tiến hành extract
    pdf_path = get_pdf_file_path(doc_id)
    if pdf_path.exists():
        return extract_pdf_to_json(doc_id)

    raise FileNotFoundError(f"Không tìm thấy dữ liệu trích xuất hay file PDF cho doc_id={doc_id}")


def ensure_extracted_on_startup(doc_id: str = "lesson-01"):
    """
    Startup check: kiểm tra nếu lesson-01.json chưa tồn tại thì trích xuất.
    """
    json_path = get_extracted_file_path(doc_id)
    pdf_path = get_pdf_file_path(doc_id)

    if not json_path.exists() and pdf_path.exists():
        logger.info(f"Startup: Trích xuất {pdf_path.name} lần đầu...")
        try:
            extract_pdf_to_json(doc_id)
        except Exception as e:
            logger.error(f"Lỗi khi trích xuất PDF lúc startup: {e}")
