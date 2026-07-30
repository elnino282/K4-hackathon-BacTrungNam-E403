"""Tái lập số liệu evidence §1 của spec.md — đếm "yêu cầu tóm tắt phạm vi rộng"
trong chatlog VLearn và so với nhóm đối chứng "giải thích đoạn đang chọn".

Chạy:  python eval/mining/mine_broad_summary.py
       (Windows, nếu console lỗi unicode:  set PYTHONIOENCODING=utf-8)

Quy tắc xếp loại — trùng khớp spec.md §1 "Phương pháp đếm":
  1 turn = 1 tin student + 1 tin tutor (ghép theo turn_id).
  Format tin student:  (Trang N, đoạn được chọn: "<đoạn>")\\n<câu hỏi>
  Khi học viên gõ vào hộp chat mà KHÔNG bôi đen, platform echo lại chính câu
  vừa gõ vào ô `đoạn được chọn` -> dùng làm dấu hiệu "không có đoạn chọn thật".

  A) "Yêu cầu tóm tắt phạm vi rộng" = (có từ khoá tóm tắt)
                                    & (có từ khoá phạm vi rộng)
                                    & (không có đoạn bôi đen thật)
  B) Nhóm đối chứng "giải thích đoạn đang chọn" = có đoạn bôi đen thật.

Số liệu spec.md §1 được sinh từ đúng file này (chatlog 22/07 -> 29/07/2026,
2.522 dòng / 1.261 turn / 369 user / 585 hội thoại).
"""

import collections
import csv
import os
import re
import sys

CSV_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "data", "vlearn-pack", "chatlog", "chat_history_anonymized_for_hackathon.csv",
)

SELECTION_RE = re.compile(r'^\(Trang (\d+), đoạn được chọn: "(.*?)"\)\s*(.*)$', re.S)

SUMMARY_KW = [
    "tóm tắt", "tóm lại", "tóm gọn", "tổng hợp", "tổng kết", "summar",
    "ôn tập", "ôn lại", "khái quát", "overview", "nội dung chính",
    "ý chính", "điểm chính", "trọng tâm", "keyword cần nhớ",
]

SCOPE_KW = [
    "toàn bộ", "tất cả", "cả slide", "hết slide", "hết slice", "slide này",
    "slide sau", "bài này", "bài học", "buổi học", "buổi này", "hôm nay",
    "tài liệu", "day 0", "day0", "lesson", "chương", "toàn slide",
    "các slide", "slide bài giảng", "nội dung slide", "của slide",
    "trong slide", "bài giảng",
]

# Mở đầu bằng lời xin lỗi / từ chối — soát trên 220 ký tự đầu của câu trả lời.
APOLOGY_KW = [
    "xin lỗi", "rất tiếc", "tiếc là", "sorry", "không tìm thấy", "chưa tìm thấy",
    "không thể", "chưa thể", "không có quyền truy cập",
]


def norm(text):
    return re.sub(r"\s+", " ", text.lower()).strip()


def parse_student_message(content):
    """-> (page, selected_text, question). selected_text=None nếu không match format."""
    m = SELECTION_RE.match(content.strip())
    if not m:
        return None, None, content.strip()
    return int(m.group(1)), m.group(2).strip(), m.group(3).strip()


def has_real_selection(selected, question):
    """False khi ô `đoạn được chọn` chỉ là echo của câu vừa gõ."""
    if selected is None:
        return False
    s, q = norm(selected), norm(question)
    if not s:
        return False
    return not (s == q or s in q or q in s)


def load_turns(path):
    csv.field_size_limit(10 ** 9)
    with open(path, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    turns = collections.OrderedDict()
    for row in rows:
        turns.setdefault(row["turn_id"], {})[row["role"]] = row
    return rows, turns


def classify(turns):
    broad, control = [], []
    for turn_id, pair in turns.items():
        student, tutor = pair.get("student"), pair.get("tutor")
        if not student or not tutor:
            continue
        page, selected, question = parse_student_message(student["content"])
        real_selection = has_real_selection(selected, question)
        haystack = norm(question + " " + (selected or ""))
        record = {
            "turn_id": turn_id,
            "conversation_id": student["conversation_id"],
            "user_id": student["user_id"],
            "page": page,
            "question": question,
            "reply": tutor["content"],
            "citations": tutor["citations"],
            "move_used": tutor["move_used"],
            "rating": tutor["rating"],
        }
        is_summary = any(k in haystack for k in SUMMARY_KW)
        is_broad_scope = any(k in haystack for k in SCOPE_KW)
        if is_summary and is_broad_scope and not real_selection:
            broad.append(record)
        elif real_selection:
            control.append(record)
    return broad, control


def opens_with_apology(reply):
    return any(k in norm(reply)[:220] for k in APOLOGY_KW)


def has_citation(citations):
    return (citations or "").strip() not in ("[]", "", "null")


def report(label, records):
    n = len(records)
    if not n:
        print(f"\n== {label}: 0 case")
        return
    apology = [r for r in records if opens_with_apology(r["reply"])]
    cited = [r for r in records if has_citation(r["citations"])]
    downvoted = [r for r in records if r["rating"] == "down"]
    print(f"\n== {label}")
    print(f"   lượt (turn)           : {n}")
    print(f"   hội thoại             : {len({r['conversation_id'] for r in records})}")
    print(f"   user riêng biệt       : {len({r['user_id'] for r in records})}")
    print(f"   mở đầu xin lỗi/từ chối: {len(apology)}/{n} = {len(apology) / n:.0%}")
    print(f"   có nguồn trang        : {len(cited)}/{n} = {len(cited) / n:.0%}")
    print(f"   rating = down         : {len(downvoted)}/{n}")
    return apology


def main():
    rows, turns = load_turns(CSV_PATH)
    print(f"Nguồn : {os.path.normpath(CSV_PATH)}")
    print(f"Dòng  : {len(rows)} | turn: {len(turns)} | "
          f"user: {len({r['user_id'] for r in rows})} | "
          f"hội thoại: {len({r['conversation_id'] for r in rows})}")

    broad, control = classify(turns)
    apology = report("A · YÊU CẦU TÓM TẮT PHẠM VI RỘNG", broad)
    report("B · ĐỐI CHỨNG: GIẢI THÍCH ĐOẠN ĐANG CHỌN", control)

    tutor_rows = [r for r in rows if r["role"] == "tutor"]
    empty = sum(1 for r in tutor_rows if not has_citation(r["citations"]))
    print(f"\n== Tham chiếu toàn bộ tutor message: {empty}/{len(tutor_rows)} "
          f"= {empty / len(tutor_rows):.1%} không có citation (ứng viên #2, §2)")

    per_conv = collections.Counter(r["conversation_id"] for r in broad)
    repeats = [(c, k) for c, k in per_conv.most_common() if k >= 2]
    print(f"\n== Hội thoại hỏi lại ≥2 lượt cùng yêu cầu: {len(repeats)}")
    for conv, count in repeats:
        print(f"   {conv}: {count} lượt")

    print("\n== Ví dụ nguyên văn (§1) — 6 mẩu đầu")
    for r in apology[:6]:
        print(f"\n[{r['conversation_id']} / {r['turn_id']} / {r['user_id']}]")
        print(f"   HV   : {r['question'][:120]}")
        print(f"   TUTOR: {norm(r['reply'])[:200]}")
        print(f"   citations={r['citations']} move={r['move_used']} rating={r['rating'] or '-'}")

    if "--dump" in sys.argv:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "broad-scope-turns.csv")
        with open(out, "w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(broad[0].keys()))
            w.writeheader()
            w.writerows(broad)
        print(f"\nĐã ghi {len(broad)} case vào {out}")


if __name__ == "__main__":
    main()
