from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


PageNumber = Annotated[int, Field(strict=True, ge=1)]
NormalizedCoordinate = Annotated[float, Field(ge=0, le=1)]


class NoteSelectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: PageNumber
    text: str = Field(default="", max_length=6000)
    x: NormalizedCoordinate
    y: NormalizedCoordinate
    width: NormalizedCoordinate
    height: NormalizedCoordinate
    image_data_url: Optional[str] = Field(
        default=None,
        max_length=1_500_000,
    )

    @model_validator(mode="after")
    def validate_selection(self):
        if self.width <= 0 or self.height <= 0:
            raise ValueError("Vùng khoanh phải có chiều rộng và chiều cao")
        if self.x + self.width > 1.001 or self.y + self.height > 1.001:
            raise ValueError("Vùng khoanh nằm ngoài trang")
        if not self.text.strip() and not self.image_data_url:
            raise ValueError("Vùng khoanh phải có chữ hoặc ảnh")
        if self.image_data_url and not self.image_data_url.startswith(
            ("data:image/png;base64,", "data:image/jpeg;base64,")
        ):
            raise ValueError("Ảnh vùng khoanh phải là PNG/JPEG data URL")
        return self


class AINoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(
        default="lesson-01",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    selections: List[NoteSelectionInput] = Field(
        min_length=1,
        max_length=6,
    )
    language: Literal["VI", "EN"] = "VI"


class AINoteResponse(BaseModel):
    title: str
    summary: str
    key_takeaways: List[str]
    example: Optional[str] = None
    misconception: Optional[str] = None
    source_pages: List[int]
    source_excerpts: List[str]
    verified_selections: int
    provider: Literal["gemini", "local"]
    status: Literal["generated", "fallback"]
    notice: Optional[str] = None
