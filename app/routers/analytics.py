from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.authorization import can_access_course, has_active_enrollment, is_course_teacher
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Course, CourseAnalyticsSummary, Enrollment, StudentCourseSummary, Submission, User
from app.schemas.analytics import (
    AnalyticsOverview,
    CompletionRateAnalytics,
    CourseAnalytics,
    LeaderboardEntry,
    RetentionAnalytics,
)
from app.services.analytics import refresh_all_materialized_summaries, refresh_course_materialized_summaries

router = APIRouter(prefix="/analytics", tags=["analytics"])

def ensure_all_summaries(db: Session) -> None:
    if not db.scalars(select(CourseAnalyticsSummary)).first():
        refresh_all_materialized_summaries(db)


def ensure_course_summary(db: Session, course_id: int) -> CourseAnalyticsSummary:
    summary = db.get(CourseAnalyticsSummary, course_id)
    if not summary:
        refresh_course_materialized_summaries(db, course_id)
        summary = db.get(CourseAnalyticsSummary, course_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Сводка по курсу не найдена.")
    return summary


@router.get("/overview", response_model=AnalyticsOverview)
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsOverview:
    ensure_all_summaries(db)
    courses = db.scalars(select(Course)).all()
    summaries = db.scalars(select(CourseAnalyticsSummary)).all()
    submissions = db.scalars(select(Submission)).all()

    if current_user.role == "student":
        enrollments = db.scalars(select(Enrollment).where(Enrollment.student_id == current_user.id)).all()
        student_summaries = db.scalars(select(StudentCourseSummary).where(StudentCourseSummary.student_id == current_user.id)).all()
        return AnalyticsOverview(
            role=current_user.role,
            total_courses=len([course for course in courses if has_active_enrollment(course.id, current_user, db)]),
            active_enrollments=len([item for item in enrollments if item.status == "active"]),
            pending_submissions=len(
                [item for item in submissions if item.student_id == current_user.id and item.status == "review"]
            ),
            average_grade=(
                round(
                    sum(item.average_grade for item in student_summaries if item.average_grade is not None)
                    / len([item for item in student_summaries if item.average_grade is not None]),
                    2,
                )
                if [item for item in student_summaries if item.average_grade is not None]
                else None
            ),
            average_progress=(
                round(sum(item.progress_percent for item in student_summaries) / len(student_summaries), 2)
                if student_summaries
                else None
            ),
        )

    if current_user.role == "teacher":
        teacher_courses = [course for course in courses if is_course_teacher(course.id, current_user, db)]
        course_ids = {course.id for course in teacher_courses}
        relevant_summaries = [item for item in summaries if item.course_id in course_ids]
        active_enrollments = (
            db.scalar(
                select(func.count(Enrollment.id)).where(
                    Enrollment.course_id.in_(course_ids),
                    Enrollment.status == "active",
                )
            )
            if course_ids
            else 0
        )
        pending_submissions = (
            db.scalar(
                select(func.count(Submission.id))
                .join(Assignment, Assignment.id == Submission.assignment_id)
                .where(Assignment.course_id.in_(course_ids), Submission.status == "review")
            )
            if course_ids
            else 0
        )
        return AnalyticsOverview(
            role=current_user.role,
            total_courses=len(teacher_courses),
            active_enrollments=active_enrollments or 0,
            pending_submissions=pending_submissions or 0,
            average_grade=(
                round(
                    sum(item.average_grade for item in relevant_summaries if item.average_grade is not None)
                    / len([item for item in relevant_summaries if item.average_grade is not None]),
                    2,
                )
                if [item for item in relevant_summaries if item.average_grade is not None]
                else None
            ),
            average_progress=(
                round(sum(item.average_progress for item in relevant_summaries if item.average_progress is not None)
                / len([item for item in relevant_summaries if item.average_progress is not None]), 2)
                if [item for item in relevant_summaries if item.average_progress is not None]
                else None
            ),
        )

    return AnalyticsOverview(
        role=current_user.role,
        total_courses=len(courses),
        active_enrollments=db.scalar(select(func.count(Enrollment.id)).where(Enrollment.status == "active")) or 0,
        pending_submissions=len([item for item in submissions if item.status == "review"]),
        average_grade=(
            round(
                sum(item.average_grade for item in summaries if item.average_grade is not None)
                / len([item for item in summaries if item.average_grade is not None]),
                2,
            )
            if [item for item in summaries if item.average_grade is not None]
            else None
        ),
        average_progress=(
            round(
                sum(item.average_progress for item in summaries if item.average_progress is not None)
                / len([item for item in summaries if item.average_progress is not None]),
                2,
            )
            if [item for item in summaries if item.average_progress is not None]
            else None
        ),
    )


@router.get("/courses/{course_id}", response_model=CourseAnalytics)
def get_course_analytics(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseAnalytics:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if not can_access_course(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к аналитике этого курса.")
    summary = ensure_course_summary(db, course_id)

    return CourseAnalytics(
        course_id=course_id,
        enrolled_students_count=summary.enrolled_students_count,
        submissions_count=summary.submissions_count,
        graded_submissions_count=summary.graded_submissions_count,
        average_grade=summary.average_grade,
        average_progress=summary.average_progress,
    )


@router.get("/courses/{course_id}/leaderboard", response_model=list[LeaderboardEntry])
def get_course_leaderboard(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaderboardEntry]:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if not can_access_course(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к leaderboard этого курса.")
    refresh_course_materialized_summaries(db, course_id)
    students_map = {
        item.id: item.full_name
        for item in db.scalars(select(User).join(Enrollment, Enrollment.student_id == User.id).where(Enrollment.course_id == course_id)).all()
    }
    rows = db.scalars(
        select(StudentCourseSummary).where(StudentCourseSummary.course_id == course_id).order_by(
            StudentCourseSummary.average_grade.desc().nullslast(),
            StudentCourseSummary.progress_percent.desc(),
            StudentCourseSummary.completed_lessons.desc(),
            StudentCourseSummary.passed_quizzes.desc(),
        )
    ).all()
    return [
        LeaderboardEntry(
            rank=index,
            student_id=row.student_id,
            student_name=students_map.get(row.student_id, f"Student #{row.student_id}"),
            average_grade=row.average_grade,
            progress_percent=row.progress_percent,
            completed_lessons=row.completed_lessons,
            passed_quizzes=row.passed_quizzes,
        )
        for index, row in enumerate(rows, start=1)
    ]


@router.get("/courses/{course_id}/retention", response_model=RetentionAnalytics)
def get_course_retention(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetentionAnalytics:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if current_user.role not in {"teacher", "admin"} or (
        current_user.role == "teacher" and not is_course_teacher(course_id, current_user, db)
    ):
        raise HTTPException(status_code=403, detail="Retention доступен только преподавателю курса или администратору.")
    summary = ensure_course_summary(db, course_id)
    return RetentionAnalytics(
        course_id=course_id,
        enrolled_students_count=summary.enrolled_students_count,
        active_last_7_days=summary.active_last_7_days,
        active_last_30_days=summary.active_last_30_days,
        retention_rate_7_days=summary.retention_rate_7_days,
        retention_rate_30_days=summary.retention_rate_30_days,
    )


@router.get("/courses/{course_id}/completion-rate", response_model=CompletionRateAnalytics)
def get_course_completion_rate(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompletionRateAnalytics:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if not can_access_course(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к completion rate этого курса.")
    summary = ensure_course_summary(db, course_id)
    return CompletionRateAnalytics(
        course_id=course_id,
        enrolled_students_count=summary.enrolled_students_count,
        completed_students_count=summary.completed_students_count,
        completion_rate=summary.completion_rate,
    )


@router.post("/refresh")
def refresh_all_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Полное обновление summaries доступно только администратору.")
    refresh_all_materialized_summaries(db)
    return {"status": "ok", "message": "Все analytics summaries обновлены."}


@router.post("/courses/{course_id}/refresh")
def refresh_course_analytics(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if current_user.role not in {"teacher", "admin"} or (
        current_user.role == "teacher" and not is_course_teacher(course_id, current_user, db)
    ):
        raise HTTPException(status_code=403, detail="Обновление analytics summaries доступно преподавателю курса или администратору.")
    refresh_course_materialized_summaries(db, course_id)
    return {"status": "ok", "message": f"Analytics summaries для курса {course_id} обновлены."}
