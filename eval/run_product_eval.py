"""Đánh giá 25 hành vi người học thật trên phiên bản Slide2Study hiện tại."""

import argparse
import asyncio
import csv
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

REPO_DIR = Path(__file__).resolve().parents[1]
EVAL_DIR = REPO_DIR / "eval"
SERVER_DIR = REPO_DIR / "server"
CASES_PATH = EVAL_DIR / "product-cases.json"
sys.path.insert(0, str(SERVER_DIR))
load_dotenv(SERVER_DIR / ".env")

from app.schemas.note import AINoteRequest  # noqa: E402
from app.schemas.summary import SummaryRequest  # noqa: E402
from app.schemas.tutor import TutorChatRequest  # noqa: E402
from app.services.note_service import generate_ai_note  # noqa: E402
from app.services.pdf_service import get_extracted_data  # noqa: E402
from app.services.summary_service import (  # noqa: E402
    _clear_summary_cache,
    generate_summary,
)
from app.services.tutor_service import chat_with_tutor  # noqa: E402


GENERATIVE_ACTIONS = {
    "summary_generation",
    "ai_note_generation",
    "tutor_followup",
}
SOURCE_CHECKS = {
    "trich_dan_dung_pham_vi",
    "moi_trang_deu_co_dai_dien",
    "dan_chung_khop_pdf",
    "giu_dung_cac_trang_nguon",
    "giu_dung_trang_da_khoanh",
    "giu_nguyen_doan_nguon",
}


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(
        char for char in decomposed
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(
        r"\s+",
        " ",
        without_marks.replace("đ", "d"),
    ).strip()


def percentile(values: list[int], fraction: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(len(ordered) * fraction) - 1)
    return ordered[index]


def term_measure(
    expected_terms: list[str],
    content: str,
) -> tuple[list[str], float]:
    normalized_content = normalize(content)
    matched = [
        term for term in expected_terms
        if normalize(term) in normalized_content
    ]
    recall = len(matched) / len(expected_terms) if expected_terms else 1.0
    return matched, round(recall, 3)


def page_source_text(
    page_number: int,
    pages_by_number: dict[int, dict[str, Any]],
) -> str:
    page = pages_by_number.get(page_number, {})
    return normalize(page.get("clean_text") or page.get("text") or "")


def metadata(product_case: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": product_case["id"],
        "category": product_case["category"],
        "action": product_case["action"],
        "title": product_case["title"],
        "origin": product_case["origin"],
        "origin_reference": product_case.get("origin_reference"),
        "difficulty": product_case["difficulty"],
        "priority": product_case["priority"],
    }


def evaluate_summary(
    product_case: dict[str, Any],
    response: dict[str, Any],
    duration_ms: int,
    pages_by_number: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    points = response.get("key_points") or []
    cited_pages = [
        point.get("page")
        for point in points
        if isinstance(point.get("page"), int)
    ]
    expected_pages = product_case["expected_pages"]
    allowed_range = product_case.get("allowed_page_range")
    if allowed_range:
        citations_in_scope = bool(cited_pages) and all(
            allowed_range[0] <= page <= allowed_range[1]
            for page in cited_pages
        )
    else:
        citations_in_scope = bool(cited_pages) and all(
            page in expected_pages for page in cited_pages
        )

    evidence_grounded = bool(points) and all(
        bool(point.get("evidence_quote"))
        and isinstance(point.get("page"), int)
        and normalize(str(point["evidence_quote"]))
        in page_source_text(point["page"], pages_by_number)
        for point in points
    )
    combined = " ".join(
        [
            response.get("summary", ""),
            *[str(point.get("claim", "")) for point in points],
        ]
    )
    matched_terms, term_recall = term_measure(
        product_case["expected_terms"],
        combined,
    )
    expected_requested_pages = (
        len(pages_by_number)
        if not product_case["request"]
        else len(expected_pages)
    )
    coverage = response.get("coverage") or {}
    direct_answer = not re.search(
        r"\b(?:bạn có muốn|nếu bạn muốn|hãy cho tôi biết|"
        r"bạn có thể cung cấp)\b",
        normalize(response.get("summary", "")),
    )
    checks = {
        "dich_vu_ai_phan_hoi_that": response.get("provider") == "gemini",
        "doc_du_so_trang":
            coverage.get("requested_pages") == expected_requested_pages
            and coverage.get("processed_pages") == expected_requested_pages,
        "trich_dan_dung_pham_vi": citations_in_scope,
        "moi_trang_deu_co_dai_dien":
            (
                set(expected_pages).issubset(set(cited_pages))
                if product_case.get("require_each_page")
                else True
            ),
        "dan_chung_khop_pdf": evidence_grounded,
        "giu_du_y_quan_trong":
            term_recall >= product_case["minimum_term_recall"],
        "tra_loi_thang_khong_hoi_nguoc": bool(direct_answer),
        "dung_do_sau":
            response.get("depth", product_case["depth"])
            == product_case["depth"],
    }
    return {
        **metadata(product_case),
        "passed": all(checks.values()),
        "checks": checks,
        "duration_ms": duration_ms,
        "provider": response.get("provider"),
        "current_behavior": (
            f"{response.get('scope_description')}; đọc "
            f"{coverage.get('processed_pages')}/"
            f"{coverage.get('requested_pages')} trang; trích trang "
            f"{sorted(set(cited_pages))}; giữ "
            f"{len(matched_terms)}/{len(product_case['expected_terms'])} "
            "ý khóa."
        ),
        "actual": {
            "scope": response.get("scope_description"),
            "cited_pages": cited_pages,
            "matched_terms": matched_terms,
            "term_recall": term_recall,
            "coverage": coverage,
            "status": response.get("status"),
            "provider": response.get("provider"),
        },
        "response": response,
    }


def evaluate_note(
    product_case: dict[str, Any],
    response: dict[str, Any],
    duration_ms: int,
) -> dict[str, Any]:
    combined = " ".join(
        [
            response.get("title", ""),
            response.get("summary", ""),
            *response.get("key_takeaways", []),
        ]
    )
    matched_terms, term_recall = term_measure(
        product_case["expected_terms"],
        combined,
    )
    expected_excerpts = [
        selection["text"].strip()
        for selection in product_case["selections"]
        if selection["text"].strip()
    ]
    checks = {
        "dich_vu_ai_phan_hoi_that":
            response.get("provider") == "gemini"
            and response.get("status") == "generated",
        "giu_dung_trang_da_khoanh":
            response.get("source_pages") == product_case["expected_pages"],
        "xac_minh_dung_so_vung":
            response.get("verified_selections")
            == product_case["expected_verified_selections"],
        "giu_nguyen_doan_nguon":
            response.get("source_excerpts") == expected_excerpts,
        "ghi_chu_co_noi_dung":
            bool(response.get("title"))
            and bool(response.get("summary"))
            and bool(response.get("key_takeaways")),
        "giu_du_y_quan_trong":
            term_recall >= product_case["minimum_term_recall"],
    }
    return {
        **metadata(product_case),
        "passed": all(checks.values()),
        "checks": checks,
        "duration_ms": duration_ms,
        "provider": response.get("provider"),
        "current_behavior": (
            f"AI Note từ trang {response.get('source_pages')}; xác minh "
            f"{response.get('verified_selections')}/"
            f"{len(product_case['selections'])} vùng; giữ "
            f"{len(matched_terms)}/{len(product_case['expected_terms'])} "
            "ý khóa."
        ),
        "actual": {
            "source_pages": response.get("source_pages"),
            "verified_selections": response.get("verified_selections"),
            "matched_terms": matched_terms,
            "term_recall": term_recall,
            "provider": response.get("provider"),
            "status": response.get("status"),
        },
        "response": response,
    }


def extract_source_pages(sources: list[str]) -> list[int]:
    pages: list[int] = []
    for source in sources:
        match = re.search(r"Trang\s+(\d+)", source, flags=re.IGNORECASE)
        if match:
            pages.append(int(match.group(1)))
    return pages


def evaluate_tutor(
    product_case: dict[str, Any],
    response: dict[str, Any],
    duration_ms: int,
) -> dict[str, Any]:
    source_pages = extract_source_pages(response.get("sources") or [])
    matched_terms, term_recall = term_measure(
        product_case["expected_terms"],
        response.get("reply", ""),
    )
    checks = {
        "dich_vu_ai_phan_hoi_that": response.get("provider") == "gemini",
        "giu_dung_cac_trang_nguon":
            source_pages == product_case["expected_pages"],
        "giu_du_y_quan_trong":
            term_recall >= product_case["minimum_term_recall"],
        "tra_loi_co_noi_dung": bool(response.get("reply", "").strip()),
    }
    return {
        **metadata(product_case),
        "passed": all(checks.values()),
        "checks": checks,
        "duration_ms": duration_ms,
        "provider": response.get("provider"),
        "current_behavior": (
            f"Tutor dùng nguồn {source_pages}; giữ "
            f"{len(matched_terms)}/{len(product_case['expected_terms'])} "
            "ý khóa."
        ),
        "actual": {
            "source_pages": source_pages,
            "matched_terms": matched_terms,
            "term_recall": term_recall,
            "provider": response.get("provider"),
        },
        "response": response,
    }


async def run_api_case(
    semaphore: asyncio.Semaphore,
    product_case: dict[str, Any],
    pages_by_number: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    async with semaphore:
        started = time.perf_counter()
        try:
            if product_case["action"] == "summary_generation":
                response = await generate_summary(
                    SummaryRequest(
                        doc_id="lesson-01",
                        language="VI",
                        depth=product_case["depth"],
                        **product_case["request"],
                    )
                )
                duration_ms = round(
                    (time.perf_counter() - started) * 1000
                )
                return evaluate_summary(
                    product_case,
                    response.model_dump(),
                    duration_ms,
                    pages_by_number,
                )
            if product_case["action"] == "ai_note_generation":
                response = await generate_ai_note(
                    AINoteRequest(
                        doc_id="lesson-01",
                        language="VI",
                        selections=product_case["selections"],
                    )
                )
                duration_ms = round(
                    (time.perf_counter() - started) * 1000
                )
                return evaluate_note(
                    product_case,
                    response.model_dump(),
                    duration_ms,
                )
            if product_case["action"] == "tutor_followup":
                request = product_case["request"]
                response = await chat_with_tutor(
                    TutorChatRequest(
                        message=product_case["user_input"],
                        page_context=request["page_context"],
                        context_pages=request["context_pages"],
                        prior_answer=request["prior_answer"],
                        language="VI",
                    )
                )
                duration_ms = round(
                    (time.perf_counter() - started) * 1000
                )
                return evaluate_tutor(
                    product_case,
                    response.model_dump(),
                    duration_ms,
                )
            raise ValueError(
                f"Action API không được hỗ trợ: {product_case['action']}"
            )
        except Exception as error:
            return {
                **metadata(product_case),
                "passed": False,
                "checks": {"khong_phat_sinh_loi": False},
                "duration_ms": round(
                    (time.perf_counter() - started) * 1000
                ),
                "provider": None,
                "current_behavior": f"Ca đánh giá phát sinh lỗi: {error}",
                "actual": None,
                "response": None,
                "error": str(error),
            }


def find_node() -> str:
    bundled = sorted(
        (REPO_DIR / ".tools").glob("node-*/node.exe")
    )
    if bundled:
        return str(bundled[-1])
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Không tìm thấy Node.js để chạy các ca giao diện")
    return node


def run_ui_cases() -> list[dict[str, Any]]:
    tsx_cli = (
        REPO_DIR
        / "client"
        / "node_modules"
        / "tsx"
        / "dist"
        / "cli.mjs"
    )
    if not tsx_cli.exists():
        raise RuntimeError(
            "Thiếu client/node_modules. Hãy cài dependency trước khi chạy eval."
        )
    completed = subprocess.run(
        [
            find_node(),
            str(tsx_cli),
            str(EVAL_DIR / "evaluate_product_ui.ts"),
            str(CASES_PATH),
        ],
        cwd=REPO_DIR,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(completed.stdout)


def git_snapshot() -> tuple[str, bool]:
    try:
        revision = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_DIR,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=REPO_DIR,
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            ).stdout.strip()
        )
        return revision, dirty
    except Exception:
        return "unknown", True


def summarize_results(
    variant: str,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    by_category: dict[str, dict[str, int | float]] = {}
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in results:
        grouped[result["category"]].append(result)
    for category, category_results in grouped.items():
        passed = sum(result["passed"] for result in category_results)
        by_category[category] = {
            "case_count": len(category_results),
            "passed": passed,
            "failed": len(category_results) - passed,
            "pass_rate": round(passed / len(category_results), 3),
        }

    generative = [
        result for result in results
        if result["action"] in GENERATIVE_ACTIONS
    ]
    generative_durations = [
        result["duration_ms"] for result in generative
    ]
    all_checks = [
        value
        for result in results
        for value in result["checks"].values()
    ]
    source_checks = [
        value
        for result in results
        for key, value in result["checks"].items()
        if key in SOURCE_CHECKS
    ]
    revision, dirty = git_snapshot()
    passed = sum(result["passed"] for result in results)
    return {
        "variant": variant,
        "run_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "git_revision": revision,
        "working_tree_dirty": dirty,
        "model": os.getenv("AI_MODEL", "unknown"),
        "case_count": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "pass_rate": round(passed / len(results), 3),
        "check_pass_rate": round(
            sum(all_checks) / len(all_checks) if all_checks else 0,
            3,
        ),
        "by_category": by_category,
        "chatlog_or_observed_case_count": sum(
            result["origin"] in {
                "chatlog",
                "chatlog_pattern",
                "observed_bug",
                "product_requirement",
            }
            for result in results
        ),
        "generative_case_count": len(generative),
        "real_ai_response_rate": round(
            sum(
                result.get("provider") == "gemini"
                for result in generative
            ) / len(generative)
            if generative else 0,
            3,
        ),
        "source_check_pass_rate": round(
            sum(source_checks) / len(source_checks)
            if source_checks else 0,
            3,
        ),
        "generative_latency_p50_ms": percentile(
            generative_durations,
            0.5,
        ),
        "generative_latency_p95_ms": percentile(
            generative_durations,
            0.95,
        ),
        "failed_case_ids": [
            result["id"] for result in results if not result["passed"]
        ],
    }


def write_reports(
    variant: str,
    cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    write_log: bool,
) -> dict[str, Any]:
    results_dir = EVAL_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    case_lookup = {case["id"]: case for case in cases}

    trace_payload = [
        {
            "case": case_lookup[result["id"]],
            "evaluation": result,
        }
        for result in results
    ]
    (results_dir / f"{variant}-traces.json").write_text(
        json.dumps(trace_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    summary = summarize_results(variant, results)
    (results_dir / f"{variant}-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    fields = [
        "id",
        "category",
        "title",
        "origin",
        "origin_reference",
        "difficulty",
        "priority",
        "passed",
        "provider",
        "duration_ms",
        "checks_passed",
        "checks_total",
        "failed_checks",
        "current_behavior",
    ]
    with (results_dir / f"{variant}-cases.csv").open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for result in results:
            checks = result["checks"]
            writer.writerow({
                **{
                    field: result.get(field)
                    for field in fields
                    if field not in {
                        "checks_passed",
                        "checks_total",
                        "failed_checks",
                    }
                },
                "checks_passed": sum(checks.values()),
                "checks_total": len(checks),
                "failed_checks": ", ".join(
                    key for key, value in checks.items() if not value
                ),
            })

    report_lines = [
        f"# Kết quả product eval — {variant}",
        "",
        (
            f"> Snapshot lúc {summary['run_at']} trên commit "
            f"`{summary['git_revision']}`"
            + (" với working tree chưa commit." if summary["working_tree_dirty"]
               else ".")
        ),
        "",
        (
            "Đây là số đo của phiên bản hiện tại, không phải mục tiêu đã "
            "được làm đẹp. Một ca chỉ đạt khi tất cả điều kiện quan trọng "
            "của hành vi đó cùng đạt."
        ),
        "",
        "## Chỉ số tổng",
        "",
        "| Chỉ số | Kết quả |",
        "|---|---:|",
        f"| Ca đạt hoàn toàn | {summary['passed']}/{summary['case_count']} ({summary['pass_rate']:.1%}) |",
        f"| Điều kiện nhỏ đạt | {summary['check_pass_rate']:.1%} |",
        f"| Ca dùng phản hồi AI thật | {summary['real_ai_response_rate']:.1%} |",
        f"| Kiểm tra phạm vi/nguồn đạt | {summary['source_check_pass_rate']:.1%} |",
        f"| Độ trễ AI trung vị | {summary['generative_latency_p50_ms']} ms |",
        f"| Độ trễ AI p95 | {summary['generative_latency_p95_ms']} ms |",
        "",
        "## Theo nhóm hành vi",
        "",
        "| Nhóm | Đạt | Tổng | Tỷ lệ |",
        "|---|---:|---:|---:|",
    ]
    for category, values in summary["by_category"].items():
        report_lines.append(
            f"| {category} | {values['passed']} | "
            f"{values['case_count']} | {values['pass_rate']:.1%} |"
        )

    report_lines.extend([
        "",
        "## Nhật ký 25 ca",
        "",
        "| Mã | Hành vi thực tế | Kết quả | Phiên bản hiện tại làm gì |",
        "|---|---|---|---|",
    ])
    for result in results:
        outcome = "Đạt" if result["passed"] else "Chưa đạt"
        behavior = result["current_behavior"].replace("|", "\\|")
        report_lines.append(
            f"| {result['id']} | {result['title']} | {outcome} | "
            f"{behavior} |"
        )

    failures = [result for result in results if not result["passed"]]
    report_lines.extend([
        "",
        "## Những điểm phiên bản hiện tại chưa đạt",
        "",
    ])
    if not failures:
        report_lines.append("- Chưa ghi nhận ca thất bại trong lượt chạy này.")
    else:
        for result in failures:
            failed_checks = [
                key.replace("_", " ")
                for key, value in result["checks"].items()
                if not value
            ]
            report_lines.append(
                f"- **{result['id']} — {result['title']}:** "
                + ", ".join(failed_checks)
                + f". {result['current_behavior']}"
            )
    report_lines.extend([
        "",
        "## Cách đọc kết quả",
        "",
        "- CSV dùng để lọc nhanh theo nhóm, độ khó, nguồn ca và lỗi.",
        f"- `{variant}-traces.json` giữ nguyên đầu vào, đầu ra và từng điều kiện chấm.",
        "- Kết quả AI có thể dao động giữa các lượt; mỗi lượt phải được ghi với thời gian và commit.",
        "- Không có tên hay nội dung nhận diện cá nhân từ chat log trong bộ eval.",
        "",
    ])
    report_path = results_dir / f"{variant}-report.md"
    report_path.write_text(
        "\n".join(report_lines),
        encoding="utf-8",
    )

    if write_log:
        log_path = EVAL_DIR / "EVAL_LOG.md"
        if not log_path.exists():
            log_path.write_text(
                "# Nhật ký đánh giá sản phẩm\n\n",
                encoding="utf-8",
            )
        with log_path.open("a", encoding="utf-8") as log:
            log.write(
                f"## {summary['run_at']} — {variant}\n\n"
                f"- Commit: `{summary['git_revision']}`; "
                f"working tree chưa commit: "
                f"{'có' if summary['working_tree_dirty'] else 'không'}.\n"
                f"- Kết quả: {summary['passed']}/{summary['case_count']} "
                f"ca đạt ({summary['pass_rate']:.1%}).\n"
                f"- Ca chưa đạt: "
                f"{', '.join(summary['failed_case_ids']) or 'không có'}.\n"
                f"- Báo cáo: `results/{variant}-report.md`.\n\n"
            )
    return summary


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", default="product-current")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--write-log", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.variant):
        raise ValueError("Tên variant chỉ được chứa chữ, số, gạch ngang/gạch dưới")

    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    if len(cases) != 25:
        raise ValueError(f"Bộ product eval phải có 25 ca, hiện có {len(cases)}")
    if len({case["id"] for case in cases}) != len(cases):
        raise ValueError("Mã ca đánh giá bị trùng")

    extracted = get_extracted_data("lesson-01")
    pages_by_number = {
        page["page_number"]: page
        for page in extracted.get("pages", [])
    }
    _clear_summary_cache()
    ui_results = run_ui_cases()
    api_cases = [
        case for case in cases
        if case["action"] in GENERATIVE_ACTIONS
    ]
    semaphore = asyncio.Semaphore(args.concurrency)
    api_results = await asyncio.gather(*(
        run_api_case(semaphore, case, pages_by_number)
        for case in api_cases
    ))
    results = [*ui_results, *api_results]
    results.sort(key=lambda item: int(item["id"][1:]))
    summary = write_reports(
        args.variant,
        cases,
        results,
        args.write_log,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
