# Reflection cá nhân — Hồ Ngọc Quỳnh (2A202601684)

**Nhóm:** BacTrungNam · **Dự án:** VLearn Slide2Study
**Vai trò:** Build / giao diện — panel tóm tắt, chip nguồn trang, chọn phạm vi, 4 đường đi §6

---

## 1. Phần tôi chịu trách nhiệm

| Việc | Artifact |
|---|---|
| Panel tutor + bản tóm tắt có chip nguồn trang bấm được | `client/src/components/AITutorPanel.tsx` |
| Viewer PDF, chọn trang, bôi đen đoạn, nhảy tới trang nguồn | `client/src/components/SlideViewer.tsx` |
| AI Note: khoanh vùng → sinh note → kho note (sửa/xoá/gộp/xuất) | `NotesDrawer.tsx`, `DocumentToolbar.tsx` |
| Chế độ Chuẩn / Học sâu + vòng kiểm tra độ hiểu | `MeasuredLearningLoop.tsx`, `InlineQuiz.tsx` |
| Đường lui khi lỗi: không vỡ UI, luôn còn hành động tiếp | `FeatureBoundary.tsx` |
| Vận hành máy trong vòng validation (CP5) | `validation/protocol.md` |

Thứ tôi phải giải thích được tại CP5: vì sao **mỗi ý bắt buộc có chip `[tr. N]` bấm được** — không có trang thì ý đó không được hiện; và vì sao **câu hỏi tiếp nối giữ nguyên nguồn của bản tóm tắt trước**, không đổi theo trang PDF học viên đang cuộn (đây chính là bug P15 đã bắt được).

## 2. AI hỗ trợ thế nào — và chỗ tôi phải tự làm

**AI làm được:** dựng component, layout, state, xử lý text layer của `pdfjs-dist`, sinh biến thể UI nhanh để so sánh.

**AI không làm thay được:**
- **Quyết định cái gì *không* được hiện.** Ý không truy được về trang thì bị ẩn, kể cả khi câu chữ nghe rất hay. Mặc định của AI khi dựng UI là hiện hết những gì backend trả về — làm vậy là phá đúng ràng buộc §5 #9.
- **Phân biệt hai loại lỗi trên màn hình.** `SCOPE_UNAVAILABLE` (không có trang đó) và `SCOPE_UNCLEAR` (chưa rõ bạn muốn mức nào) phải ra hai câu khác nhau với hai nút khác nhau. Nếu gộp thành một câu xin lỗi chung là quay lại đúng lỗi gốc mà nhóm đang sửa.
- **Đường lui cho C0469.** Chip đổi phạm vi ngay trên output là để học viên không bao giờ phải gõ lại câu hỏi — cái này đến từ đọc case thật (6 lượt rồi gõ "1+1"), không đến từ gợi ý UI của AI.

## 3. Một bài học từ case fail của chính nhóm

**Case:** lượt đo bộ A-1 (`happy-path-full`) — **5/24 ca (G20–G24) rơi vào `generateFallbackResponse()`** vì dịch vụ AI không khả dụng. Trên màn hình, mọi thứ trông *đúng như thiết kế*: thông báo lịch sự "Dịch vụ AI đang tạm thời không khả dụng, bạn có thể thử lại sau", UI không vỡ, không có ý nào bịa. Nhưng trong CSV, 5 ca đó vẫn được chấm và kéo lượt đo xuống 18/24 — trong khi §4 đã ghi rõ số của fallback **không được dùng cho bất kỳ chỉ số nào trong §7**.

**Bài học:** *fail-safe cho người dùng không đồng nghĩa với fail-safe cho phép đo.* Tôi làm phần "hỏng mà vẫn tử tế" rất kỹ ở tầng nhìn thấy được, nhưng ở tầng dữ liệu thì trạng thái fallback lẫn hoàn toàn vào trạng thái bình thường — cùng một hình dạng response, chỉ khác `provider: "mock"` mà không ai chặn. Kết quả là suýt báo cáo một con số không có thật.

Nói rộng ra: **mọi trạng thái xuống cấp phải để lại dấu vết mà máy đọc được, không chỉ chữ mà người đọc được.** Một màn hình lỗi đẹp có thể che mất việc hệ thống đang không hoạt động — đúng cái lỗi "thất bại im lặng" mà nhóm đã ghi là *đáng né* khi nghiên cứu Quizlet AI / Gemini ở §3, và rồi tự vấp lại ở tầng khác.

## 4. Việc còn nợ / nếu có thêm thời gian

- Đánh dấu rõ trạng thái fallback trên UI (banner riêng, không giống trạng thái bình thường) và để harness **loại ca fallback ra khỏi mẫu đo** thay vì chấm fail.
- Chip đổi phạm vi (Trang ↔ Bài ↔ Buổi) ngay trên output như §4b G9 mô tả — cần rà lại xem đã đủ 3 mức và sinh lại tại chỗ chưa.
- Nút 👎 kèm 3 lựa chọn *sai phạm vi / thiếu ý / sai nguồn trang* (§4b G15) phải ghi được ra `validation/feedback-inline.md` — hiện file này chưa có trong repo.
- Note đang lưu cục bộ trên trình duyệt; mất máy là mất note. Đúng với non-goal #4 nhưng cần nói rõ khi demo.
