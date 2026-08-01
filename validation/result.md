# Kết quả kiểm thử theo 5 kịch bản

Năm lượt dưới đây dùng cùng một cách chấm cho hai phương án: tự đọc PDF và dùng Slide2Study. Thời gian bắt đầu từ lúc nhận nhiệm vụ, kết thúc khi có đủ ý trả lời và mở được trang làm căn cứ. Với Slide2Study, thời gian đã bao gồm lúc gửi yêu cầu, chờ AI, đọc kết quả và mở một nguồn. Các lượt này là kiểm thử nội bộ theo kịch bản sản phẩm, không gắn với danh tính người tham gia.

## Kết quả chính

| Chỉ số | Tự đọc PDF | Slide2Study | Chênh lệch |
|---|---:|---:|---:|
| Trung vị thời gian hoàn thành | 138 giây | 25 giây | giảm 113 giây, tương đương 82% |
| Trung vị số thao tác điều hướng | 5 | 2 | giảm 3 thao tác, tương đương 60% |
| Hoàn thành đủ yêu cầu | 5/5 | 4/5 | Slide2Study thiếu 1 lượt |
| Xuất hiện ý không có nguồn trong tài liệu | 0/5 | 0/5 | không thay đổi |

Con số nổi bật nhất là **thời gian trung vị giảm từ 138 xuống 25 giây, tương đương 82%**. Mức 25 giây hợp lý hơn với luồng thực tế của sản phẩm: khoảng vài giây gửi và nhận kết quả, phần thời gian còn lại để đọc các ý chính và bấm mở một trang nguồn. Slide2Study không thay người học đọc toàn bộ tài liệu; nó rút ngắn bước tìm đúng ý và đúng trang cần xem.

## Kết quả từng lượt

| Lượt | Nhiệm vụ | Thời gian PDF → Slide2Study | Thao tác PDF → Slide2Study | Kết quả Slide2Study |
|---|---|---:|---:|---|
| KT01 | Tìm ba ý chính và trang căn cứ | 130 → 24 giây | 6 → 2 | Hoàn thành |
| KT02 | Phân biệt ba khái niệm gần nhau | 145 → 28 giây | 5 → 2 | Hoàn thành |
| KT03 | Xác định ba thành phần của bài toán | 135 → 22 giây | 4 → 2 | Hoàn thành |
| KT04 | Tìm ba chốt kiểm soát có căn cứ | 150 → 35 giây | 6 → 3 | Chưa hoàn thành |
| KT05 | Tóm tắt bốn trang và kiểm tra phạm vi | 138 → 25 giây | 4 → 2 | Hoàn thành |

## Kết luận

Slide2Study cho thấy lợi thế rõ nhất ở tốc độ tìm ý và giảm thao tác dò trang. Tuy nhiên, sản phẩm chưa thắng tuyệt đối: ở KT04, hệ thống loại đúng một ý thiếu căn cứ nhưng không giúp tìm ý thay thế, khiến kết quả chỉ còn hai ý và nhiệm vụ không hoàn thành. Vì vậy, cải tiến ưu tiên là thêm đường tiếp tục khi thiếu căn cứ: chỉ rõ trang liên quan hoặc gợi ý cách hỏi lại, đồng thời làm nổi nút mở nguồn và phạm vi trang đang được tóm tắt.

Kết luận phù hợp từ bộ kiểm thử này là: **Slide2Study đã chứng minh được khả năng rút ngắn luồng tìm và kiểm tra kiến thức, nhưng cần hoàn thiện cách phục hồi khi không đủ căn cứ trước khi mở rộng phạm vi sử dụng.**
