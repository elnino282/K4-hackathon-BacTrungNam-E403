from typing import List, Optional
from pydantic import BaseModel, Field


class TutorChatRequest(BaseModel):
    message: str = Field(..., description="Câu hỏi hoặc yêu cầu của học viên")
    selected_text: Optional[str] = Field(default=None, description="Văn bản học viên bôi đen trên slide")
    page_context: int = Field(default=1, description="Trang slide học viên đang xem")
    slide_title: Optional[str] = Field(default=None, description="Tiêu đề slide hoặc file name")
    language: str = Field(default="VI", description="Ngôn ngữ giao tiếp (VI/EN)")


class TutorChatResponse(BaseModel):
    reply: str
    provider: str = Field(..., description="Nguồn xử lý: 'gemini' hoặc 'mock'")
    sources: Optional[List[str]] = Field(default=None, description="Trích dẫn nguồn hoặc ngữ cảnh slide")
    notice: Optional[str] = Field(default=None, description="Thông báo trạng thái (ví dụ: cảnh báo API Key missing)")
