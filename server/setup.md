# 🚀 Cài Đặt & Chạy FastAPI Server

## 1. Yêu cầu

* Python 3.9 trở lên
* pip

## 2. Cài đặt môi trường

Di chuyển vào thư mục backend:

```bash
cd server
```

Tạo môi trường ảo:

```bash
python -m venv venv
```

Kích hoạt môi trường:

**Windows PowerShell**

```powershell
.\venv\Scripts\Activate.ps1
```

**Windows CMD**

```cmd
venv\Scripts\activate.bat
```

**macOS / Linux**

```bash
source venv/bin/activate
```

Cài dependencies:

```bash
pip install -r requirements.txt
```

## 3. Cấu hình AI API

Tạo file `.env` trong thư mục `server/`:

```env
XAH_API_KEY=your_xah_api_key_here
AI_BASE_URL=https://api.xah.io/v1
AI_MODEL=vuduythanh2023/gemini-3.5-flash
```

Không commit file `.env`.

* Có `XAH_API_KEY`: Summary và Tutor dùng XAH; Summary đối chiếu chữ PDF
  với ảnh bố cục khi tóm tắt tối đa 3 trang.
* Không có API key: server chạy chế độ mock và ghi rõ đây không phải kết quả AI.

## 4. Chạy server

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Server chạy tại:

```text
http://localhost:8000
```

## 5. Kiểm tra API

* Root API: `http://localhost:8000/`
* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`
* Parse PDF: `POST http://localhost:8000/api/documents/lesson-01/parse`
* Xem JSON đã parse: `GET http://localhost:8000/api/documents/lesson-01`
* Render ảnh một trang: `GET http://localhost:8000/api/documents/lesson-01/pages/22/image`
* Tóm tắt: `POST http://localhost:8000/api/summaries/generate`

Kiểm tra nhanh key/model mà không khởi động server:

```bash
python tests/smoke_xah.py
python tests/smoke_xah.py --page 12
```

Script đọc `.env`, không in API key. Lệnh thứ hai gọi pipeline thật bằng chữ và
ảnh của trang được chọn.

Ví dụ tóm tắt một trang:

```json
{
  "doc_id": "lesson-01",
  "current_page": 22,
  "language": "VI"
}
```

Pipeline MVP:

1. `pdfplumber` lấy chữ sạch và giữ thêm bản bố cục theo từng trang.
2. Ảnh trang chỉ được render khi AI cần hiểu bảng/cột/sơ đồ.
3. System prompt quy định ảnh quyết định bố cục, chữ PDF quyết định chính tả.
4. AI phải trả JSON gồm `summary` và `key_points` có số trang.

## 6. Cấu trúc chính

```text
server/
├── app/
│   ├── main.py
│   ├── api/
│   ├── schemas/
│   └── services/
├── data/
├── requirements.txt
├── setup.md
└── .env
```
