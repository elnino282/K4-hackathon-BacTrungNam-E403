# Kiểm chứng với người học

Thư mục này chỉ giữ ba tệp phục vụ CP5:

1. `README.md`: kịch bản chạy phiên.
2. `feedback-log.csv`: nhật ký chạy thử mô phỏng, sau đó được thay bằng nhật ký
   nguyên văn của ít nhất 5 người ngoài nhóm.
3. `synthesis.md`: bốn kết luận tạm từ chạy thử và chỗ cập nhật sau kiểm chứng.

## Trạng thái

**Chưa có kết quả người dùng thật.** `feedback-log.csv` hiện có 6 lượt đánh giá
mô phỏng để nhóm chạy thử luồng và dự đoán điểm dễ vướng. Từng dòng đều ghi rõ
`Mô phỏng theo yêu cầu, chưa xác minh`; không được dùng các trích dẫn đó làm
bằng chứng CP5. Khi tổ chức kiểm chứng thật, thay M01–M06 bằng P01–P06 được ghi
trực tiếp từ người tham gia.

## Một phiên 10 phút

1. Xin phép ghi tên gọi/biệt danh, vai trò, hành vi và lời nói nguyên văn.
2. Giao **một mục tiêu thật**, sau đó im lặng quan sát; không giới thiệu nút,
   không gợi ý câu hỏi và không sửa cách người tham gia sử dụng sản phẩm.
3. Ghi họ bấm gì, kẹt ở đâu, có tìm được nguồn hay hoàn thành mục tiêu không.
4. Hỏi đúng ba câu:
   - “Điều gì khó hiểu hoặc khó chịu nhất?”
   - “Kết quả này bạn có tin không — vì sao?”
   - “Bạn có dùng thật không — vì sao hoặc vì sao chưa?”
5. Ghi nguyên văn vào một dòng của `feedback-log.csv`, kể cả lỗi chính tả hoặc
   cách nói đời thường. Không viết lại thành lời “đẹp” hơn.

Nếu toàn bộ phản hồi đều là lời khen, giao nhiệm vụ khó hơn hoặc đổi người thử.

## Sáu mục tiêu thử mang tính đời thường

Các mục tiêu dưới đây giúp buổi thử giống cách học viên thật sử dụng sản phẩm.
Người điều phối chỉ đọc phần **mục tiêu**, không đọc sẵn câu lệnh mẫu cho người
thử.

| ID | Tình huống | Mục tiêu giao cho người thử | Điều cần im lặng quan sát |
|---|---|---|---|
| T1 | Ôn nhanh nhiều trang | “Bạn sắp phải kể lại nội dung trang 6–9. Hãy dùng sản phẩm để nắm mạch chính và kiểm tra một ý bạn chưa tin.” | Họ tự hỏi thế nào; kết quả có đủ bốn trang; họ có tìm và mở đúng nguồn không |
| T2 | Chưa hiểu một khái niệm | “Bạn chưa hiểu khung phát biểu bài toán ở trang 24. Hãy dùng sản phẩm đến khi có thể giải thích lại bằng lời của mình.” | Họ chọn Chuẩn hay Học sâu; câu hỏi tiếp theo; phản hồi kiểm tra hiểu có giúp sửa chỗ thiếu không |
| T3 | Kiểm chứng số liệu | “Bạn cần hiểu các số 88%, 23% và 39% ở trang 7, rồi xác minh một con số trong trang chiếu.” | AI có giữ đúng số và ý nghĩa; nút nguồn có đưa đến đúng trang không |
| T4 | Ghi đúng phần mình thiếu | “Trong bảng trang 22, hãy lưu lại chỉ phần bạn thấy cần ôn và tìm lại nguồn sau khi tạo ghi chú.” | Cách khoanh; Ghi chú AI có tóm lược hay chỉ chép; người thử có mở và xóa vùng khoanh được không |
| T5 | Dùng theo cách tự nhiên | “Hãy ôn trang đang mở theo cách bạn thường làm, rồi hỏi tiếp một thuật ngữ bạn chưa rõ.” | Câu gõ tự nhiên/sai chính tả; hệ thống có giữ đúng trang và ngữ cảnh ở lượt hỏi tiếp không |
| T6 | Trang đang nhìn và trang hệ thống nhận khác nhau | “Hãy cuộn đến trang bạn muốn đọc, hỏi nội dung trang đó rồi hỏi tiếp về một thuật ngữ.” | Trang nào chiếm phần lớn màn hình; nhãn trang có khớp không; câu hỏi tiếp theo có giữ đúng nguồn không |

Đây là **nhiệm vụ để giao cho người thật**, không phải sáu kết quả kiểm chứng
giả.

## Điều kiện hoàn tất CP5

- Ít nhất 5 người ngoài nhóm; có tên gọi/biệt danh và vai trò.
- Ưu tiên có ít nhất 2 người đã đồng ý dùng thử được khai từ CP1 theo tiêu chí.
- Mỗi người có quan sát hành vi, điểm kẹt, mức nghiêm trọng và đủ 3 trích dẫn.
- `synthesis.md` chỉ ra chủ đề lặp, 1–2 thay đổi trước trình diễn, phần giữ
  nguyên có lý do và danh sách để sau.
- Ít nhất một thay đổi từ phản hồi được ghi vào nhật ký thay đổi trong
  `spec.md`; nếu không đổi, phải nêu lý do dựa trên phản hồi cụ thể.
