from typing import Literal

from pydantic import BaseModel, Field


class ProductAdviceRequest(BaseModel):
    need: str = Field(min_length=2, max_length=1000)


class RevenueAnalysisRequest(BaseModel):
    period: Literal["7", "30", "all"] = "7"


class SalesQuestionRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class AITextResponse(BaseModel):
    answer: str
    model: str
    token_used: int = 0
    source: Literal["gemini"] = "gemini"
