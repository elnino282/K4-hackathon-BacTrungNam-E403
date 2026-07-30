import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pdfplumber
import pypdfium2 as pdfium


logger = logging.getLogger("uvicorn")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SLIDES_DIR = BASE_DIR / "data" / "slides"
EXTRACTED_DIR = BASE_DIR / "data" / "extracted"
RENDERED_DIR = BASE_DIR / "data" / "rendered"

PARSER_VERSION = "pdfplumber-layout-v2"
X_TOLERANCE = 1.0
Y_TOLERANCE = 3.0
X_DENSITY = 7.25
Y_DENSITY = 13.0

DOC_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
URL_PATTERN = re.compile(
    r"(?:https?://|www\.|(?:[a-z0-9-]+\.)+(?:com|org|net|edu|vn)(?:/|$))",
    flags=re.IGNORECASE,
)
FOOTER_PATTERN = re.compile(
    r"Giảng\s+viên\s*\(VinUni\).*?AICB\s*·?\s*Ngày\s*2.*?"
    r"Tuần\s*1.*?\d+\s*/\s*\d+",
    flags=re.IGNORECASE,
)

SLIDES_DIR.mkdir(parents=True, exist_ok=True)
EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
RENDERED_DIR.mkdir(parents=True, exist_ok=True)


def _validate_doc_id(doc_id: str) -> str:
    if not DOC_ID_PATTERN.fullmatch(doc_id):
        raise ValueError(
            "doc_id chỉ được chứa chữ cái, chữ số, dấu gạch ngang và gạch dưới"
        )
    return doc_id


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _normalize_line(line: str) -> str:
    line = re.sub(r"[ \t]+", " ", line).strip()
    line = re.sub(r"\s+([,.;:?!])", r"\1", line)
    line = re.sub(r"([(\[]) +", r"\1", line)
    line = re.sub(r" +([)\]])", r"\1", line)
    return line


def _remove_repeated_footer(text: str) -> Tuple[str, bool]:
    lines: List[str] = []
    removed = False
    for line in text.splitlines():
        if FOOTER_PATTERN.search(_normalize_line(line)):
            removed = True
            continue
        lines.append(line)
    return "\n".join(lines), removed


def _clean_linear_text(text: str) -> Tuple[str, bool]:
    text, footer_removed = _remove_repeated_footer(text)
    lines = [_normalize_line(line) for line in text.splitlines()]
    return "\n".join(line for line in lines if line), footer_removed


def _clean_layout_text(text: str) -> str:
    text, _ = _remove_repeated_footer(text)
    lines = [line.rstrip() for line in text.splitlines()]

    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    compacted: List[str] = []
    previous_blank = False
    for line in lines:
        is_blank = not line.strip()
        if is_blank and previous_blank:
            continue
        compacted.append(line)
        previous_blank = is_blank
    return "\n".join(compacted)


def _suspicious_glued_tokens(text: str) -> List[str]:
    tokens: List[str] = []
    for token in re.findall(r"\S+", text):
        stripped = token.strip(".,;:!?()[]{}\"'“”")
        if len(stripped) < 24 or URL_PATTERN.search(stripped):
            continue
        tokens.append(stripped)
    return tokens


def get_pdf_file_path(doc_id: str = "lesson-01") -> Path:
    """Trả về đường dẫn PDF sau khi đã kiểm tra doc_id an toàn."""
    return SLIDES_DIR / f"{_validate_doc_id(doc_id)}.pdf"


def get_extracted_file_path(doc_id: str = "lesson-01") -> Path:
    """Trả về đường dẫn JSON đã parse."""
    return EXTRACTED_DIR / f"{_validate_doc_id(doc_id)}.json"


def extract_pdf_to_json(doc_id: str = "lesson-01") -> Dict[str, Any]:
    """Parse PDF thành text sạch và text giữ bố cục theo từng trang."""
    pdf_path = get_pdf_file_path(doc_id)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file PDF: {pdf_path}")

    logger.info("Đang parse PDF bằng %s: %s", PARSER_VERSION, pdf_path.name)
    pages_data: List[Dict[str, Any]] = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_number, original_page in enumerate(pdf.pages, start=1):
            page = original_page.dedupe_chars()
            linear_raw = page.extract_text(
                x_tolerance=X_TOLERANCE,
                y_tolerance=Y_TOLERANCE,
                layout=False,
            ) or ""
            layout_raw = page.extract_text(
                x_tolerance=X_TOLERANCE,
                y_tolerance=Y_TOLERANCE,
                layout=True,
                x_density=X_DENSITY,
                y_density=Y_DENSITY,
            ) or ""

            clean_text, footer_removed = _clean_linear_text(linear_raw)
            layout_text = _clean_layout_text(layout_raw)
            content_lines = clean_text.splitlines()
            title = content_lines[0] if content_lines else f"Trang {page_number}"
            glued_tokens = _suspicious_glued_tokens(clean_text)

            # Giữ các field cũ (text, content_lines) để tutor/summary không vỡ,
            # đồng thời thêm clean_text và layout_text cho pipeline mới.
            pages_data.append(
                {
                    "page_number": page_number,
                    "title": title,
                    "text": clean_text,
                    "clean_text": clean_text,
                    "layout_text": layout_text,
                    "content_lines": content_lines,
                    "footer_removed": footer_removed,
                    "warnings": (
                        [f"Nghi có chữ dính: {', '.join(glued_tokens)}"]
                        if glued_tokens
                        else []
                    ),
                }
            )

    extracted_payload = {
        "doc_id": doc_id,
        "file_name": pdf_path.name,
        "source_sha256": _sha256(pdf_path),
        "parser_version": PARSER_VERSION,
        "parser_parameters": {
            "x_tolerance": X_TOLERANCE,
            "y_tolerance": Y_TOLERANCE,
            "x_density": X_DENSITY,
            "y_density": Y_DENSITY,
            "dedupe_chars": True,
        },
        "total_pages": total_pages,
        "pages_with_warnings": sum(bool(page["warnings"]) for page in pages_data),
        "pages": pages_data,
    }

    json_path = get_extracted_file_path(doc_id)
    temporary_path = json_path.with_suffix(".json.tmp")
    temporary_path.write_text(
        json.dumps(extracted_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(json_path)

    logger.info("Đã parse %s trang vào %s", total_pages, json_path.name)
    return extracted_payload


def get_extracted_data(doc_id: str = "lesson-01") -> Dict[str, Any]:
    """Đọc cache hợp lệ; tự parse lại nếu parser/PDF đã thay đổi."""
    json_path = get_extracted_file_path(doc_id)
    pdf_path = get_pdf_file_path(doc_id)

    if not pdf_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file PDF cho doc_id={doc_id}")

    if json_path.exists():
        with json_path.open("r", encoding="utf-8") as file:
            cached = json.load(file)
        if (
            cached.get("parser_version") == PARSER_VERSION
            and cached.get("source_sha256") == _sha256(pdf_path)
        ):
            return cached
        logger.info("Cache parse cũ hoặc PDF đã đổi; tiến hành parse lại %s", doc_id)

    return extract_pdf_to_json(doc_id)


def render_pdf_page(
    doc_id: str,
    page_number: int,
    scale: float = 3.0,
) -> Path:
    """Render một trang thành PNG để AI dùng ảnh xác định bố cục."""
    if page_number < 1:
        raise ValueError("page_number phải bắt đầu từ 1")

    pdf_path = get_pdf_file_path(doc_id)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file PDF: {pdf_path}")

    output_dir = RENDERED_DIR / _validate_doc_id(doc_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"page-{page_number:03d}@{scale:g}x.png"
    if output_path.exists():
        return output_path

    document = pdfium.PdfDocument(str(pdf_path))
    if page_number > len(document):
        raise ValueError(f"PDF chỉ có {len(document)} trang")

    page = document[page_number - 1]
    bitmap = page.render(scale=scale)
    bitmap.to_pil().save(output_path, format="PNG")
    return output_path


def ensure_extracted_on_startup(doc_id: str = "lesson-01") -> None:
    """Đảm bảo cache parse đúng phiên bản khi backend khởi động."""
    pdf_path = get_pdf_file_path(doc_id)
    if not pdf_path.exists():
        return
    try:
        get_extracted_data(doc_id)
    except Exception as error:
        logger.error("Lỗi khi parse PDF lúc startup: %s", error)
