# Danh mục 25 ca đánh giá sản phẩm

Các ca dưới đây mô phỏng hành vi người học trên giao diện. `Nguồn thật` nghĩa
là câu nói hoặc lỗi được lấy từ chat log đã ẩn danh hay từ phiên dùng thử; mã
người dùng không được đưa vào bộ đánh giá.

## 1. Hiểu yêu cầu tóm tắt

| Mã | Người học làm gì | Điều kiện đạt | Nguồn |
|---|---|---|---|
| P01 | “tóm tắt nội dung chính trong slide này” khi đang ở trang 37 | Chọn đúng trang 37 | Chat log |
| P02 | “Tóm tắt sờ lai này” khi đang ở trang 7 | Hiểu cách nói khẩu ngữ và chọn trang 7 | Chat log |
| P03 | “Tóm tắt trang 6 7 8 và 9” | Nhận đủ khoảng 6–9, không chỉ trang 6 | Lỗi đã gặp |
| P04 | Gõ nhầm “Tóm tắm … slide 7” | Vẫn nhận đúng trang 7 | Lỗi đã gặp |
| P05 | “tóm tắt hết slice trong vài câu đi” | Hiểu là toàn bộ tài liệu | Chat log |
| P06 | “Tổng hợp toàn bộ những kiến thức chính…” | Hiểu là toàn bộ tài liệu | Chat log |
| P07 | “Tóm tắt trang 6 8 9” | Báo rõ đây không phải khoảng liên tiếp | Dựng từ lỗi phạm vi |

## 2. Chất lượng tóm tắt

| Mã | Phạm vi | Điều kiện nội dung chính |
|---|---|---|
| P08 | Trang 7 | Giữ các số 88%, 23%, 39% và ý scale |
| P09 | Trang 9 | Giữ đủ bốn anti-pattern |
| P10 | Trang 12 | Đọc đúng bảng năm giai đoạn Go/No-Go |
| P11 | Trang 24, Học sâu | Giữ Actor, Workflow, Bottleneck, Success Metric và Boundary |
| P12 | Trang 6–9 | Đọc 4/4 trang và mỗi trang có ít nhất một dẫn chứng |
| P13 | Trang 24–27 | Nối được Problem Statement, lỗi phổ biến, ví dụ và Eval Plan |
| P14 | Toàn bộ 44 trang | Đại diện được các phần lớn của cả bài, không chỉ vài trang đầu |

Mọi ca trong nhóm này còn phải dùng AI thật, trích nguồn nằm trong đúng trang
PDF, trả lời trực tiếp và đúng chế độ `Chuẩn` hoặc `Học sâu`.

## 3. Hỏi tiếp và chế độ học

| Mã | Người học làm gì | Điều kiện đạt |
|---|---|---|
| P15 | Sau tóm tắt 6–9, gõ “Giải thích dễ hiểu hơn” | Vẫn gửi nguồn 6–9 và nhãn không đổi theo slide đang mở |
| P16 | Sau đó hỏi đích danh slide 12 | Chuyển sang trang 12, không kéo nguồn 6–9 |
| P17 | Dùng lần lượt Chuẩn và Học sâu | Chuẩn không hỏi thêm; Học sâu có kiểm tra; chỉ hỗ trợ sâu khi trả lời yếu |
| P18 | Yêu cầu AI giải thích lại mạch 6–9 | Phản hồi thật dùng đủ bốn trang và không bỏ mạch chính |

## 4. AI Note

| Mã | Vùng người học chủ động khoanh | Điều kiện đạt |
|---|---|---|
| P19 | Cụm số 88%, 23%, 39% ở trang 7 | Note giữ đúng số, đúng trang và xác minh 1/1 vùng |
| P20 | No baseline và No eval ở trang 9 | Gộp đúng hai vùng, không lẫn hai anti-pattern khác |
| P21 | Tín hiệu AI-Fit trang 20 và Value trang 21 | Nối được hai trang nhưng vẫn giữ đủ nguồn |
| P22 | Actor và Success Metric ở trang 24 | Giải thích đúng quan hệ giữa đối tượng và cách đo thành công |
| P23 | Boundary trang 24 và lỗi thiếu boundary trang 25 | Phân biệt được định nghĩa và lỗi vận hành |
| P24 | Bấm × trên một marker đã lưu | Marker biến mất nhưng nội dung note vẫn còn |
| P25 | Gộp note trang 20 và 21 | Note gộp giữ cả hai nguồn, hai note gốc không bị sửa |

Chi tiết máy đọc, đoạn khoanh và ngưỡng chấm nằm trong
`product-cases.json`. Kết quả của phiên bản hiện tại nằm trong
`results/product-current-report.md`.
