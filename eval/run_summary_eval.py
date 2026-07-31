"""Run reproducible Slide2Study evaluation against the real summary service."""

import argparse
import asyncio
import csv
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


REPO_DIR = Path(__file__).resolve().parents[1]
SERVER_DIR = REPO_DIR / "server"
sys.path.insert(0, str(SERVER_DIR))
load_dotenv(SERVER_DIR / ".env")

from app.schemas.summary import SummaryRequest  # noqa: E402
from app.services.pdf_service import get_extracted_data  # noqa: E402
from app.services.summary_service import generate_summary  # noqa: E402


PAGE_PATTERN = re.compile(r"(?:Trang|Page)\s+(\d+)", re.IGNORECASE)


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"\s+", " ", without_marks.replace("đ", "d")).strip()


def point_payload(point: Any) -> dict[str, Any]:
    if hasattr(point, "model_dump"):
        return point.model_dump()
    if isinstance(point, dict):
        return point
    text = str(point)
    match = PAGE_PATTERN.search(text)
    return {
        "claim": PAGE_PATTERN.sub("", text).strip(" —-"),
        "page": int(match.group(1)) if match else None,
        "evidence_quote": None,
        "verified": False,
    }


def evaluate_case(
    case: dict[str, Any],
    response: dict[str, Any],
    duration_ms: int,
    pages_by_number: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    points = [point_payload(point) for point in response.get("key_points", [])]
    requested = set(case["expected_pages"])
    allowed_range = case.get("allowed_page_range")
    cited_pages = [
        point.get("page") for point in points if isinstance(point.get("page"), int)
    ]
    if allowed_range:
        citation_valid = bool(cited_pages) and all(
            allowed_range[0] <= page <= allowed_range[1] for page in cited_pages
        )
    else:
        citation_valid = bool(cited_pages) and all(
            page in requested for page in cited_pages
        )

    evidence_matches = 0
    verified_points = 0
    for point in points:
        page_number = point.get("page")
        quote = point.get("evidence_quote")
        verified_points += int(bool(point.get("verified")))
        if not isinstance(page_number, int) or not quote:
            continue
        page = pages_by_number.get(page_number, {})
        source = normalize(page.get("clean_text") or page.get("text") or "")
        if normalize(str(quote)) in source:
            evidence_matches += 1

    combined = normalize(
        response.get("summary", "")
        + " "
        + " ".join(str(point.get("claim", "")) for point in points)
    )
    matched_terms = [
        term for term in case["expected_terms"] if normalize(term) in combined
    ]
    term_recall = len(matched_terms) / len(case["expected_terms"])
    point_count_pass = 3 <= len(points) <= 5
    source_match_rate = evidence_matches / len(points) if points else 0.0
    verified_rate = verified_points / len(points) if points else 0.0
    provider_real = response.get("provider") == "gemini"
    quality_pass = (
        provider_real
        and citation_valid
        and point_count_pass
        and term_recall >= 0.6
    )
    verified_pass = quality_pass and source_match_rate == 1.0 and verified_rate == 1.0

    return {
        "id": case["id"],
        "label": case["label"],
        "provider": response.get("provider"),
        "scope": response.get("scope_description"),
        "point_count": len(points),
        "point_count_pass": point_count_pass,
        "citation_valid": citation_valid,
        "source_match_rate": round(source_match_rate, 3),
        "verified_rate": round(verified_rate, 3),
        "term_recall": round(term_recall, 3),
        "matched_terms": matched_terms,
        "duration_ms": duration_ms,
        "quality_pass": quality_pass,
        "verified_pass": verified_pass,
        "notice": response.get("notice"),
        "response": response,
    }


async def run_case(
    semaphore: asyncio.Semaphore,
    case: dict[str, Any],
    pages_by_number: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    async with semaphore:
        started = time.perf_counter()
        response = await generate_summary(
            SummaryRequest(
                doc_id="lesson-01",
                language="VI",
                **case["request"],
            )
        )
        duration_ms = round((time.perf_counter() - started) * 1000)
        return evaluate_case(
            case,
            response.model_dump(),
            duration_ms,
            pages_by_number,
        )


def write_reports(variant: str, results: list[dict[str, Any]]) -> dict[str, Any]:
    output_dir = REPO_DIR / "eval" / "results"
    trace_dir = REPO_DIR / "eval" / "traces" / variant
    output_dir.mkdir(parents=True, exist_ok=True)
    trace_dir.mkdir(parents=True, exist_ok=True)

    for result in results:
        (trace_dir / f"{result['id']}.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    quality_passes = sum(result["quality_pass"] for result in results)
    verified_passes = sum(result["verified_pass"] for result in results)
    total_points = sum(result["point_count"] for result in results)
    weighted_source_matches = sum(
        result["source_match_rate"] * result["point_count"] for result in results
    )
    durations = sorted(result["duration_ms"] for result in results)
    summary = {
        "variant": variant,
        "case_count": len(results),
        "quality_pass_count": quality_passes,
        "quality_pass_rate": round(quality_passes / len(results), 3),
        "verified_pass_count": verified_passes,
        "verified_pass_rate": round(verified_passes / len(results), 3),
        "citation_valid_rate": round(
            sum(result["citation_valid"] for result in results) / len(results),
            3,
        ),
        "evidence_source_match_rate": round(
            weighted_source_matches / total_points if total_points else 0,
            3,
        ),
        "mean_term_recall": round(
            sum(result["term_recall"] for result in results) / len(results),
            3,
        ),
        "latency_p50_ms": durations[len(durations) // 2],
        "latency_p95_ms": durations[min(len(durations) - 1, int(len(durations) * 0.95))],
    }
    (output_dir / f"{variant}-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    csv_fields = [
        "id",
        "label",
        "provider",
        "scope",
        "point_count",
        "point_count_pass",
        "citation_valid",
        "source_match_rate",
        "verified_rate",
        "term_recall",
        "duration_ms",
        "quality_pass",
        "verified_pass",
        "notice",
    ]
    with (output_dir / f"{variant}-cases.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as output:
        writer = csv.DictWriter(output, fieldnames=csv_fields)
        writer.writeheader()
        for result in results:
            writer.writerow({field: result.get(field) for field in csv_fields})

    return summary


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", required=True)
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Maximum simultaneous Gemini requests (default: 1 to avoid provider overload).",
    )
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    cases = json.loads(
        (REPO_DIR / "eval" / "golden-set.json").read_text(encoding="utf-8")
    )
    if args.limit:
        cases = cases[: args.limit]
    extracted = get_extracted_data("lesson-01")
    pages_by_number = {
        page["page_number"]: page for page in extracted.get("pages", [])
    }
    semaphore = asyncio.Semaphore(args.concurrency)
    results = await asyncio.gather(
        *(run_case(semaphore, case, pages_by_number) for case in cases)
    )
    results.sort(key=lambda result: result["id"])
    summary = write_reports(args.variant, results)
    print(json.dumps(summary, ensure_ascii=True))


if __name__ == "__main__":
    asyncio.run(main())
