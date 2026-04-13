from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Assignment, Chat, Course, Enrollment, Submission, User


def is_course_teacher(course_id: int, user: User, db: Session) -> bool:
    if user.role == "admin":
        return True
    course = db.scalar(select(Course).where(Course.id == course_id))
    return bool(course and course.teacher_id == user.id)


def has_active_enrollment(course_id: int, user: User, db: Session) -> bool:
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == user.id,
            Enrollment.status.in_(("active", "completed")),
        )
    )
    return enrollment is not None


def can_access_course(course_id: int, user: User, db: Session) -> bool:
    if user.role == "admin":
        return True
    if user.role == "teacher":
        return is_course_teacher(course_id, user, db)
    if user.role == "student":
        return has_active_enrollment(course_id, user, db)
    return False


def require_chat_participant(chat: Chat | None, user: User, db: Session) -> Chat:
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Чат не найден.")
    if chat.course_id is not None:
        if not can_access_course(chat.course_id, user, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к чату курса.")
        return chat
    if user.id not in chat.participant_ids and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этому чату.")
    return chat


def chat_visible_to_user(chat: Chat, user: User, db: Session) -> bool:
    if user.role == "admin":
        return True
    if chat.course_id is not None:
        return can_access_course(chat.course_id, user, db)
    return user.id in chat.participant_ids


def filter_chats_for_user(chats: list[Chat], user: User, db: Session) -> list[Chat]:
    return [chat for chat in chats if chat_visible_to_user(chat, user, db)]


def assignment_visible_to_user(assignment: Assignment, user: User, db: Session) -> bool:
    if user.role == "admin":
        return True
    if user.role == "teacher":
        return assignment.created_by_teacher_id == user.id
    if user.role == "student":
        return True
    return False


def require_assignment_submit_access(assignment: Assignment | None, user: User, db: Session) -> Assignment:
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задание не найдено.")
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Отправка решений доступна только студентам.",
        )
    return assignment


def require_assignment_review_access(assignment: Assignment | None, user: User, db: Session) -> Assignment:
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задание не найдено.")
    if user.role == "admin":
        return assignment
    if user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Просмотр всех решений доступен только преподавателю курса или администратору.",
        )
    if assignment.created_by_teacher_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Просматривать решения можно только по своим заданиям.",
        )
    return assignment


def submissions_query_for_user(db: Session, assignment_id: int, user: User) -> list[Submission]:
    query = select(Submission).where(Submission.assignment_id == assignment_id).order_by(Submission.created_at.desc())
    if user.role == "student":
        query = query.where(Submission.student_id == user.id)
    return db.scalars(query).all()
