import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api import documents, notes, study, summaries, tutor
from app.services.gemini_service import get_gemini_configuration
from app.services.pdf_service import ensure_extracted_on_startup

# Load environment variables từ file .env nếu có
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Life-span event handler: Khởi tạo và kiểm tra dữ liệu lúc startup
    """
    logger.info("FastAPI Backend đang khởi động...")
    # Tự động trích xuất lesson-01.pdf ra lesson-01.json 1 lần duy nhất nếu chưa có
    get_gemini_configuration()
    ensure_extracted_on_startup("lesson-01")
    yield
    logger.info("FastAPI Backend đang dừng...")


app = FastAPI(
    title="VLearn AI Tutor API",
    description="Backend API hỗ trợ hiển thị slide PDF, Tóm tắt thông minh và AI Tutor Trợ lý Học tập",
    version="1.0.0",
    lifespan=lifespan
)

# Cấu hình CORS mở cho React Vite Client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thêm các API Routers
app.include_router(documents.router)
app.include_router(summaries.router)
app.include_router(tutor.router)
app.include_router(notes.router)
app.include_router(study.router)


@app.get("/")
async def root_status():
    return {
        "service": "VLearn AI Tutor API",
        "status": "online",
        "summary_ai_key": "configured",
        "tutor_ai_key": "configured",
        "ai_provider": "gateway" if os.getenv("AI_BASE_URL") else "google",
        "ai_model": os.getenv("AI_MODEL") or os.getenv("GEMINI_MODEL"),
        "docs_url": "/docs"
    }
