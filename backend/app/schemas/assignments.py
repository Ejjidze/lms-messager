from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Assignment(BaseModel):
    id: int
    course_id: int
    title: str
    description: str
    deadline: datetime
    max_score: int = 100
    type: Literal["test", "file", "text"]
    status: str
    grade: int | None
    teacher_comment: str | None
    material_file_name: str | None = None
    material_file_url: str | None = None
    material_file_mime_type: str | None = None
    teacher_name: str | None = None
    can_delete: bool = False
    submissions_count: int = 0
    current_user_grade: int | None = None
    current_user_feedback: str | None = None

    model_config = {"from_attributes": True}


class Submission(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    student_name: str | None = None
    submitted_text: str | None
    submitted_file_name: str | None
    submitted_file_url: str | None
    submitted_file_mime_type: str | None
    status: str
    grade_score: int | None = None
    grade_max_score: int | None = None
    grade_feedback: str | None = None
    graded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionRequest(BaseModel):
    submitted_text: str | None = None
    submitted_file_name: str | None = None


class SubmissionResponse(BaseModel):
    submission_id: int
    assignment_id: int
    submitted_text: str | None
    submitted_file_name: str | None
    submitted_file_url: str | None = None
    submitted_file_mime_type: str | None = None
    status: str
    message: str


class AssignmentCreateResponse(BaseModel):
    assignment_id: int
    course_id: int
    title: str
    deadline: datetime
    max_score: int
    material_file_name: str
    material_file_url: str
    material_file_mime_type: str
    message: str
