from typing import Annotated, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


PageNumber = Annotated[int, Field(strict=True, ge=1)]


class SummaryKeyPoint(BaseModel):
    claim: str
    page: int
    source_id: Optional[str] = None
    evidence_quote: str
    verified: bool
    verification_method: str


class SummaryCoverage(BaseModel):
    requested_pages: int
    processed_pages: int
    verified_points: int
    rejected_points: int
    target_min_points: int = 0
    target_max_points: int = 5


class SummaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(
        default="lesson-01",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Mã tài liệu slide PDF",
    )
    current_page: Optional[PageNumber] = Field(
        default=None,
        description="Trang hiện tại cần tóm tắt (1-indexed)",
    )
    start_page: Optional[PageNumber] = Field(
        default=None,
        description="Trang bắt đầu cho khoảng tóm tắt",
    )
    end_page: Optional[PageNumber] = Field(
        default=None,
        description="Trang kết thúc cho khoảng tóm tắt",
    )
    language: Literal["VI", "EN"] = Field(
        default="VI",
        description="Ngôn ngữ tóm tắt",
    )

    @model_validator(mode="after")
    def validate_scope(self):
        has_current = self.current_page is not None
        has_start = self.start_page is not None
        has_end = self.end_page is not None

        if has_current and (has_start or has_end):
            raise ValueError(
                "Chỉ được chọn current_page hoặc một khoảng start_page/end_page"
            )
        if has_start != has_end:
            raise ValueError(
                "Khoảng trang phải có đủ start_page và end_page"
            )
        if has_start and has_end and self.start_page > self.end_page:
            raise ValueError(
                "start_page phải nhỏ hơn hoặc bằng end_page"
            )
        return self


class SummaryResponse(BaseModel):
    doc_id: str
    summary: str
    key_points: List[SummaryKeyPoint]
    scope_description: str
    coverage: SummaryCoverage
    status: Literal[
        "verified",
        "partial",
        "fallback",
        "error",
        "not_applicable",
    ]
    provider: str = Field(..., description="Nguồn xử lý: 'xah' hoặc 'mock'")
    notice: Optional[str] = Field(default=None, description="Cảnh báo nếu đang chạy ở chế độ mock hoặc lỗi API")
    cached: bool = Field(
        default=False,
        description="Kết quả có được lấy từ bộ nhớ đệm an toàn hay không",
    )
