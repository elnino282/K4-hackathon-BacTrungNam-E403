# Kết quả product eval — finalist-v2

> Snapshot lúc 2026-08-01T07:56:25+07:00 trên commit `0029fa6` với working tree chưa commit.

Đây là số đo của phiên bản hiện tại, không phải mục tiêu đã được làm đẹp. Một ca chỉ đạt khi tất cả điều kiện quan trọng của hành vi đó cùng đạt.

## Chỉ số tổng

| Chỉ số | Kết quả |
|---|---:|
| Ca đạt hoàn toàn | 23/25 (92.0%) |
| Điều kiện nhỏ đạt | 98.4% |
| Ca dùng phản hồi AI thật | 100.0% |
| Kiểm tra phạm vi/nguồn đạt | 100.0% |
| Độ trễ AI trung vị | 6127 ms |
| Độ trễ AI p95 | 8666 ms |

## Theo nhóm hành vi

| Nhóm | Đạt | Tổng | Tỷ lệ |
|---|---:|---:|---:|
| Hiểu yêu cầu tóm tắt | 7 | 7 | 100.0% |
| Chất lượng tóm tắt | 7 | 7 | 100.0% |
| Hỏi tiếp và chế độ học | 4 | 4 | 100.0% |
| AI Note | 5 | 7 | 71.4% |

## Nhật ký 25 ca

| Mã | Hành vi thực tế | Kết quả | Phiên bản hiện tại làm gì |
|---|---|---|---|
| P01 | Tóm tắt slide đang mở bằng cách nói tự nhiên | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {"current_page":37}. |
| P02 | Hiểu cách viết khẩu ngữ “sờ lai” | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {"current_page":7}. |
| P03 | Chuỗi trang viết liền bằng khoảng trắng | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {"start_page":6,"end_page":9}. |
| P04 | Chấp nhận lỗi gõ “tóm tắm” | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {"current_page":7}. |
| P05 | Tóm tắt toàn bộ bằng câu khẩu ngữ | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {}. |
| P06 | Hiểu từ đồng nghĩa “tổng hợp toàn bộ” | Đạt | Nhận là yêu cầu tóm tắt với phạm vi {}. |
| P07 | Không âm thầm đổi danh sách trang rời rạc thành một khoảng | Đạt | Từ chối yêu cầu: Hiện chỉ hỗ trợ một trang hoặc một khoảng trang liên tiếp. Ví dụ: “trang 7 đến 9”. |
| P08 | Trang số liệu adoption và scale | Đạt | Trang 7; đọc 1/1 trang; trích trang [7]; giữ 4/4 ý khóa. |
| P09 | Bốn anti-pattern phải đủ và không bịa | Đạt | Trang 9; đọc 1/1 trang; trích trang [9]; giữ 4/4 ý khóa. |
| P10 | Bảng Gate Criteria nhiều cột | Đạt | Trang 12; đọc 1/1 trang; trích trang [12]; giữ 5/5 ý khóa. |
| P11 | Học sâu khung Problem Statement | Đạt | Trang 24; đọc 1/1 trang; trích trang [24]; giữ 5/5 ý khóa. |
| P12 | Bốn trang 6–9 phải đều được đọc | Đạt | Khoảng trang 6 - 9; đọc 4/4 trang; trích trang [6, 7, 8, 9]; giữ 4/4 ý khóa. |
| P13 | Chuỗi từ Problem Statement sang Eval Plan | Đạt | Khoảng trang 24 - 27; đọc 4/4 trang; trích trang [24, 25, 26, 27]; giữ 5/5 ý khóa. |
| P14 | Tóm tắt toàn bộ 44 trang | Đạt | Toàn bộ slide (44 trang); đọc 44/44 trang; trích trang [7, 11, 15, 19, 24, 29, 34, 38]; giữ 3/5 ý khóa. |
| P15 | Gõ tay câu hỏi tiếp vẫn giữ nguồn 6–9 | Đạt | Gửi nguồn [6, 7, 8, 9], trang chính 6, nhãn “Nội dung bài học Trang 6–9”. |
| P16 | Nêu trang mới thì không kéo nhầm nguồn cũ | Đạt | Gửi nguồn [], trang chính 12, nhãn “Nội dung bài học Trang 12”. |
| P17 | Chuẩn không hỏi; Học sâu thích ứng sau bài kiểm tra | Đạt | Chuẩn không hiện bài kiểm tra; Học sâu có bài kiểm tra; hỗ trợ sâu chỉ hiện khi trả lời thiếu hoặc sai. |
| P18 | AI giải thích lại dựa trên đủ bốn trang nguồn | Đạt | Tutor dùng nguồn [6, 7, 8, 9]; giữ 3/4 ý khóa. |
| P19 | Một vùng số liệu trên trang 7 | Đạt | AI Note từ trang [7]; xác minh 1/1 vùng; giữ 3/3 ý khóa. |
| P20 | Hai vùng anti-pattern trên cùng một trang | Chưa đạt | AI Note từ trang [9]; xác minh 2/2 vùng; giữ 2/4 ý khóa. |
| P21 | Hai vùng có liên hệ trên hai trang | Đạt | AI Note từ trang [20, 21]; xác minh 2/2 vùng; giữ 3/5 ý khóa. |
| P22 | Hai phần xa nhau trong cùng khung Problem Statement | Đạt | AI Note từ trang [24]; xác minh 2/2 vùng; giữ 4/4 ý khóa. |
| P23 | Nối định nghĩa boundary với lỗi thiếu boundary | Chưa đạt | AI Note từ trang [24, 25]; xác minh 2/2 vùng; giữ 2/5 ý khóa. |
| P24 | Xóa vùng khoanh nhưng giữ nội dung note | Đạt | Đã bỏ một marker; note và phần giải thích vẫn còn trong kho. |
| P25 | Gộp hai note vẫn giữ đủ nguồn gốc | Đạt | Note gộp giữ nguồn trang 20, 21 và không sửa note gốc. |

## Những điểm phiên bản hiện tại chưa đạt

- **P20 — Hai vùng anti-pattern trên cùng một trang:** giu du y quan trong. AI Note từ trang [9]; xác minh 2/2 vùng; giữ 2/4 ý khóa.
- **P23 — Nối định nghĩa boundary với lỗi thiếu boundary:** giu du y quan trong. AI Note từ trang [24, 25]; xác minh 2/2 vùng; giữ 2/5 ý khóa.

## Cách đọc kết quả

- CSV dùng để lọc nhanh theo nhóm, độ khó, nguồn ca và lỗi.
- `finalist-v2-traces.json` giữ nguyên đầu vào, đầu ra và từng điều kiện chấm.
- Kết quả AI có thể dao động giữa các lượt; mỗi lượt phải được ghi với thời gian và commit.
- Không có tên hay nội dung nhận diện cá nhân từ chat log trong bộ eval.
