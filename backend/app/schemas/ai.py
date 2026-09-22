from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ProductAdviceRequest(BaseModel):
    need: str = Field(min_length=2, max_length=1000)


class RevenueAnalysisRequest(BaseModel):
    period: Literal["7", "30", "all", "custom"] = "7"
    fromDate: Optional[date] = None
    toDate: Optional[date] = None
    focus: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_custom_range(self):
        if self.period == "custom":
            if self.fromDate is None or self.toDate is None:
                raise ValueError("Phạm vi tùy chọn cần có ngày bắt đầu và ngày kết thúc")
            if self.fromDate > self.toDate:
                raise ValueError("Ngày bắt đầu không được sau ngày kết thúc")
        return self


class SalesQuestionRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class AITextResponse(BaseModel):
    answer: str
    model: str
    token_used: int = 0
    source: Literal["gemini"] = "gemini"
