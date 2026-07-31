# VLearn AI Tutor Backend

## Setup

```powershell
cd server
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `server/.env` from `.env.example` and set the required Google Gemini
Developer API credentials:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

The server validates both variables during startup. It will stop with a clear
error naming any missing variable; never commit or print the real API key.

## Run

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Useful URLs:

- Root API: `http://localhost:8000/`
- Swagger UI: `http://localhost:8000/docs`
- Summary: `POST http://localhost:8000/api/summaries/generate`
- Tutor: `POST http://localhost:8000/api/tutor/chat`

## Gemini smoke test

The smoke test reads `.env` but never prints the API key.

```powershell
python tests/smoke_gemini.py
python tests/smoke_gemini.py --page 12
```

Summary still uses extracted PDF text, optional rendered page images, and its
existing evidence verification before returning a result.
