from fastapi import APIRouter, HTTPException

from app.schemas.study import (
    AssessmentStartRequest,
    AssessmentStartResponse,
    QuizEvaluateRequest,
    QuizEvaluateResponse,
    QuizGenerateRequest,
    QuizGenerateResponse,
)
from app.services.study_service import (
    StudyScopeError,
    evaluate_quiz,
    generate_assessment,
    generate_quiz,
)


router = APIRouter(prefix="/api/study", tags=["Study"])


@router.post("/assessment", response_model=AssessmentStartResponse)
async def create_assessment(req: AssessmentStartRequest):
    try:
        return await generate_assessment(req)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu") from error
    except StudyScopeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/quiz", response_model=QuizGenerateResponse)
async def create_quiz(req: QuizGenerateRequest):
    try:
        return await generate_quiz(req)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu") from error
    except StudyScopeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/evaluate", response_model=QuizEvaluateResponse)
async def evaluate_answer(req: QuizEvaluateRequest):
    try:
        return await evaluate_quiz(req)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu") from error
    except StudyScopeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
