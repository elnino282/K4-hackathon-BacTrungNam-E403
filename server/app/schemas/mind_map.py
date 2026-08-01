from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PageNumber = Annotated[int, Field(strict=True, ge=1)]
MindMapScope = Literal["current_page", "selected_pages", "whole_lecture"]
MindMapDepth = Literal["overview", "normal", "detailed"]


class MindMapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: MindMapScope = "whole_lecture"
    depth: MindMapDepth = "normal"
    current_page: PageNumber | None = None
    start_page: PageNumber | None = None
    end_page: PageNumber | None = None

    @model_validator(mode="after")
    def validate_scope_pages(self):
        if self.scope == "current_page" and self.current_page is None:
            raise ValueError("current_page là bắt buộc với phạm vi trang hiện tại")
        if self.scope == "selected_pages":
            if self.start_page is None or self.end_page is None:
                raise ValueError(
                    "start_page và end_page là bắt buộc với khoảng trang"
                )
            if self.start_page > self.end_page:
                raise ValueError("start_page không được lớn hơn end_page")
        return self


class MindMapNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1_000)
    page_references: list[PageNumber] = Field(
        default_factory=list,
        max_length=60,
    )
    children: list["MindMapNode"] = Field(default_factory=list, max_length=30)


class MindMapResponse(BaseModel):
    mind_map: MindMapNode
    scope: MindMapScope
    depth: MindMapDepth
    source_pages: list[PageNumber]
    source_signature: str = Field(min_length=1, max_length=64)
    node_count: int = Field(ge=1, le=200)
