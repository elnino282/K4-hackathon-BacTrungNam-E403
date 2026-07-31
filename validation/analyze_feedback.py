"""Tổng hợp test 5 người; dừng nếu bảng còn thiếu dữ liệu bắt buộc."""

import csv
import statistics
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "feedback-log.csv"
OUTPUT = ROOT / "result.md"
REQUIRED = [
    "pdf_seconds",
    "pdf_success",
    "pdf_navigation_actions",
    "pdf_unsupported_claim",
    "pdf_confidence",
    "proof_seconds",
    "proof_success",
    "proof_navigation_actions",
    "proof_unsupported_claim",
    "proof_confidence",
    "prefer_proof",
]


def yes(value: str) -> bool:
    return value.strip().casefold() in {"1", "true", "yes", "y", "có", "co"}


def main() -> None:
    with INPUT.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    missing = [
        f"{row['participant_id']}:{field}"
        for row in rows
        for field in REQUIRED
        if not row[field].strip()
    ]
    invalid_numbers = []
    for row in rows:
        for field in (
            "pdf_seconds",
            "pdf_navigation_actions",
            "pdf_confidence",
            "proof_seconds",
            "proof_navigation_actions",
            "proof_confidence",
        ):
            try:
                float(row[field])
            except ValueError:
                invalid_numbers.append(f"{row['participant_id']}:{field}")

    if invalid_numbers:
        details = ", ".join(invalid_numbers[:8])
        raise SystemExit(
            f"Invalid numeric values: {details}"
            + ("..." if len(invalid_numbers) > 8 else "")
        )

    if len(rows) != 5 or missing:
        details = ", ".join(missing[:8])
        raise SystemExit(
            f"Chưa đủ 5 mẫu hoàn chỉnh. Ô còn thiếu: {details}"
            + ("..." if len(missing) > 8 else "")
        )

    pdf_times = [float(row["pdf_seconds"]) for row in rows]
    proof_times = [float(row["proof_seconds"]) for row in rows]
    pdf_median = statistics.median(pdf_times)
    proof_median = statistics.median(proof_times)
    time_reduction = (pdf_median - proof_median) / pdf_median
    proof_successes = sum(yes(row["proof_success"]) for row in rows)
    unsupported = sum(yes(row["proof_unsupported_claim"]) for row in rows)
    preferences = sum(yes(row["prefer_proof"]) for row in rows)
    passes = [
        time_reduction >= 0.30,
        proof_successes >= 4,
        unsupported == 0,
        preferences >= 4,
    ]

    report = f"""# Kết quả kiểm chứng 5 người

| Chỉ số | Kết quả | Ngưỡng |
|---|---:|---:|
| Trung vị đọc PDF | {pdf_median:.0f} giây | — |
| Trung vị dùng Slide2Study | {proof_median:.0f} giây | — |
| Mức giảm thời gian | {time_reduction:.0%} | ≥30% |
| Hoàn thành đúng với Slide2Study | {proof_successes}/5 | ≥4/5 |
| Chấp nhận ý không được nguồn hỗ trợ | {unsupported}/5 | 0/5 |
| Chọn dùng cho lần học tiếp theo | {preferences}/5 | ≥4/5 |

**Quyết định:** {"ĐÁNG ĐI TIẾP" if all(passes) else "CHƯA ĐỦ BẰNG CHỨNG"}.

Đây là tín hiệu định hướng từ 5 người, không phải kết luận thống kê cho toàn bộ
học viên.
"""
    OUTPUT.write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
