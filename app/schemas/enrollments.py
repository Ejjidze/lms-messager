from datetime import datetime

from pydantic import BaseModel


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    status: str
    enrolled_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
