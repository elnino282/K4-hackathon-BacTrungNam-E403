import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


MIN_EVIDENCE_CHARACTERS = 12
TARGET_PASSAGE_CHARACTERS = 360
MAX_PASSAGE_CHARACTERS = 520
NUMBER_PATTERN = re.compile(
    r"(?<![\w.])\d+(?:[.,]\d+)*(?:%|(?=[^\w.%]|$))"
)


def normalize_evidence_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = (
        normalized.replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("–", "-")
        .replace("—", "-")
    )
    return re.sub(r"\s+", " ", normalized).strip(" \t\r\n\"'")


def _split_long_text(text: str) -> List[str]:
    """Split an unusually long PDF line without losing or inventing text."""
    words = text.split()
    if not words:
        return []

    chunks: List[str] = []
    current: List[str] = []
    current_length = 0
    for word in words:
        extra = len(word) + (1 if current else 0)
        if current and current_length + extra > MAX_PASSAGE_CHARACTERS:
            chunks.append(" ".join(current))
            current = [word]
            current_length = len(word)
        else:
            current.append(word)
            current_length += extra
    if current:
        chunks.append(" ".join(current))
    return chunks


def build_source_passages(
    selected_pages: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Create deterministic, page-scoped passages for citation by ID."""
    passages: List[Dict[str, Any]] = []

    for page in selected_pages:
        page_number = page["page_number"]
        raw_text = str(page.get("clean_text") or page.get("text") or "")
        segments: List[str] = []
        for line in raw_text.splitlines():
            compact = re.sub(r"\s+", " ", line).strip()
            if not compact:
                continue
            if len(compact) > MAX_PASSAGE_CHARACTERS:
                segments.extend(_split_long_text(compact))
            else:
                segments.append(compact)

        page_chunks: List[str] = []
        current: List[str] = []
        current_length = 0
        for segment in segments:
            extra = len(segment) + (1 if current else 0)
            should_flush = (
                bool(current)
                and (
                    current_length + extra > MAX_PASSAGE_CHARACTERS
                    or (
                        current_length >= TARGET_PASSAGE_CHARACTERS
                        and len(segment) >= 80
                    )
                )
            )
            if should_flush:
                page_chunks.append("\n".join(current))
                current = []
                current_length = 0

            current.append(segment)
            current_length += len(segment) + (1 if current_length else 0)

            if current_length >= MAX_PASSAGE_CHARACTERS:
                page_chunks.append("\n".join(current))
                current = []
                current_length = 0

        if current:
            page_chunks.append("\n".join(current))

        for passage_index, passage_text in enumerate(page_chunks, start=1):
            passages.append(
                {
                    "source_id": f"p{page_number:03d}-{passage_index:03d}",
                    "page": page_number,
                    "text": passage_text,
                }
            )

    return passages


def _canonical_number(token: str) -> str:
    return token.replace(",", ".").replace(" ", "")


def _numbers_missing_from_evidence(claim: str, evidence: str) -> List[str]:
    claim_numbers = {
        _canonical_number(match.group(0))
        for match in NUMBER_PATTERN.finditer(claim)
    }
    evidence_numbers = {
        _canonical_number(match.group(0))
        for match in NUMBER_PATTERN.finditer(evidence)
    }
    return sorted(claim_numbers - evidence_numbers)


def verify_key_points(
    raw_points: List[Dict[str, Any]],
    selected_pages: List[Dict[str, Any]],
    source_passages: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Keep only points linked to an exact source passage or quote."""
    page_lookup = {
        page["page_number"]: normalize_evidence_text(
            page.get("clean_text") or page.get("text") or ""
        )
        for page in selected_pages
    }
    passages = (
        source_passages
        if source_passages is not None
        else build_source_passages(selected_pages)
    )
    passage_lookup = {
        passage["source_id"]: passage
        for passage in passages
    }
    verified: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for index, point in enumerate(raw_points):
        claim = str(point.get("claim") or "").strip()
        page = point.get("page")
        source_id = str(point.get("source_id") or "").strip() or None
        supplied_quote = str(point.get("evidence_quote") or "").strip()
        quote = supplied_quote
        verification_method = "normalized_exact_source_match"
        reason = None

        if not claim:
            reason = "missing_claim"
        elif not isinstance(page, int) or page not in page_lookup:
            reason = "page_outside_scope"
        elif source_id:
            source = passage_lookup.get(source_id)
            if source is None:
                reason = "source_id_not_found"
            elif source["page"] != page:
                reason = "source_id_page_mismatch"
            else:
                quote = str(source["text"])
                verification_method = "source_id_exact_source_match"
        elif len(normalize_evidence_text(quote)) < MIN_EVIDENCE_CHARACTERS:
            reason = "evidence_too_short"
        elif normalize_evidence_text(quote) not in page_lookup[page]:
            reason = "evidence_not_found_on_page"

        missing_numbers: List[str] = []
        if reason is None:
            missing_numbers = _numbers_missing_from_evidence(claim, quote)
            if missing_numbers:
                reason = "claim_number_not_in_evidence"

        if reason:
            rejected.append(
                {
                    "index": index,
                    "claim": claim,
                    "page": page,
                    "source_id": source_id,
                    "evidence_quote": supplied_quote,
                    "reason": reason,
                    "missing_numbers": missing_numbers,
                }
            )
            continue

        verified.append(
            {
                "claim": claim,
                "page": page,
                "source_id": source_id,
                "evidence_quote": quote,
                "verified": True,
                "verification_method": verification_method,
            }
        )

    return verified, rejected
