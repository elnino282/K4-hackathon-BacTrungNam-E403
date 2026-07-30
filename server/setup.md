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

## 3. Cấu hình Gemini API

Tạo file `.env` trong thư mục `server/`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

* Có API key: server gọi Gemini thật.
* Không có API key: server chạy chế độ mock để test giao diện.

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
