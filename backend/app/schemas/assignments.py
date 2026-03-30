from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Assignment(BaseModel):
    id: int
    course_id: int
    title: str
    description: str
    deadline: datetime
    type: Literal["test", "file", "text"]
    status: str
    grade: int | None
    teacher_comment: str | None

    model_config = {"from_attributes": True}


class SubmissionRequest(BaseModel):
    submitted_text: str | None = None
    submitted_file_name: str | None = None


class SubmissionResponse(BaseModel):
    assignment_id: int
    submitted_text: str | None
    submitted_file_name: str | None
    status: str
    message: str
