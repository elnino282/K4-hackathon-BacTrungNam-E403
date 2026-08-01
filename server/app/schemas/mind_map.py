from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class MindMapPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=20_000)


class MindMapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: list[MindMapPage] = Field(min_length=1, max_length=60)
    scope: Literal["current_page", "selected_pages", "whole_lecture"]
    depth: Literal["overview", "normal", "detailed"]


class MindMapNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(max_length=1_000)
    page_references: list[Annotated[int, Field(ge=1)]] = Field(
        default_factory=list,
        max_length=60,
    )
    children: list["MindMapNode"] = Field(default_factory=list, max_length=30)
