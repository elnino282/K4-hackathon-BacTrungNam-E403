from typing import Annotated, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


PageNumber = Annotated[int, Field(strict=True, ge=1)]


class TutorChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Câu hỏi hoặc yêu cầu của học viên",
    )
    selected_text: Optional[str] = Field(
        default=None,
        max_length=6000,
        description="Văn bản học viên bôi đen trên slide",
    )
    page_context: PageNumber = Field(
        default=1,
        description="Trang slide học viên đang xem",
    )
    slide_title: Optional[str] = Field(default=None, description="Tiêu đề slide hoặc file name")
    language: Literal["VI", "EN"] = Field(
        default="VI",
        description="Ngôn ngữ giao tiếp (VI/EN)",
    )
    context_pages: List[PageNumber] = Field(
        default_factory=list,
        max_length=5,
        description="Các trang nguồn của phản hồi trước cần giữ ngữ cảnh",
    )
    prior_answer: Optional[str] = Field(
        default=None,
        max_length=6000,
        description="Phản hồi trước mà hành động follow-up đang tham chiếu",
    )

    @field_validator("context_pages")
    @classmethod
    def validate_unique_context_pages(cls, value: List[int]) -> List[int]:
        if len(set(value)) != len(value):
            raise ValueError("context_pages không được chứa trang trùng lặp")
        return value


class TutorChatResponse(BaseModel):
    reply: str
    provider: str = Field(..., description="Nguồn xử lý: 'xah' hoặc 'mock'")
    sources: Optional[List[str]] = Field(default=None, description="Trích dẫn nguồn hoặc ngữ cảnh slide")
    notice: Optional[str] = Field(default=None, description="Thông báo trạng thái (ví dụ: cảnh báo API Key missing)")
