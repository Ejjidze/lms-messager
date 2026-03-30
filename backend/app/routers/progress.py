from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authorization import has_active_enrollment, is_course_teacher
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Course, Lesson, ProgressHistory, User
from app.schemas.progress import ProgressEventCreate, ProgressHistoryResponse

router = APIRouter(prefix="/progress", tags=["progress"])


@router.post("/courses/{course_id}", response_model=ProgressHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_progress_event(
    course_id: int,
    payload: ProgressEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressHistoryResponse:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    if current_user.role != "student" or not has_active_enrollment(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Добавлять прогресс может только записанный студент.")

    if payload.lesson_id is not None:
        lesson = db.scalar(select(Lesson).where(Lesson.id == payload.lesson_id))
        if not lesson:
            raise HTTPException(status_code=404, detail="Урок не найден.")
        if lesson.module.course_id != course_id:
            raise HTTPException(status_code=400, detail="Урок не относится к этому курсу.")

    progress = ProgressHistory(
        student_id=current_user.id,
        course_id=course_id,
        lesson_id=payload.lesson_id,
        event_type=payload.event_type,
        progress_percent=payload.progress_percent,
        created_at=datetime.utcnow(),
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    course.progress_percent = payload.progress_percent
    db.commit()
    return ProgressHistoryResponse.model_validate(progress)


@router.get("/courses/{course_id}", response_model=list[ProgressHistoryResponse])
def list_course_progress(
    course_id: int,
    student_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProgressHistoryResponse]:
    if not db.scalar(select(Course.id).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")

    query = select(ProgressHistory).where(ProgressHistory.course_id == course_id).order_by(ProgressHistory.created_at.desc())

    if current_user.role == "student":
        if not has_active_enrollment(course_id, current_user, db):
            raise HTTPException(status_code=403, detail="Нет доступа к прогрессу этого курса.")
        query = query.where(ProgressHistory.student_id == current_user.id)
    elif current_user.role == "teacher":
        if not is_course_teacher(course_id, current_user, db):
            raise HTTPException(status_code=403, detail="Нет доступа к прогрессу этого курса.")
        if student_id is not None:
            query = query.where(ProgressHistory.student_id == student_id)
    elif current_user.role == "admin":
        if student_id is not None:
            query = query.where(ProgressHistory.student_id == student_id)
    else:
        raise HTTPException(status_code=403, detail="Нет доступа к прогрессу.")

    items = db.scalars(query).all()
    return [ProgressHistoryResponse.model_validate(item) for item in items]
