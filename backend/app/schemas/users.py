from datetime import date
from typing import Literal

from pydantic import BaseModel


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: str
    role: Literal["student", "teacher", "admin"]
    bio: str
    avatar: str
    online: bool

    model_config = {"from_attributes": True}


class AttendanceMarkRequest(BaseModel):
    date: date
    is_absent: bool = True


class AttendanceMarkResponse(BaseModel):
    student_id: int
    date: date
    status: Literal["NB", ""]


class AttendanceDayEntry(BaseModel):
    student_id: int
    status: Literal["NB"]


class AttendanceSummaryEntry(BaseModel):
    teacher_id: int
    nb_count: int
    dates: list[date] = []
