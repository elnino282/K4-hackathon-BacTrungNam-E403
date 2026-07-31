# Reflection cá nhân — Nguyễn Đình Liên Thành (2A202601790)

**Nhóm:** BacTrungNam · **Dự án:** VLearn Slide2Study
**Vai trò:** AI / prompt — quyết định phạm vi, sinh tóm tắt có nguồn, golden set + chạy đo

---

## 1. Phần tôi chịu trách nhiệm

| Việc | Artifact |
|---|---|
| Lời gọi AI thật ở quyết định trung tâm (hiểu yêu cầu → chốt phạm vi → sinh tóm tắt) | `server/app/services/gemini_service.py`, `summary_service.py`, `tutor_service.py`, `evidence_service.py` |
| Ràng buộc "mọi ý phải truy được về trang đã lấy", ẩn ý không khớp nguồn | `server/app/services/evidence_service.py` |
| Golden set 24 câu, 4 kiểu tình huống AI dễ sai | `eval/golden-set.md` |
| Bộ product eval 25 hành vi + harness chạy đo | `eval/run_product_eval.py`, `eval/product-cases.json` |
| Bảng kết quả các lượt chạy | `spec.md` §7, `eval/EVAL_LOG.md`, `eval/results/` |

Số tôi phải giải thích được tại CP5: bộ A **18/24 (75%) → 20/24 (83%)**; bộ B **23 → 22 → 23 / 25**; `evidence_source_match_rate = 1.0` ở cả hai lượt bộ A — tức **0 case bịa nguồn**.

## 2. AI hỗ trợ thế nào — và chỗ tôi phải tự làm

**AI làm được:** sinh khung service, parse JSON trả về, viết harness chấm điểm, viết case tổng hợp cho golden set.

**AI không làm thay được:**
- **Chọn cost-of-error, không chọn "cho AI tự làm hết".** Tôi chốt `conditional` (§4) vì một bản tóm tắt bịa đọc *mượt hơn* một lời xin lỗi — học viên tin và mang kiến thức sai vào bài kiểm tra, và tự họ không phát hiện được. Nếu để AI tự quyết kiến trúc, mặc định nó sẽ chọn "trả lời luôn cho mượt".
- **Quy tắc thà thiếu còn hơn sai.** Trong `evidence_service`, ý nào không khớp được về trang đã lấy thì bị **ẩn**, không đoán số trang. Đây là quyết định của tôi, không phải mặc định của mô hình.
- **Viết golden set từ lỗi thật.** 14/24 câu bắt nguồn từ chatlog (C0001, C0076, C0469, C0414...). Case AI tự sinh thường là case dễ và đẹp; case làm sản phẩm gãy phải lấy từ người thật.

## 3. Một bài học từ case fail của chính nhóm

**Case:** **P14 — "tóm tắt toàn bộ 44 trang"**. Hệ thống đọc đủ **44/44 trang**, mọi ý đều có nguồn đúng (rà soát thủ công xác nhận không ý nào trái nguồn), nhưng chỉ giữ **1/5 ý khoá** — thiếu Stakeholder và Discovery. Ở bộ A, cùng lỗi này xuất hiện ở G24 (term recall 0,4).

**Bài học:** *grounding và coverage là hai thứ khác nhau, và tôi đã tối ưu nhầm chỉ một.* Toàn bộ ràng buộc tôi viết đều nhắm vào "đừng bịa" — và nó hoạt động: 0 case bịa nguồn qua tất cả các lượt. Nhưng khi phạm vi rộng ra 44 trang, mô hình đạt "đúng" bằng cách **chọn vài ý an toàn nhất và bỏ phần còn lại**. Kết quả đúng 100% mà vô dụng: học viên đọc xong không ôn được gì.

Đúng như D1 và D2 trong §7 là hai chiều riêng — tôi viết ra chúng riêng nhưng khi code thì chỉ ép chiều D1. **Ràng buộc mà không có ràng buộc đối trọng thì mô hình sẽ lách theo hướng dễ nhất.** Với case toàn tài liệu, cần thêm bước bắt buộc phủ đủ các cụm chủ đề (map-reduce theo section) trước khi rút gọn, chứ không để một lượt gọi tự chọn.

**Case thứ hai đáng ghi:** **P06** — "tổng hợp toàn bộ" không được nhận là yêu cầu tóm tắt. Lỗi này nằm ở bước hiểu ý định, *trước* mọi ràng buộc grounding. Nhắc tôi rằng phần lớn công sức tôi bỏ vào chất lượng đầu ra sẽ vô nghĩa nếu bước phân loại yêu cầu trượt ngay từ đầu — mà đây đúng là bước mà chatlog gốc đang hỏng.

## 4. Việc còn nợ / nếu có thêm thời gian

- ⚠️ **Bộ 24 câu trong `eval/golden-set.md` chưa được chạy.** Bộ A đang trùng mã `G01–G24` nhưng nội dung là ca tóm tắt theo trang, không phải 4 kiểu ①–④. Phải chạy đúng golden set trước CP5 để đối chiếu được với bar §7.
- Lượt đo bộ A-1 có 5/24 ca rơi vào fallback mock ⇒ không hợp lệ theo chính §4. Harness cần **chặn cứng**: gặp fallback thì báo lỗi lượt chạy, không ghi điểm.
- Sửa P14/G24 bằng map-reduce theo section; sửa P06 bằng cách mở rộng tập từ đồng nghĩa của ý định "tóm tắt" (lấy từ chính chatlog thay vì tự nghĩ).
- Chưa chạy multi-prototype A/B (hỏi phạm vi trước vs làm mức hẹp nhất rồi cho đổi) như §8 đã khai.
