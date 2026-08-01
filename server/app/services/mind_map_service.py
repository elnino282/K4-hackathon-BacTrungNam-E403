import hashlib
import json
import re
from typing import Any

from pydantic import ValidationError

from app.schemas.mind_map import (
    MindMapNode,
    MindMapRequest,
    MindMapResponse,
)
from app.services.gemini_service import generate_content
from app.services.pdf_service import get_extracted_data
from app.services.summary_service import _build_document_sections


MAX_MIND_MAP_NODES = 200
MAX_MIND_MAP_DEPTH = 6


class MindMapScopeError(ValueError):
    """Phạm vi yêu cầu không tồn tại trong tài liệu."""


class MindMapGenerationError(RuntimeError):
    """Dịch vụ AI không trả về cây sơ đồ hợp lệ."""


SYSTEM_PROMPT = """
Bạn là VLearn Slide2Study. Hãy biến đúng nội dung slide được cung cấp thành
sơ đồ tư duy học tập bằng tiếng Việt.

Quy tắc bắt buộc:
1. Chỉ dùng thông tin trong các thẻ <page>; không thêm kiến thức ngoài nguồn.
2. Mỗi node phải có ít nhất một page_references và chỉ được dùng số trang đã cấp.
3. Mỗi node chỉ trình bày một khái niệm; title ngắn, summary giải thích 1-2 câu.
4. Giữ nguyên số liệu, phần trăm, thuật ngữ và quan hệ nguyên nhân-kết quả.
5. id phải duy nhất, ổn định, không chứa khoảng trắng.
6. Root đại diện cho toàn phạm vi; các nhánh cấp một chia bài thành các nhóm ý.
7. Nếu có <document_outline>, mọi section phải xuất hiện trong ít nhất một node;
   page_references của node đó phải nằm trong khoảng trang của section tương ứng.
8. Trả về duy nhất JSON theo schema sau, không dùng Markdown:
{
  "id": "root",
  "title": "Tên phạm vi học",
  "summary": "Mô tả ngắn",
  "page_references": [1],
  "children": []
}
""".strip()


def _depth_instruction(depth: str) -> str:
    return {
        "overview": (
            "Tạo 2-4 nhánh chính, tối đa 3 tầng; chỉ giữ cấu trúc tổng quan."
        ),
        "normal": (
            "Tạo 3-6 nhánh chính, tối đa 4 tầng; giữ các ý hỗ trợ quan trọng."
        ),
        "detailed": (
            "Tạo 4-8 nhánh chính, tối đa 6 tầng; giữ điều kiện, ngoại lệ và số liệu."
        ),
    }[depth]


def _select_source_pages(
    doc_id: str,
    request: MindMapRequest,
) -> list[dict[str, Any]]:
    data = get_extracted_data(doc_id)
    pages = sorted(
        data.get("pages", []),
        key=lambda page: int(page.get("page_number", 0)),
    )
    available = {
        int(page["page_number"])
        for page in pages
        if isinstance(page.get("page_number"), int)
    }
    if not available:
        raise MindMapScopeError("Tài liệu chưa có trang để tạo sơ đồ tư duy")

    if request.scope == "whole_lecture":
        selected_numbers = available
    elif request.scope == "current_page":
        selected_numbers = {int(request.current_page or 0)}
    else:
        selected_numbers = set(range(
            int(request.start_page or 0),
            int(request.end_page or 0) + 1,
        ))

    missing = sorted(selected_numbers - available)
    if missing:
        raise MindMapScopeError(
            "Các trang nằm ngoài tài liệu: " + ", ".join(map(str, missing))
        )

    selected = [
        page
        for page in pages
        if int(page["page_number"]) in selected_numbers
        and str(page.get("clean_text") or page.get("text") or "").strip()
    ]
    if not selected:
        raise MindMapScopeError("Không tìm thấy nội dung trong phạm vi đã chọn")
    return selected


def _source_signature(pages: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for page in pages:
        digest.update(str(page["page_number"]).encode("utf-8"))
        digest.update(b"\0")
        digest.update(
            str(page.get("clean_text") or page.get("text") or "")
            .encode("utf-8")
        )
        digest.update(b"\0")
    return digest.hexdigest()[:24]


def _build_source(pages: list[dict[str, Any]], request: MindMapRequest) -> str:
    page_blocks = "\n\n".join(
        (
            f'<page number="{page["page_number"]}">\n'
            f'{str(page.get("clean_text") or page.get("text") or "").strip()}\n'
            "</page>"
        )
        for page in pages
    )
    sections = (
        _build_document_sections(pages)
        if request.scope == "whole_lecture"
        else []
    )
    outline = ""
    if sections:
        outline = "\n".join([
            "<document_outline>",
            *[
                (
                    f'<section index="{section.index}" '
                    f'pages="{section.start_page}-{section.end_page}" '
                    f'title="{section.title}" />'
                )
                for section in sections
            ],
            "</document_outline>",
            "",
        ])
    return (
        f"Phạm vi: {request.scope}\n"
        f"Độ chi tiết: {request.depth}\n"
        f"{_depth_instruction(request.depth)}\n\n"
        f"{outline}"
        f"Nguồn slide:\n{page_blocks}"
    )


def _extract_json(raw: str) -> Any:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise MindMapGenerationError("AI không trả về JSON sơ đồ tư duy")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as error:
            raise MindMapGenerationError(
                "AI trả về JSON sơ đồ tư duy không hợp lệ"
            ) from error


def _parse_response(
    raw: str,
    allowed_pages: set[int],
    required_page_groups: list[set[int]] | None = None,
) -> tuple[MindMapNode, int]:
    try:
        payload = _extract_json(raw)
        if isinstance(payload, dict) and "mind_map" in payload:
            payload = payload["mind_map"]
        root = MindMapNode.model_validate(payload)
        seen_ids: set[str] = set()
        node_count = 0

        def validate_tree(node: MindMapNode, depth: int = 0) -> None:
            nonlocal node_count
            if depth > MAX_MIND_MAP_DEPTH:
                raise ValueError("Sơ đồ tư duy quá sâu")
            if node.id in seen_ids:
                raise ValueError("Sơ đồ có id node trùng nhau")
            if not node.page_references:
                raise ValueError("Mỗi node phải có ít nhất một nguồn trang")
            invalid_pages = set(node.page_references) - allowed_pages
            if invalid_pages:
                raise ValueError("Node trích dẫn trang nằm ngoài phạm vi")
            seen_ids.add(node.id)
            node_count += 1
            if node_count > MAX_MIND_MAP_NODES:
                raise ValueError("Sơ đồ tư duy có quá nhiều node")
            for child in node.children:
                validate_tree(child, depth + 1)

        validate_tree(root)
        if required_page_groups:
            cited_pages: set[int] = set()

            def collect_pages(node: MindMapNode) -> None:
                cited_pages.update(node.page_references)
                for child in node.children:
                    collect_pages(child)

            collect_pages(root)
            missing_groups = [
                index
                for index, page_group in enumerate(required_page_groups, start=1)
                if not (cited_pages & page_group)
            ]
            if missing_groups:
                raise ValueError(
                    "Sơ đồ bỏ sót các phần: "
                    + ", ".join(map(str, missing_groups))
                )
        return root, node_count
    except (
        MindMapGenerationError,
        ValidationError,
        TypeError,
        ValueError,
    ) as error:
        if isinstance(error, MindMapGenerationError):
            raise
        raise MindMapGenerationError(
            "AI trả về cấu trúc sơ đồ tư duy không hợp lệ"
        ) from error


async def generate_mind_map(
    doc_id: str,
    request: MindMapRequest,
) -> MindMapResponse:
    pages = _select_source_pages(doc_id, request)
    source_pages = [int(page["page_number"]) for page in pages]
    sections = (
        _build_document_sections(pages)
        if request.scope == "whole_lecture"
        else []
    )
    required_page_groups = [
        set(range(section.start_page, section.end_page + 1))
        for section in sections
    ]
    try:
        messages: list[dict[str, str]] = [
            {
                "role": "user",
                "content": _build_source(pages, request),
            }
        ]
        root: MindMapNode | None = None
        node_count = 0
        last_error: MindMapGenerationError | None = None
        for attempt in range(2):
            raw = await generate_content(
                system_instruction=SYSTEM_PROMPT,
                messages=messages,
                temperature=0.15,
                response_mime_type="application/json",
            )
            try:
                root, node_count = _parse_response(
                    raw,
                    set(source_pages),
                    required_page_groups,
                )
                break
            except MindMapGenerationError as error:
                last_error = error
                if attempt > 0:
                    raise
                messages.extend([
                    {"role": "assistant", "content": raw[:12_000]},
                    {
                        "role": "user",
                        "content": (
                            "Sơ đồ trên chưa đạt kiểm tra cấu trúc hoặc độ phủ. "
                            "Viết lại toàn bộ JSON, dùng id duy nhất, chỉ dẫn các "
                            "trang đã cấp và bảo đảm mọi section trong "
                            "document_outline đều có ít nhất một node đại diện."
                        ),
                    },
                ])
        if root is None:
            raise last_error or MindMapGenerationError(
                "AI không tạo được sơ đồ hợp lệ"
            )
    except MindMapGenerationError:
        raise
    except Exception as error:
        raise MindMapGenerationError(
            "Dịch vụ tạo sơ đồ tư duy tạm thời không khả dụng"
        ) from error

    return MindMapResponse(
        mind_map=root,
        scope=request.scope,
        depth=request.depth,
        source_pages=source_pages,
        source_signature=_source_signature(pages),
        node_count=node_count,
    )
