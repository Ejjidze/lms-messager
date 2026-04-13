from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AdminUserItem(BaseModel):
    id: int
    email: str
    full_name: str
    bio: str
    role: Literal["student", "teacher", "admin"]
    online: bool
    is_blocked: bool
    blocked_until: datetime | None
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UpdateUserRoleRequest(BaseModel):
    role: Literal["student", "teacher", "admin"]


class BlockUserRequest(BaseModel):
    blocked: bool = True
    hours: int | None = Field(default=None, ge=1, le=24 * 30)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class BulkEnrollRequest(BaseModel):
    student_ids: list[int]


class ReassignTeacherRequest(BaseModel):
    teacher_id: int


class StudentProfileInput(BaseModel):
    curator: str = Field(min_length=2, max_length=255)
    direction: str = Field(min_length=2, max_length=255)
    degree: str = Field(min_length=2, max_length=120)
    study_year: int = Field(ge=1, le=4)
    language: Literal["ru", "uz", "en"]
    study_type: str = Field(min_length=2, max_length=120)
    group_name: str = Field(min_length=2, max_length=120)
    scholarship: bool = False


class AdminUserCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    login: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "teacher", "admin"]
    student_profile: StudentProfileInput | None = None


class AdminUserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    login: str | None = Field(default=None, min_length=3, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    student_profile: StudentProfileInput | None = None


class MoveDeadlineRequest(BaseModel):
    deadline: datetime


class ModerationReportCreate(BaseModel):
    target_type: Literal["message", "attachment", "user", "course"]
    target_id: int
    reason: str = Field(min_length=5, max_length=2000)


class ModerationReportResolve(BaseModel):
    status: Literal["resolved", "rejected"]
    resolution_note: str | None = Field(default=None, max_length=2000)


class ModerationReportItem(BaseModel):
    id: int
    reporter_id: int
    reporter_name: str | None = None
    target_type: str
    target_id: int
    reason: str
    status: str
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None


class SecurityEventItem(BaseModel):
    id: int
    user_id: int | None
    user_name: str | None = None
    event_type: str
    severity: str
    details: str
    created_at: datetime


class AdminSystemAnalytics(BaseModel):
    total_users: int
    active_users: int
    total_courses: int
    overdue_assignments: int
    pending_submissions: int
    retention_by_group: list[dict]


class PlatformSettingsResponse(BaseModel):
    max_upload_mb: int
    grading_policy: str
    cron_expression: str


class PlatformSettingsUpdate(BaseModel):
    max_upload_mb: int = Field(ge=1, le=500)
    grading_policy: str = Field(min_length=1, max_length=200)
    cron_expression: str = Field(min_length=3, max_length=120)
