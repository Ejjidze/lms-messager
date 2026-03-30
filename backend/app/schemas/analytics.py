from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
    role: str
    total_courses: int
    active_enrollments: int
    pending_submissions: int
    average_grade: float | None
    average_progress: float | None


class CourseAnalytics(BaseModel):
    course_id: int
    enrolled_students_count: int
    submissions_count: int
    graded_submissions_count: int
    average_grade: float | None
    average_progress: float | None


class LeaderboardEntry(BaseModel):
    rank: int
    student_id: int
    student_name: str
    average_grade: float | None
    progress_percent: int
    completed_lessons: int
    passed_quizzes: int


class RetentionAnalytics(BaseModel):
    course_id: int
    enrolled_students_count: int
    active_last_7_days: int
    active_last_30_days: int
    retention_rate_7_days: float
    retention_rate_30_days: float


class CompletionRateAnalytics(BaseModel):
    course_id: int
    enrolled_students_count: int
    completed_students_count: int
    completion_rate: float
