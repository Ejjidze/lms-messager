from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, delete, distinct, func, select
from sqlalchemy.orm import Session, aliased

from app.models import (
    Assignment,
    Course,
    CourseAnalyticsSummary,
    Enrollment,
    Grade,
    ProgressHistory,
    Quiz,
    QuizAttempt,
    StudentCourseSummary,
    Submission,
    User,
)


def refresh_course_summary(db: Session, course_id: int) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    since_7 = now - timedelta(days=7)
    since_30 = now - timedelta(days=30)

    enrolled_students_count = db.scalar(
        select(func.count(distinct(Enrollment.student_id))).where(
            Enrollment.course_id == course_id,
            Enrollment.status.in_(("active", "completed")),
        )
    ) or 0

    submissions_count = db.scalar(
        select(func.count(Submission.id))
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.course_id == course_id)
    ) or 0

    graded_submissions_count = db.scalar(
        select(func.count(Grade.id))
        .join(Submission, Submission.id == Grade.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.course_id == course_id)
    ) or 0

    average_grade = db.scalar(
        select(func.avg(Grade.score))
        .join(Submission, Submission.id == Grade.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.course_id == course_id)
    )

    latest_progress_subquery = (
        select(
            ProgressHistory.student_id.label("student_id"),
            func.max(ProgressHistory.created_at).label("max_created_at"),
        )
        .where(ProgressHistory.course_id == course_id)
        .group_by(ProgressHistory.student_id)
        .subquery()
    )

    latest_progress = aliased(ProgressHistory)
    latest_progress_values = db.execute(
        select(latest_progress.student_id, latest_progress.progress_percent)
        .join(
            latest_progress_subquery,
            and_(
                latest_progress.student_id == latest_progress_subquery.c.student_id,
                latest_progress.created_at == latest_progress_subquery.c.max_created_at,
            ),
        )
        .where(latest_progress.course_id == course_id)
    ).all()
    progress_map = {student_id: progress_percent for student_id, progress_percent in latest_progress_values}
    average_progress = round(sum(progress_map.values()) / len(progress_map), 2) if progress_map else None
    completed_students_count = len([progress for progress in progress_map.values() if progress >= 100])
    completion_rate = round((completed_students_count / enrolled_students_count) * 100, 2) if enrolled_students_count else 0

    quiz_ids_subquery = select(Quiz.id).where(Quiz.course_id == course_id)
    active_last_7_days = len(
        set(
            list(
                db.scalars(
                    select(distinct(ProgressHistory.student_id)).where(
                        ProgressHistory.course_id == course_id,
                        ProgressHistory.created_at >= since_7,
                    )
                ).all()
            )
            + list(
                db.scalars(
                    select(distinct(QuizAttempt.student_id)).where(
                        QuizAttempt.quiz_id.in_(quiz_ids_subquery),
                        QuizAttempt.created_at >= since_7,
                    )
                ).all()
            )
        )
    )
    active_last_30_days = len(
        set(
            list(
                db.scalars(
                    select(distinct(ProgressHistory.student_id)).where(
                        ProgressHistory.course_id == course_id,
                        ProgressHistory.created_at >= since_30,
                    )
                ).all()
            )
            + list(
                db.scalars(
                    select(distinct(QuizAttempt.student_id)).where(
                        QuizAttempt.quiz_id.in_(quiz_ids_subquery),
                        QuizAttempt.created_at >= since_30,
                    )
                ).all()
            )
        )
    )
    retention_rate_7_days = round((active_last_7_days / enrolled_students_count) * 100, 2) if enrolled_students_count else 0
    retention_rate_30_days = round((active_last_30_days / enrolled_students_count) * 100, 2) if enrolled_students_count else 0

    summary = db.get(CourseAnalyticsSummary, course_id) or CourseAnalyticsSummary(course_id=course_id)
    summary.enrolled_students_count = enrolled_students_count
    summary.submissions_count = submissions_count
    summary.graded_submissions_count = graded_submissions_count
    summary.average_grade = float(average_grade) if average_grade is not None else None
    summary.average_progress = average_progress
    summary.completed_students_count = completed_students_count
    summary.completion_rate = completion_rate
    summary.active_last_7_days = active_last_7_days
    summary.active_last_30_days = active_last_30_days
    summary.retention_rate_7_days = retention_rate_7_days
    summary.retention_rate_30_days = retention_rate_30_days
    summary.refreshed_at = now
    db.merge(summary)


def refresh_student_summaries(db: Session, course_id: int) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    db.execute(delete(StudentCourseSummary).where(StudentCourseSummary.course_id == course_id))

    students = db.execute(
        select(Enrollment.student_id)
        .where(Enrollment.course_id == course_id, Enrollment.status.in_(("active", "completed")))
    ).scalars().all()

    quiz_ids = db.execute(select(Quiz.id).where(Quiz.course_id == course_id)).scalars().all()

    latest_progress_subquery = (
        select(
            ProgressHistory.student_id.label("student_id"),
            func.max(ProgressHistory.created_at).label("max_created_at"),
        )
        .where(ProgressHistory.course_id == course_id)
        .group_by(ProgressHistory.student_id)
        .subquery()
    )
    latest_progress = aliased(ProgressHistory)
    progress_rows = db.execute(
        select(latest_progress.student_id, latest_progress.progress_percent, latest_progress.created_at)
        .join(
            latest_progress_subquery,
            and_(
                latest_progress.student_id == latest_progress_subquery.c.student_id,
                latest_progress.created_at == latest_progress_subquery.c.max_created_at,
            ),
        )
        .where(latest_progress.course_id == course_id)
    ).all()
    progress_map = {row.student_id: (row.progress_percent, row.created_at) for row in progress_rows}

    for student_id in students:
        average_grade = db.scalar(
            select(func.avg(Grade.score))
            .join(Submission, Submission.id == Grade.submission_id)
            .join(Assignment, Assignment.id == Submission.assignment_id)
            .where(Assignment.course_id == course_id, Submission.student_id == student_id)
        )
        completed_lessons = db.scalar(
            select(func.count(distinct(ProgressHistory.lesson_id))).where(
                ProgressHistory.course_id == course_id,
                ProgressHistory.student_id == student_id,
                ProgressHistory.event_type == "lesson_completed",
                ProgressHistory.lesson_id.is_not(None),
            )
        ) or 0
        passed_quizzes = db.scalar(
            select(func.count(distinct(QuizAttempt.quiz_id))).where(
                QuizAttempt.student_id == student_id,
                QuizAttempt.quiz_id.in_(quiz_ids) if quiz_ids else False,
                QuizAttempt.passed.is_(True),
            )
        ) if quiz_ids else 0
        progress_percent, last_activity_at = progress_map.get(student_id, (0, None))
        db.add(
            StudentCourseSummary(
                course_id=course_id,
                student_id=student_id,
                average_grade=float(average_grade) if average_grade is not None else None,
                progress_percent=progress_percent,
                completed_lessons=completed_lessons,
                passed_quizzes=passed_quizzes or 0,
                last_activity_at=last_activity_at,
                refreshed_at=now,
            )
        )


def refresh_course_materialized_summaries(db: Session, course_id: int) -> None:
    refresh_course_summary(db, course_id)
    refresh_student_summaries(db, course_id)
    db.commit()


def refresh_all_materialized_summaries(db: Session) -> None:
    course_ids = db.execute(select(Course.id)).scalars().all()
    for course_id in course_ids:
        refresh_course_summary(db, course_id)
        refresh_student_summaries(db, course_id)
    db.commit()
