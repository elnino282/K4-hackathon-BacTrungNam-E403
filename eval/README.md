# Bộ đo Slide2Study

Bộ đo dùng một tài liệu thật 44 trang và 24 yêu cầu đã khóa trong
`golden-set.json`: 20 yêu cầu một trang, 3 yêu cầu nhiều trang và 1 yêu cầu toàn
bộ tài liệu.

Chạy một lượt:

```powershell
python .\eval\run_summary_eval.py --variant ten-luot-chay --concurrency 6
```

Tạo lại bảng so sánh bản cũ và bản cuối:

```powershell
python .\eval\compare_results.py
```

Kết quả tổng nằm trong `results`; câu trả lời chi tiết của từng ca nằm trong
`traces`. Không đưa khóa API vào thư mục này.
