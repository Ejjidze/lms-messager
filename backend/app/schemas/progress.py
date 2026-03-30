from datetime import datetime

from pydantic import BaseModel


class ProgressEventCreate(BaseModel):
    lesson_id: int | None = None
    event_type: str = "lesson_completed"
    progress_percent: int


class ProgressHistoryResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    lesson_id: int | None
    event_type: str
    progress_percent: int
    created_at: datetime

    model_config = {"from_attributes": True}
