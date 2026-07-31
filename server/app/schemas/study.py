from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


PageNumber = Annotated[int, Field(strict=True, ge=1)]


class StudySource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: PageNumber
    claim: str = Field(min_length=1, max_length=1500)
    evidence_quote: str = Field(min_length=12, max_length=6000)


class QuizGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(
        default="lesson-01",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    source: StudySource
    language: Literal["VI", "EN"] = "VI"


class QuizGenerateResponse(BaseModel):
    question: str
    hint: Optional[str] = None
    source_page: int
    provider: Literal["xah", "local"]
    status: Literal["generated", "fallback"]
    notice: Optional[str] = None


class AssessmentStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(
        default="lesson-01",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    source: StudySource
    language: Literal["VI", "EN"] = "VI"


class AssessmentStartResponse(BaseModel):
    assessment_id: str
    pre_question: str
    post_question: str
    source_page: int
    provider: Literal["xah", "local"]
    status: Literal["generated", "fallback"]
    notice: Optional[str] = None


class QuizEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(
        default="lesson-01",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    source: StudySource
    question: str = Field(min_length=1, max_length=1500)
    answer: str = Field(min_length=1, max_length=4000)
    language: Literal["VI", "EN"] = "VI"
    assessment_id: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    stage: Literal["single", "pre", "post"] = "single"


class QuizEvaluateResponse(BaseModel):
    verdict: Literal["correct", "partial", "incorrect"]
    score: Literal[0, 50, 100]
    feedback: str
    next_step: str
    source_page: int
    provider: Literal["xah", "local"]
    status: Literal["evaluated", "fallback"]
    notice: Optional[str] = None
