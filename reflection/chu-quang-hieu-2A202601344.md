# Reflection cá nhân — Chu Quang Hiếu (2A202601344)

**Nhóm:** BacTrungNam · **Dự án:** VLearn Slide2Study
**Vai trò:** Evidence — mining chatlog (chuẩn B) + khảo sát (chuẩn A)

---

## 1. Phần tôi chịu trách nhiệm

| Việc | Artifact |
|---|---|
| Quy tắc xếp loại "yêu cầu tóm tắt phạm vi rộng" + script đếm lại được | `spec.md` §1 (bước 1–6), `eval/mining/mine_broad_summary.py` |
| Nhóm đối chứng "giải thích đoạn đang chọn" (384 turn) | `spec.md` §1 bảng số liệu |
| 6 ví dụ nguyên văn có mã hội thoại tra lại được | `spec.md` §1 |
| Khảo sát chuẩn A: thiết kế 2 câu, thu 25 phản hồi ngoài nhóm, tổng hợp | `eval/survey-results.csv`, `spec.md` §1 |
| Bảng impact 5 ứng viên + lý do loại bằng số | `spec.md` §2 |

Con số tôi phải giải thích được tại CP5: **99 lượt · 88 hội thoại · 77/369 user (20,9%) · 63/99 = 64% mở đầu bằng xin lỗi · 33/99 = 33% có nguồn trang**, so với nhóm đối chứng **6%** và **85%**.

## 2. AI hỗ trợ thế nào — và chỗ tôi phải tự làm

**AI làm được:** viết script đọc CSV, gom turn (2 dòng = 1 turn), dựng regex từ khoá, đếm và in bảng. Việc này AI làm nhanh hơn tôi nhiều lần.

**AI không làm thay được — và đây là phần thật sự tính điểm:**
- **Quyết định tiêu chí xếp loại.** Tôi phải đọc 40 mẫu student message *trước khi* định nghĩa từ khoá, và chính lúc đọc mới phát hiện format `(Trang N, đoạn được chọn: "<đoạn>")` — khi học viên gõ mà không bôi đen, platform echo lại chính câu vừa gõ vào ô `đoạn được chọn`. Không có quan sát này thì điều kiện (c) không tồn tại, và toàn bộ 99 case sẽ lẫn với 384 case đối chứng. AI không tự nhìn ra cái này vì nó không biết cái gì là bất thường trong dữ liệu của khoá.
- **Nghĩ ra nhóm đối chứng.** Con số 64% một mình không chứng minh được gì — tutor có thể đơn giản là kém. Chỉ khi đặt cạnh 6% của nhóm có đoạn bôi đen thì mới thành luận điểm "lỗ hổng cục bộ, sửa được".
- **Tự khai giới hạn khảo sát.** Q1/Q2 hỏi theo dạng *sở thích*, không theo *lần gần nhất*; Q1 không có phương án phủ định. Tôi ghi thẳng phần này vào spec thay vì để 96% trông đẹp hơn thực tế.

## 3. Một bài học từ case fail của chính nhóm

**Case:** canvas CP1 tôi ghi **98 lượt / 88 hội thoại / 75 user / 59-98 xin lỗi**. Khi viết script đếm lại thì ra **99 / 88 / 77 / 63-99**. Không con số nào sai nghiêm trọng, nhưng **không con số nào tái lập được** — vì lúc đó tôi đếm bằng cảm nhận sau khi đọc, chưa viết quy tắc xếp loại ra thành chữ.

**Bài học:** *một con số không kèm quy tắc đếm viết ra được thì không phải bằng chứng, nó là ấn tượng.* Cái làm số liệu §1 có giá trị không phải là nó lớn, mà là người ngoài nhóm chạy lại script ra đúng số đó. Sau lần này tôi đổi thứ tự làm việc: viết tiêu chí → viết script → mới đọc kết quả, thay vì đọc rồi ước lượng rồi đi tìm số khớp với ước lượng.

**Hệ quả trực tiếp:** đây cũng là logic tôi mang sang §7 — quality bar phải chốt *trước* khi thấy kết quả đo, vì nếu chốt sau thì bar chỉ là mô tả lại cái mình đã làm được.

## 4. Việc còn nợ / nếu có thêm thời gian

- ⚠️ **`eval/mining/mine_broad_summary.py` chưa được commit vào repo** dù `spec.md` §1 khai là tái lập được bằng script này. Đây là lỗi của tôi và phải commit trước CP5 — nếu không, toàn bộ evidence chuẩn B mất tính kiểm chứng và R1 bị trừ.
- Khảo sát nên hỏi thêm một câu theo *lần gần nhất* ("lần gần nhất bạn ôn lại slide, bạn mất khoảng bao lâu?") để có được phần định lượng thời gian mà mining không cho biết.
- Chưa đếm được tỉ lệ học viên **quay lại hỏi sau khi thất bại** so với **bỏ hẳn** — con số này sẽ mạnh hơn 5 `rating=down` hiện có.
