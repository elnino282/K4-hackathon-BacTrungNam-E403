# Bộ đánh giá Slide2Study

Bộ product eval có 25 hành vi người học, bao gồm cách hiểu câu lệnh, tóm tắt,
hỏi tiếp, chế độ học và AI Note.

Bộ product eval không đo tải hệ thống, DevTools hay số người dùng đồng thời.
Mỗi ca mô phỏng một thao tác có thể xảy ra trực tiếp trên sản phẩm. Một số câu
được rút từ chat log đã ẩn danh; bộ eval chỉ giữ mã hội thoại ẩn danh và câu nói
cần kiểm tra, không giữ tên hay thông tin nhận diện.

## Chạy product eval

Từ thư mục gốc, sau khi kích hoạt môi trường Python:

```powershell
python .\eval\run_product_eval.py --variant product-current --concurrency 3 --write-log
```

Lượt chạy gọi đúng dịch vụ AI đang được cấu hình trong `server/.env`. Mỗi lần
chạy sẽ lưu:

- `results/product-current-summary.json`: chỉ số tổng;
- `results/product-current-cases.csv`: một dòng cho mỗi ca;
- `results/product-current-report.md`: báo cáo dễ đọc;
- `results/product-current-traces.json`: đầy đủ đầu vào, đầu ra và từng điều
  kiện của cả 25 ca trong một tệp;
- `EVAL_LOG.md`: lịch sử các lần đo.

Kết quả AI có thể thay đổi giữa các lần chạy. Vì vậy báo cáo luôn ghi thời gian,
commit và trạng thái working tree. Không đưa khóa API vào bất kỳ kết quả nào.

## Cách chấm

- Ca hiểu câu lệnh chỉ đạt nếu xác định đúng loại yêu cầu và đúng phạm vi trang.
- Ca tóm tắt chỉ đạt nếu đọc đủ phạm vi, dẫn chứng nằm trong PDF, giữ đủ ý đã
  khóa và trả lời trực tiếp.
- Ca hỏi tiếp chỉ đạt nếu không đổi nguồn theo slide đang mở.
- Ca AI Note chỉ đạt nếu giữ đúng vùng người học khoanh, đúng trang, có nội dung
  dùng được và không mất nguồn.
- `passed` của một ca chỉ là `true` khi mọi điều kiện quan trọng đều đạt. CSV
  và tệp trace hợp nhất vẫn giữ các điều kiện nhỏ để thấy lỗi nằm chính xác ở
  đâu.
