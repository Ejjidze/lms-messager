from datetime import datetime

from pydantic import BaseModel


class GradeCreate(BaseModel):
    score: int
    max_score: int = 100
    feedback: str | None = None


class GradeResponse(BaseModel):
    id: int
    submission_id: int
    student_id: int
    teacher_id: int
    score: int
    max_score: int
    feedback: str | None
    graded_at: datetime

    model_config = {"from_attributes": True}
