# Reflection cá nhân — Hoàng Văn Huy (2A202601356)

**Nhóm:** BacTrungNam · **Dự án:** VLearn Slide2Study
**Vai trò:** Spec + validation — `spec.md`, vòng user test, changelog, slide demo

---

## 1. Phần tôi chịu trách nhiệm

| Việc | Artifact |
|---|---|
| Toàn bộ `spec.md` §1–§9 theo `03-template-ai-spec.md` | `spec.md` |
| Lát cắt MỘT CÂU + non-goals + mức prototype khai báo | `spec.md` §4 |
| 4 lớp chỗ khó + 12 kịch bản + 4 đường đi trải nghiệm | `spec.md` §5–§6 |
| 5 chiều chất lượng D1–D5 + quality bar chốt bằng số | `spec.md` §7 |
| Giao thức vòng user test + log feedback | `validation/protocol.md`, `validation/feedback-log.csv`, `analyze_feedback.py` |
| Changelog: đổi gì, vì sao, trỏ về case nào | `spec.md` §9 |
| Slide demo 6 trang | `demo-slides.pdf` *(chưa có trong repo)* |

Thứ tôi phải giải thích được tại CP5: vì sao bar đặt **70%** chứ không cao hơn — baseline của tutor trên chính nhóm case này là 33% có nguồn trang, trần thực tế (nhóm đối chứng có neo phạm vi) là 85%; 70% nằm giữa, gấp đôi baseline và đo được trong thời gian sự kiện.

## 2. AI hỗ trợ thế nào — và chỗ tôi phải tự làm

**AI làm được:** dựng bảng, diễn đạt lại cho gọn, rà tính nhất quán giữa các mục, đối chiếu spec với rubric.

**AI không làm thay được:**
- **Viết định nghĩa đến mức người ngoài nhóm chấm ra cùng kết quả.** "Có căn cứ" là vô nghĩa; D1 phải là "mọi ý có ≥1 số trang, số trang đó nằm trong tập trang đã lấy, và nội dung ý xuất hiện ở trang đó — một ý vi phạm ⇒ fail". Ranh giới này phải do người quyết vì nó quyết định điểm đỗ/trượt.
- **Chọn hai điều kiện cứng.** Bar 70% mà không kèm điều kiện cứng thì nhóm có thể đạt bằng cách bỏ hết case khó. Tôi đặt cứng ở **D1 (0 case bịa nguồn)** và **D4 (100% ca lớp ①③ thất bại an toàn)** vì đó là hai lỗi học viên **không tự phát hiện được**.
- **Ghi lại cái không đạt.** §7 hiện ghi thẳng rằng lượt đo A-1 **không hợp lệ** và bộ golden set **chưa được chạy**. Che hai chỗ này thì bảng đẹp hơn nhiều, nhưng theo README điểm chỉ tính khi số liệu trung thực.

## 3. Một bài học từ case fail của chính nhóm

**Case:** spec §1 khai số liệu mining "tái lập được bằng `eval/mining/mine_broad_summary.py`", §4 và §8 trỏ tới `codebase/frontend/server.ts` và `codebase/frontend/src/components/`. Khi rà lại repo trước khi nộp: **`eval/mining/` không tồn tại, `codebase/` không tồn tại** (code thật nằm ở `client/` và `server/`), **`demo-slides.pdf` chưa có**. Tương tự, `validation/feedback-log.csv` mới chỉ có 5 dòng participant trống, chưa có một quote nào.

**Bài học:** *spec mô tả cái nhóm định làm sẽ âm thầm biến thành spec mô tả cái không có thật, nếu không ai rà ngược từ file lên chữ.* Tôi viết spec theo hướng "phần này ai làm, để ở đâu" — đúng lúc viết thì mọi đường dẫn đều là dự kiến, và sau đó code đi một đường, spec đứng yên một đường. Với người chấm thì không phân biệt được **"nhóm nói dối"** và **"nhóm quên cập nhật"** — cả hai đều làm mất điểm ở R1 (evidence không kiểm chứng được) và R7 (cấu trúc repo).

Cách sửa tôi rút ra: mỗi mục spec có trỏ tới file thì phải **mở file đó lên tại thời điểm commit spec**, không trỏ theo trí nhớ. Và đường dẫn trong spec chỉ được viết sau khi file tồn tại — trước đó thì ghi rõ là *dự kiến*.

**Liên hệ với chính bài toán nhóm đang giải:** đây đúng là lỗi mà Slide2Study sửa cho học viên — một câu trả lời trôi chảy nhưng không truy được về nguồn. Nhóm bắt AI phải cite đúng trang, trong khi spec của chính nhóm lại cite tới file không tồn tại.

## 4. Việc còn nợ / nếu có thêm thời gian

- ⚠️ **Sửa mọi đường dẫn sai trong spec**: `codebase/frontend/*` → `client/*` và `server/app/*`; commit `eval/mining/mine_broad_summary.py`; hoặc gỡ lời khai nếu không kịp.
- ⚠️ **`validation/feedback-log.csv` chưa có dữ liệu** — R6 yêu cầu ≥5 mẩu từ ≥5 người ngoài nhóm, có quote nguyên văn + tên/vai. 4 willing user đã đồng ý (§8), phải chạy vòng test và log trước CP5.
- ⚠️ **`demo-slides.pdf` chưa có** — 6 trang theo `02-guide.md` §5.1, bắt buộc có case lỗi live + % đối chiếu bar.
- §9 changelog cần thêm ≥1 dòng "đổi X vì feedback của user Y" sau vòng validation — hiện changelog mới chỉ ghi thay đổi nội bộ.
