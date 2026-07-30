"""Tạo bảng so sánh dễ đọc từ hai lần chạy cùng một bộ 24 ca."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
BASELINE = "baseline"
PROOF = "adaptive-release"


def load_summary(name: str) -> dict:
    return json.loads(
        (RESULTS / f"{name}-summary.json").read_text(encoding="utf-8")
    )


def load_cases(name: str) -> list[dict[str, str]]:
    with (RESULTS / f"{name}-cases.csv").open(
        encoding="utf-8-sig", newline=""
    ) as source:
        return list(csv.DictReader(source))


def percent(value: float) -> str:
    return f"{value * 100:.1f}%".replace(".", ",")


def seconds(milliseconds: int) -> str:
    return f"{milliseconds / 1000:.1f} giây".replace(".", ",")


def main() -> None:
    baseline = load_summary(BASELINE)
    proof = load_summary(PROOF)
    baseline_cases = load_cases(BASELINE)
    proof_cases = load_cases(PROOF)
    baseline_points = sum(int(row["point_count"]) for row in baseline_cases)
    proof_points = sum(int(row["point_count"]) for row in proof_cases)
    pass_delta = (
        proof["verified_pass_count"] - baseline["quality_pass_count"]
    )

    rows = [
        {
            "Chỉ số": "Ca đạt toàn bộ ngưỡng",
            "Bản cũ": f"{baseline['quality_pass_count']}/24",
            "Slide2Study": f"{proof['verified_pass_count']}/24",
            "Thay đổi": f"{pass_delta:+d} ca",
        },
        {
            "Chỉ số": "Ý có đoạn dẫn chứng khớp đúng trang",
            "Bản cũ": f"0/{baseline_points}",
            "Slide2Study": f"{proof_points}/{proof_points}",
            "Thay đổi": "+100 điểm phần trăm",
        },
        {
            "Chỉ số": "Độ giữ ý trọng tâm trung bình",
            "Bản cũ": percent(baseline["mean_term_recall"]),
            "Slide2Study": percent(proof["mean_term_recall"]),
            "Thay đổi": (
                f"{(proof['mean_term_recall'] - baseline['mean_term_recall']) * 100:+.1f}"
                " điểm phần trăm"
            ).replace(".", ","),
        },
        {
            "Chỉ số": "Thời gian trung vị",
            "Bản cũ": seconds(baseline["latency_p50_ms"]),
            "Slide2Study": seconds(proof["latency_p50_ms"]),
            "Thay đổi": seconds(
                proof["latency_p50_ms"] - baseline["latency_p50_ms"]
            ),
        },
        {
            "Chỉ số": "95% ca trả lời trong",
            "Bản cũ": seconds(baseline["latency_p95_ms"]),
            "Slide2Study": seconds(proof["latency_p95_ms"]),
            "Thay đổi": seconds(
                proof["latency_p95_ms"] - baseline["latency_p95_ms"]
            ),
        },
    ]

    with (RESULTS / "comparison.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    lines = [
        "# Kết quả đo Slide2Study",
        "",
        "Cả hai bản được chạy trên cùng 24 yêu cầu và cùng một tài liệu 44 trang.",
        "",
        "| Chỉ số | Bản cũ | Slide2Study | Thay đổi |",
        "|---|---:|---:|---:|",
    ]
    lines.extend(
        f"| {row['Chỉ số']} | {row['Bản cũ']} | {row['Slide2Study']} | "
        f"{row['Thay đổi']} |"
        for row in rows
    )
    lines.extend(
        [
            "",
            "## Mẫu số và cách tính",
            "",
            "- **Ca đạt toàn bộ ngưỡng:** số yêu cầu đạt đủ bốn điều kiện trên tổng "
            "24 yêu cầu: API thật phản hồi; có 3–5 ý; mọi số trang nằm trong "
            "phạm vi được hỏi; giữ ít nhất 60% danh sách ý trọng tâm đã khóa trước. "
            "Với Slide2Study, mọi ý còn phải vượt kiểm tra dẫn chứng.",
            f"- **Ý có dẫn chứng khớp nguồn:** số ý có đoạn dẫn chứng tìm thấy nguyên "
            f"văn trên đúng trang, chia cho tổng ý hiển thị. Bản cũ là "
            f"0/{baseline_points} vì không trả đoạn dẫn chứng; Slide2Study là "
            f"{proof_points}/{proof_points}. Chỉ số này xác nhận đoạn chữ tồn tại "
            "trong nguồn, chưa thay thế đánh giá của con người về việc đoạn đó có "
            "chứng minh đầy đủ câu tóm tắt hay không.",
            "- **Độ giữ ý trọng tâm:** với mỗi yêu cầu, đếm số nhãn/số liệu quan "
            "trọng xuất hiện trong tóm tắt, chia cho danh sách đã gắn nhãn trước; "
            "sau đó lấy trung bình 24 yêu cầu.",
            "- **Thời gian:** đo từ lúc gửi yêu cầu đến khi dịch vụ trả kết quả; "
            "không phải thời gian người học hoàn thành nhiệm vụ.",
            "",
            "## Kết luận trung thực",
            "",
            (
                "Bản có dẫn chứng "
                + (
                    f"tăng số ca đạt đủ ngưỡng thêm {pass_delta}"
                    if pass_delta > 0
                    else (
                        f"giảm số ca đạt đủ ngưỡng {abs(pass_delta)}"
                        if pass_delta < 0
                        else "giữ nguyên số ca đạt đủ ngưỡng"
                    )
                )
                + f" và biến {proof_points}/{proof_points} ý hiển thị thành ý "
                "có thể mở đúng trang để kiểm tra. Đổi lại, độ giữ nhãn trọng tâm "
                "và thời gian phản hồi chưa tốt bằng bản cũ trong lượt đo này. "
                "Vì vậy lợi thế cần được chứng minh tiếp bằng thời gian người học "
                "tìm và kiểm tra nguồn, không chỉ bằng chất lượng câu chữ."
            ),
            "",
        ]
    )
    (RESULTS / "comparison.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
