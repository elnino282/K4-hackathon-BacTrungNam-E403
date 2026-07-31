import base64
import asyncio
import json
import logging
import re
import unicodedata
from collections import OrderedDict
from dataclasses import dataclass
from time import monotonic
from typing import Any, Dict, List, Optional

from app.schemas.summary import (
    SummaryCoverage,
    SummaryKeyPoint,
    SummaryRequest,
    SummaryResponse,
)
from app.services.evidence_service import (
    build_source_passages,
    verify_key_points,
)
from app.services.gemini_service import (
    GeminiConfigurationError,
    generate_content,
    get_gemini_configuration,
)
from app.services.pdf_service import get_extracted_data, render_pdf_page


logger = logging.getLogger("uvicorn")

MAX_VISION_PAGES = 3
SUMMARY_PROMPT_VERSION = "source-passages-v1"
SUMMARY_CACHE_TTL_SECONDS = 60 * 60
SUMMARY_CACHE_MAX_ENTRIES = 64
_SUMMARY_CACHE: OrderedDict[
    tuple[Any, ...],
    tuple[float, Dict[str, Any]],
] = OrderedDict()


def _clear_summary_cache() -> None:
    """Test/dev hook; production entries expire or are evicted automatically."""
    _SUMMARY_CACHE.clear()


def _summary_cache_key(
    data: Dict[str, Any],
    req: SummaryRequest,
    model: str,
) -> tuple[Any, ...]:
    return (
        data.get("source_sha256"),
        data.get("parser_version"),
        req.doc_id,
        req.current_page,
        req.start_page,
        req.end_page,
        req.language,
        req.depth,
        model,
        SUMMARY_PROMPT_VERSION,
    )


def _get_cached_summary(key: tuple[Any, ...]) -> Optional[SummaryResponse]:
    cached = _SUMMARY_CACHE.get(key)
    if cached is None:
        return None

    created_at, payload = cached
    if monotonic() - created_at > SUMMARY_CACHE_TTL_SECONDS:
        del _SUMMARY_CACHE[key]
        return None

    _SUMMARY_CACHE.move_to_end(key)
    result = SummaryResponse.model_validate(payload)
    result.cached = True
    return result


def _put_cached_summary(
    key: tuple[Any, ...],
    result: SummaryResponse,
) -> None:
    # Do not freeze a weak answer: partial/fallback/error requests should be
    # allowed to try the model again on the next user action.
    if result.status != "verified" or not result.key_points:
        return
    _SUMMARY_CACHE[key] = (
        monotonic(),
        result.model_dump(),
    )
    _SUMMARY_CACHE.move_to_end(key)
    while len(_SUMMARY_CACHE) > SUMMARY_CACHE_MAX_ENTRIES:
        _SUMMARY_CACHE.popitem(last=False)


@dataclass(frozen=True)
class SummaryContract:
    min_points: int
    max_points: int
    page_type: str
    instruction: str


ADMIN_PAGE_MARKERS = (
    "cam on",
    "thank you",
    "hoi & dap",
    "hoi va dap",
    "q&a",
)
ACTIVITY_PAGE_MARKERS = (
    "hay suy nghi",
    "thao luan",
    "bai tap",
    "cau hoi",
)


class SummaryScopeError(ValueError):
    """Phạm vi hợp lệ về cấu trúc nhưng nằm ngoài tài liệu."""


SUMMARY_SYSTEM_PROMPT = """
Bạn là VLearn Slide2Study, bộ xử lý tài liệu học tập dựa trên bằng chứng.

Mục tiêu học tập:
- Giúp học viên trong vài giây trả lời được hai câu: "Phần này nói về điều gì?"
  và "Điều gì cần nhớ để học tiếp?".
- Tóm tắt đúng phạm vi được yêu cầu, không biến kết quả thành bài giảng mở rộng.

Cách đọc nguồn:
- Dùng ẢNH để xác định tiêu đề, bố cục, hàng/cột, nhãn, mũi tên và quan hệ
  giữa các thành phần.
- Dùng CHỮ TRÍCH XUẤT để giữ chính xác câu chữ, số liệu, thuật ngữ và dấu
  tiếng Việt.
- Khi ảnh và chữ trích xuất có vẻ mâu thuẫn, chỉ nêu điều có thể xác nhận;
  không tự ghép số liệu với nhãn nếu quan hệ chưa rõ.

Quy tắc bắt buộc:
1. Chỉ sử dụng thông tin xuất hiện trong dữ liệu được cung cấp.
2. Không thêm kiến thức nền, nguyên nhân, ví dụ, định nghĩa hoặc kết luận không
   có trong nguồn.
3. Giữ nguyên tên riêng, thuật ngữ và từ viết tắt. Không tự khai triển hoặc dịch
   từ viết tắt nếu slide không giải thích.
4. Không biến ví dụ thành kết luận chung. Không đổi mức độ chắc chắn của slide.
5. Gộp ý trùng lặp; bỏ chân trang, số thứ tự điều hướng và chi tiết trang trí.
6. Nếu nguồn không đủ rõ, nêu giới hạn ngắn gọn thay vì tự điền.
7. Mỗi ý quan trọng phải có đúng một trang nguồn và một source_id lấy nguyên vẹn
   từ thuộc tính id của <passage> trên chính trang đó. Không tự tạo source_id và
   không dùng source_id của trang khác.
8. Với mọi phạm vi: tạo 3-5 key_points.
9. Trước khi viết, đọc hết phạm vi và chọn ý theo thứ tự sau:
   - Một trang: ưu tiên số liệu, nhãn, tên thành phần và kết luận nổi bật. Giữ
     nguyên các thuật ngữ đặc trưng thay vì đổi thành từ chung chung.
   - Từ 2 đến 5 trang: mỗi trang có nội dung phải được đại diện bởi ít nhất một
     key_point trước khi lấy ý thứ hai từ cùng một trang.
   - Trên 5 trang: chọn 5 ý thuộc các phần lớn khác nhau, trải đều đầu, giữa và
     cuối tài liệu; không dùng trang bìa hoặc trang ngăn phần làm ý chính.
10. Claim phải giữ nguyên các con số và tên nhãn quan trọng xuất hiện trong
    <passage> đã chọn. Không nói "có số liệu", "có nhiều giai đoạn" hoặc "các yếu tố"
    nếu nguồn đã nêu số hay tên cụ thể.
11. <passage> được chọn phải trực tiếp đủ sức chứng minh toàn bộ claim, không chỉ
    có chung chủ đề với claim. Máy chủ sẽ tự lấy nguyên văn đoạn này làm dẫn chứng.
12. Nếu trang là bảng, khung hoặc danh sách có tên: ưu tiên gọi đúng tên các
    hàng, cột hoặc mục; không thay cả danh sách bằng câu chung như "gồm nhiều
    thành phần". Nếu trang có kết luận và danh sách tên, phải giữ cả hai.
13. Với phạm vi 2-5 trang, summary phải gọi được chủ đề riêng của từng trang.
    Với toàn bộ tài liệu, summary phải gọi đúng tên các phần lớn/tiêu đề phần
    xuất hiện trong nguồn.
14. Mỗi key_point tối đa khoảng 45 từ, không lặp lại nguyên văn summary.
15. Phần giải thích dùng ngôn ngữ người dùng yêu cầu.
16. Trường claim không chứa "Trang N"; số trang chỉ nằm trong trường page.

Chỉ trả về một JSON hợp lệ, không dùng Markdown và không thêm chữ ngoài JSON:
{
  "summary": "Bản tóm tắt đúng độ dài theo phạm vi",
  "key_points": [
    {
      "claim": "Ý cụ thể, ngắn gọn",
      "page": 12,
      "source_id": "p012-001"
    }
  ]
}
""".strip()


def _system_prompt_for_contract(contract: SummaryContract) -> str:
    if (
        contract.page_type not in {"divider", "cover", "sparse", "activity"}
        and (contract.min_points, contract.max_points) == (3, 5)
    ):
        return SUMMARY_SYSTEM_PROMPT
    return SUMMARY_SYSTEM_PROMPT.replace(
        "8. Với mọi phạm vi: tạo 3-5 key_points.",
        (
            "8. Tuân thủ chính xác min_points và max_points trong "
            "<summary_contract>. Không kéo dài hoặc lặp ý chỉ để đủ số lượng."
        ),
    )


def _normalize_label(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"\s+", " ", without_marks.replace("đ", "d")).strip()


def _classify_single_page(page: Dict[str, Any]) -> str:
    title = _normalize_label(str(page.get("title") or ""))
    text = str(page.get("clean_text") or page.get("text") or "")

    if any(marker in title for marker in ADMIN_PAGE_MARKERS):
        return "administrative"
    if re.fullmatch(r"\d{1,2}", title) or (
        len(text) <= 130
        and re.match(r"^\s*\d{1,2}\s*(?:\r?\n|$)", text)
    ):
        return "divider"
    if page.get("page_number") == 1 and len(text) <= 250:
        return "cover"
    if any(title.startswith(marker) for marker in ACTIVITY_PAGE_MARKERS):
        return "activity"
    if len(text) < 180:
        return "sparse"
    return "content"


def _build_base_summary_contract(
    selected_pages: List[Dict[str, Any]],
) -> SummaryContract:
    page_count = len(selected_pages)
    if page_count == 1:
        page_type = _classify_single_page(selected_pages[0])
        if page_type == "administrative":
            return SummaryContract(
                min_points=0,
                max_points=0,
                page_type=page_type,
                instruction=(
                    "Trang hành chính/kết thúc: không tạo tóm tắt kiến thức."
                ),
            )
        if page_type in {"divider", "cover", "sparse"}:
            return SummaryContract(
                min_points=1,
                max_points=2,
                page_type=page_type,
                instruction=(
                    "Trang ít nội dung: nêu đúng 1-2 ý khác nhau; tuyệt đối không "
                    "tách một thông tin thành nhiều cách diễn đạt."
                ),
            )
        if page_type == "activity":
            return SummaryContract(
                min_points=2,
                max_points=3,
                page_type=page_type,
                instruction=(
                    "Trang hoạt động/câu hỏi: nêu tình huống, yêu cầu và điều cần "
                    "suy nghĩ; không tự trả lời thay nội dung slide."
                ),
            )
        return SummaryContract(
            min_points=3,
            max_points=5,
            page_type=page_type,
            instruction="Trang nội dung: chọn 3-5 ý học tập quan trọng nhất.",
        )

    if page_count <= 2:
        return SummaryContract(
            min_points=2,
            max_points=4,
            page_type="multi_page",
            instruction="Mỗi trang có nội dung cần ít nhất một ý đại diện.",
        )
    if page_count <= 5:
        return SummaryContract(
            min_points=3,
            max_points=5,
            page_type="multi_page",
            instruction="Phủ các trang có nội dung trước khi lấy ý thứ hai.",
        )
    return SummaryContract(
        min_points=4,
        max_points=5,
        page_type="document",
        instruction=(
            "Chọn 4-5 ý thuộc các phần lớn khác nhau; bỏ trang bìa, trang ngăn "
            "phần và trang hành chính."
        ),
    )


def _build_summary_contract(
    selected_pages: List[Dict[str, Any]],
    depth: str = "standard",
) -> SummaryContract:
    base = _build_base_summary_contract(selected_pages)
    if (
        depth == "standard"
        or base.page_type in {
            "administrative",
            "divider",
            "cover",
            "sparse",
            "activity",
        }
    ):
        return base

    page_count = len(selected_pages)
    if depth == "quick":
        if page_count > 5:
            minimum, maximum = 3, 3
        else:
            minimum = min(base.min_points, 2)
            maximum = min(base.max_points, 3)
        return SummaryContract(
            min_points=minimum,
            max_points=maximum,
            page_type=base.page_type,
            instruction=(
                base.instruction
                + " Chế độ 30 giây: chỉ giữ ý đủ để định hướng học tiếp."
            ),
        )

    if page_count > 5:
        minimum, maximum = 5, 5
    elif page_count >= 3:
        minimum, maximum = 4, 5
    elif page_count == 2:
        minimum, maximum = 3, 4
    else:
        minimum, maximum = 4, 5
    return SummaryContract(
        min_points=minimum,
        max_points=maximum,
        page_type=base.page_type,
        instruction=(
            base.instruction
            + " Chế độ học sâu: giữ quan hệ giữa các ý và điểm dễ nhầm."
        ),
    )


def _evidence_scope_coverage(
    verified_points: List[Dict[str, Any]],
    selected_pages: List[Dict[str, Any]],
) -> tuple[int, int]:
    """Return covered/required page groups for the requested scope."""
    represented_pages = {
        point["page"]
        for point in verified_points
        if isinstance(point.get("page"), int)
    }
    content_pages = [
        page
        for page in selected_pages
        if _classify_single_page(page) != "administrative"
    ]

    if len(content_pages) <= 1:
        return (int(bool(represented_pages)), 1)

    if len(content_pages) <= 5:
        required_pages = {
            page["page_number"]
            for page in content_pages
        }
        return (
            len(required_pages & represented_pages),
            len(required_pages),
        )

    page_to_bucket = {
        page["page_number"]: min(
            2,
            index * 3 // len(content_pages),
        )
        for index, page in enumerate(content_pages)
    }
    represented_buckets = {
        page_to_bucket[page]
        for page in represented_pages
        if page in page_to_bucket
    }
    return (len(represented_buckets), 3)


def _select_pages(
    pages: List[Dict[str, Any]],
    req: SummaryRequest,
) -> tuple[List[Dict[str, Any]], str]:
    total_pages = len(pages)
    if total_pages < 1:
        raise SummaryScopeError("Tài liệu không có trang nào để tóm tắt")

    if req.current_page is not None:
        if req.current_page > total_pages:
            raise SummaryScopeError(
                f"Trang {req.current_page} nằm ngoài tài liệu 1-{total_pages}"
            )
        selected = [
            page for page in pages if page["page_number"] == req.current_page
        ]
        scope = f"Trang {req.current_page}"
    elif req.start_page is not None and req.end_page is not None:
        if req.end_page > total_pages:
            raise SummaryScopeError(
                f"Khoảng {req.start_page}-{req.end_page} nằm ngoài tài liệu "
                f"1-{total_pages}"
            )
        selected = [
            page
            for page in pages
            if req.start_page <= page["page_number"] <= req.end_page
        ]
        scope = f"Khoảng trang {req.start_page} - {req.end_page}"
    else:
        selected = pages
        scope = f"Toàn bộ slide ({total_pages} trang)"

    return selected, scope


def _page_context(
    page: Dict[str, Any],
    include_layout: bool,
    source_passages: List[Dict[str, Any]],
) -> str:
    page_number = page["page_number"]
    title = page.get("title", f"Trang {page_number}")
    context = [
        f'<slide page="{page_number}" title="{title}">',
        "<source_passages>",
    ]
    context.extend(
        (
            f'<passage id="{passage["source_id"]}">\n'
            f'{passage["text"]}\n'
            "</passage>"
        )
        for passage in source_passages
        if passage["page"] == page_number
    )
    context.append("</source_passages>")
    if include_layout and page.get("layout_text"):
        context.extend(
            [
                "<spatial_layout>",
                page["layout_text"],
                "</spatial_layout>",
            ]
        )
    context.append("</slide>")
    return "\n".join(context)


def _build_user_content(
    req: SummaryRequest,
    scope: str,
    selected_pages: List[Dict[str, Any]],
    contract: SummaryContract,
    source_passages: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], List[int]]:
    use_images = len(selected_pages) <= MAX_VISION_PAGES
    text_context = "\n\n".join(
        # layout_text vẫn hữu ích khi tóm tắt toàn bộ deck và không gửi ảnh.
        _page_context(
            page,
            include_layout=True,
            source_passages=source_passages,
        )
        for page in selected_pages
    )
    adaptive_contract = (
        f'<summary_contract page_type="{contract.page_type}" '
        f'depth="{req.depth}" '
        f'min_points="{contract.min_points}" '
        f'max_points="{contract.max_points}">\n'
        f"{contract.instruction}\n"
        "</summary_contract>\n\n"
    )
    content: List[Dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Ngôn ngữ phản hồi: {req.language}\n"
                f"Phạm vi: {scope}\n\n"
                f"{adaptive_contract}"
                f"{text_context}"
            ),
        }
    ]
    vision_pages: List[int] = []

    if use_images:
        for page in selected_pages:
            page_number = page["page_number"]
            try:
                image_path = render_pdf_page(req.doc_id, page_number)
                image_base64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
                content.extend(
                    [
                        {
                            "type": "text",
                            "text": f"Ảnh gốc của trang {page_number}:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ]
                )
                vision_pages.append(page_number)
            except Exception as error:
                logger.warning(
                    "Không render được ảnh trang %s: %s",
                    page_number,
                    error,
                )

    return content, vision_pages


def _extract_json_object(raw_content: str) -> Dict[str, Any]:
    cleaned = raw_content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("AI không trả về JSON")
        payload = json.loads(match.group(0))

    summary = payload.get("summary")
    key_points = payload.get("key_points")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("JSON thiếu summary hợp lệ")
    if not isinstance(key_points, list):
        raise ValueError("JSON thiếu key_points hợp lệ")

    normalized_points = []
    for point in key_points:
        if not isinstance(point, dict):
            continue
        claim = point.get("claim")
        source_id = point.get("source_id")
        evidence_quote = point.get("evidence_quote")
        page = point.get("page")
        has_source_id = isinstance(source_id, str) and bool(source_id.strip())
        has_legacy_quote = (
            isinstance(evidence_quote, str)
            and bool(evidence_quote.strip())
        )
        if (
            isinstance(claim, str)
            and claim.strip()
            and (has_source_id or has_legacy_quote)
            and isinstance(page, int)
        ):
            normalized_point = {
                "claim": claim.strip(),
                "page": page,
            }
            if has_source_id:
                normalized_point["source_id"] = source_id.strip()
            if has_legacy_quote:
                normalized_point["evidence_quote"] = evidence_quote.strip()
            normalized_points.append(normalized_point)
    if not normalized_points:
        raise ValueError("JSON không có key point theo evidence contract")

    return {
        "summary": summary.strip(),
        "key_points": normalized_points[:5],
    }


async def generate_summary(req: SummaryRequest) -> SummaryResponse:
    """Tóm tắt một trang, một khoảng trang hoặc toàn bộ slide."""
    data = get_extracted_data(req.doc_id)

    pages: List[Dict[str, Any]] = data.get("pages", [])
    selected_pages, scope = _select_pages(pages, req)
    if not selected_pages:
        raise SummaryScopeError(
            f"Không có trang nào trong phạm vi được chọn: {scope}"
        )

    contract = _build_summary_contract(selected_pages, req.depth)
    if contract.page_type == "administrative":
        return _generate_not_applicable_summary(
            req.doc_id,
            scope,
            selected_pages,
            req.language,
            contract,
            req.depth,
        )

    try:
        configuration = get_gemini_configuration()
    except GeminiConfigurationError:
        logger.warning("Chưa cấu hình GEMINI_API_KEY/GEMINI_MODEL; dùng mock.")
        return _generate_mock_summary(
            req.doc_id,
            scope,
            selected_pages,
            req.language,
            contract,
            req.depth,
        )

    cache_key = _summary_cache_key(data, req, configuration.model)
    cached_result = _get_cached_summary(cache_key)
    if cached_result is not None:
        return cached_result

    source_passages = build_source_passages(selected_pages)
    content, vision_pages = _build_user_content(
        req,
        scope,
        selected_pages,
        contract,
        source_passages,
    )

    try:
        messages: List[Dict[str, Any]] = [
            {
                "role": "system",
                "content": _system_prompt_for_contract(contract),
            },
            {"role": "user", "content": content},
        ]
        best_candidate: Optional[
            tuple[
                Dict[str, Any],
                List[Dict[str, Any]],
                List[Dict[str, Any]],
                int,
                int,
            ]
        ] = None
        retried = False
        last_error: Optional[Exception] = None

        # Một lượt tự sửa giúp chống JSON hỏng hoặc evidence quote bị model
        # chép sai. Ngưỡng retry đi theo mật độ nội dung thay vì cố định 3 ý.
        for attempt in range(2):
            raw_content = ""
            try:
                raw_content = await generate_content(
                    system_instruction=_system_prompt_for_contract(contract),
                    messages=messages[1:],
                    temperature=0.1,
                    response_mime_type="application/json",
                )
                parsed_attempt = _extract_json_object(raw_content)
                verified_attempt, rejected_attempt = verify_key_points(
                    parsed_attempt["key_points"],
                    selected_pages,
                    source_passages,
                )
                covered_groups, required_groups = _evidence_scope_coverage(
                    verified_attempt,
                    selected_pages,
                )
                candidate = (
                    parsed_attempt,
                    verified_attempt,
                    rejected_attempt,
                    covered_groups,
                    required_groups,
                )
                candidate_score = (
                    covered_groups >= required_groups,
                    covered_groups,
                    len(verified_attempt),
                    -len(rejected_attempt),
                )
                best_score = (
                    (
                        best_candidate[3] >= best_candidate[4],
                        best_candidate[3],
                        len(best_candidate[1]),
                        -len(best_candidate[2]),
                    )
                    if best_candidate is not None
                    else None
                )
                if (
                    best_candidate is None
                    or candidate_score > best_score
                ):
                    best_candidate = candidate
                if (
                    len(verified_attempt) >= contract.min_points
                    and covered_groups >= required_groups
                ):
                    break
                last_error = ValueError(
                    f"chỉ có {len(verified_attempt)}/{contract.min_points} "
                    "ý vượt kiểm tra nguồn và phủ "
                    f"{covered_groups}/{required_groups} phần bắt buộc"
                )
            except Exception as attempt_error:
                last_error = attempt_error
                # A second request only helps when the model returned malformed
                # JSON or weak evidence. It cannot repair an HTTP/network error
                # and would otherwise double the user's wait.
                if isinstance(attempt_error, RuntimeError):
                    break

            if attempt == 0:
                retried = True
                if raw_content:
                    messages.append({"role": "assistant", "content": raw_content})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Hãy tự sửa toàn bộ câu trả lời. Lần trước không đủ "
                            f"{contract.min_points} ý vượt kiểm tra nguồn, chưa "
                            "phủ đủ các trang/phần của phạm vi hoặc JSON chưa "
                            "hợp lệ. Trả về đúng JSON theo schema, gồm "
                            f"{contract.min_points}-{contract.max_points} "
                            "key_points khác nhau. Mỗi source_id phải được lấy "
                            "nguyên vẹn từ thuộc tính id của một <passage> đúng "
                            "trang và đoạn đó phải đủ sức chứng minh claim."
                        ),
                    }
                )

        if best_candidate is None:
            raise last_error or ValueError("AI không tạo được kết quả hợp lệ")

        (
            parsed,
            verified_points,
            rejected_points,
            covered_groups,
            required_groups,
        ) = best_candidate
        if not verified_points:
            return SummaryResponse(
                doc_id=req.doc_id,
                summary=(
                    "Chưa thể tạo bản tóm tắt đáng tin cậy vì không có ý nào "
                    "khớp với nguồn PDF."
                    if req.language != "EN"
                    else "No reliable summary is available because none of the "
                    "points matched the PDF source."
                ),
                key_points=[],
                scope_description=scope,
                coverage=SummaryCoverage(
                    requested_pages=len(selected_pages),
                    processed_pages=len(selected_pages),
                    verified_points=0,
                    rejected_points=len(rejected_points),
                    target_min_points=contract.min_points,
                    target_max_points=contract.max_points,
                ),
                status="error",
                provider="gemini",
                depth=req.depth,
                notice=(
                    "AI đã phản hồi nhưng toàn bộ ý bị chặn vì không khớp nguồn."
                    if req.language != "EN"
                    else "The AI responded, but every point was blocked because "
                    "it did not match the source."
                ),
            )

        notice_parts = [
            f"Đã đối chiếu nguồn {len(verified_points)}/{len(parsed['key_points'])} ý."
        ]
        if retried:
            notice_parts.append("Đã tự sửa một lượt để bảo đảm đủ dẫn chứng.")
        if vision_pages:
            notice_parts.append(
                "Đã đối chiếu chữ PDF với ảnh bố cục ở trang "
                + ", ".join(map(str, vision_pages))
                + "."
            )
        if rejected_points:
            notice_parts.append(
                f"Đã ẩn {len(rejected_points)} ý vì nguồn không khớp."
            )
        scope_is_covered = covered_groups >= required_groups
        if not scope_is_covered:
            notice_parts.append(
                f"Các ý mới phủ {covered_groups}/{required_groups} phần bắt buộc."
            )
        meets_target = len(verified_points) >= contract.min_points
        status = (
            "verified"
            if meets_target and scope_is_covered and not rejected_points
            else "partial"
        )

        result = SummaryResponse(
            doc_id=req.doc_id,
            summary=parsed["summary"],
            key_points=[
                SummaryKeyPoint(**point) for point in verified_points
            ],
            scope_description=scope,
            coverage=SummaryCoverage(
                requested_pages=len(selected_pages),
                processed_pages=len(selected_pages),
                verified_points=len(verified_points),
                rejected_points=len(rejected_points),
                target_min_points=contract.min_points,
                target_max_points=contract.max_points,
            ),
            status=status,
            provider="gemini",
            notice=" ".join(notice_parts),
            depth=req.depth,
        )
        _put_cached_summary(cache_key, result)
        return result
    except Exception as error:
        logger.warning("Gemini summary request unavailable (%s)", type(error).__name__)
        mock = _generate_mock_summary(
            req.doc_id,
            scope,
            selected_pages,
            req.language,
            contract,
            req.depth,
        )
        mock.notice = (
            "Dịch vụ AI đang tạm thời không khả dụng. Đã chuyển sang dữ liệu "
            "dự phòng; bạn có thể thử lại sau."
            if req.language != "EN"
            else (
                "The AI service is temporarily unavailable. Fallback data is "
                "shown; please try again later."
            )
        )
        return mock


def _generate_not_applicable_summary(
    doc_id: str,
    scope: str,
    selected_pages: List[Dict[str, Any]],
    language: str,
    contract: SummaryContract,
    depth: str = "standard",
) -> SummaryResponse:
    """Không gọi AI cho trang kết thúc/hành chính không có kiến thức học tập."""
    summary = (
        "This is an administrative or closing slide, so there is no core "
        "learning content to summarize."
        if language == "EN"
        else (
            "Đây là trang hành chính hoặc trang kết thúc, không có kiến thức "
            "trọng tâm cần tóm tắt."
        )
    )
    return SummaryResponse(
        doc_id=doc_id,
        summary=summary,
        key_points=[],
        scope_description=scope,
        coverage=SummaryCoverage(
            requested_pages=len(selected_pages),
            processed_pages=len(selected_pages),
            verified_points=0,
            rejected_points=0,
            target_min_points=contract.min_points,
            target_max_points=contract.max_points,
        ),
        status="not_applicable",
        provider="local",
        notice=(
            "Không gọi AI vì trang này không chứa nội dung học tập cần tóm tắt."
            if language != "EN"
            else "AI was not called because this slide has no learning content "
            "to summarize."
        ),
        depth=depth,
    )


def _generate_mock_summary(
    doc_id: str,
    scope: str,
    selected_pages: List[Dict[str, Any]],
    language: str,
    contract: SummaryContract,
    depth: str = "standard",
) -> SummaryResponse:
    """Dữ liệu dự phòng tối thiểu, không giả vờ là kết quả AI thật."""
    titles = [
        page.get("title", f"Trang {page['page_number']}")
        for page in selected_pages
    ]
    title_preview = "; ".join(titles[:3])

    if language == "EN":
        summary = f"Selected scope: {scope}. Main slide headings: {title_preview}."
    else:
        summary = f"Phạm vi đã chọn: {scope}. Các tiêu đề chính: {title_preview}."

    return SummaryResponse(
        doc_id=doc_id,
        summary=summary,
        key_points=[],
        scope_description=scope,
        coverage=SummaryCoverage(
            requested_pages=len(selected_pages),
            processed_pages=len(selected_pages),
            verified_points=0,
            rejected_points=0,
            target_min_points=contract.min_points,
            target_max_points=contract.max_points,
        ),
        status="fallback",
        provider="mock",
        notice=(
            "[MOCK] Chưa cấu hình GEMINI_API_KEY hoặc GEMINI_MODEL. "
            "Kết quả chỉ liệt kê tiêu đề đã parse, không phải tóm tắt AI."
        ),
        depth=depth,
    )
