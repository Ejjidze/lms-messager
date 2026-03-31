from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course, Lesson, Module, ProgressHistory, Quiz, QuizAttempt


def calculate_course_progress(db: Session, course_id: int, student_id: int) -> int:
    lesson_ids = db.scalars(
        select(Lesson.id).join(Module, Lesson.module_id == Module.id).where(Module.course_id == course_id)
    ).all()
    quiz_ids = db.scalars(select(Quiz.id).where(Quiz.course_id == course_id)).all()

    total_units = len(set(lesson_ids)) + len(set(quiz_ids))
    if total_units == 0:
        return 0

    completed_lesson_ids = {
        item.lesson_id
        for item in db.scalars(
            select(ProgressHistory).where(
                ProgressHistory.course_id == course_id,
                ProgressHistory.student_id == student_id,
                ProgressHistory.event_type == "lesson_completed",
                ProgressHistory.lesson_id.is_not(None),
            )
        ).all()
        if item.lesson_id is not None
    }

    if quiz_ids:
        passed_quiz_ids = {
            item.quiz_id
            for item in db.scalars(
                select(QuizAttempt).where(
                    QuizAttempt.student_id == student_id,
                    QuizAttempt.quiz_id.in_(quiz_ids),
                    QuizAttempt.passed.is_(True),
                )
            ).all()
        }
    else:
        passed_quiz_ids = set()

    completed_units = len(completed_lesson_ids) + len(passed_quiz_ids)
    return round((completed_units / total_units) * 100)


def record_progress_event(
    db: Session,
    *,
    student_id: int,
    course_id: int,
    lesson_id: int | None,
    event_type: str,
) -> ProgressHistory:
    progress_percent = calculate_course_progress(db, course_id, student_id)
    event = ProgressHistory(
        student_id=student_id,
        course_id=course_id,
        lesson_id=lesson_id,
        event_type=event_type,
        progress_percent=progress_percent,
        created_at=datetime.utcnow(),
    )
    db.add(event)
    course = db.scalar(select(Course).where(Course.id == course_id))
    if course:
        course.progress_percent = progress_percent
    db.commit()
    db.refresh(event)
    return event
