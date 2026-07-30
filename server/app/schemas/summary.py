from typing import List, Optional
from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    doc_id: str = Field(default="lesson-01", description="Mã tài liệu slide PDF")
    current_page: Optional[int] = Field(default=None, description="Trang hiện tại cần tóm tắt (1-indexed)")
    start_page: Optional[int] = Field(default=None, description="Trang bắt đầu cho khoảng tóm tắt")
    end_page: Optional[int] = Field(default=None, description="Trang kết thúc cho khoảng tóm tắt")
    language: str = Field(default="VI", description="Ngôn ngữ tóm tắt (VI hoặc EN)")


class SummaryResponse(BaseModel):
    doc_id: str
    summary: str
    key_points: List[str]
    scope_description: str
    provider: str = Field(..., description="Nguồn xử lý: 'gemini' hoặc 'mock'")
    notice: Optional[str] = Field(default=None, description="Cảnh báo nếu đang chạy ở chế độ mock hoặc lỗi API")
