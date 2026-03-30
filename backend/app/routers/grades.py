from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authorization import is_course_teacher
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Grade, Submission, User
from app.schemas.grades import GradeCreate, GradeResponse

router = APIRouter(prefix="/grades", tags=["grades"])


@router.post("/submissions/{submission_id}", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
def grade_submission(
    submission_id: int,
    payload: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GradeResponse:
    submission = db.scalar(select(Submission).where(Submission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission не найден.")

    if current_user.role != "admin" and not is_course_teacher(submission.assignment.course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Оценивать может только преподаватель курса или администратор.")

    grade = db.scalar(select(Grade).where(Grade.submission_id == submission_id))
    if grade:
        grade.score = payload.score
        grade.max_score = payload.max_score
        grade.feedback = payload.feedback
        grade.graded_at = datetime.utcnow()
    else:
        grade = Grade(
            submission_id=submission.id,
            student_id=submission.student_id,
            teacher_id=current_user.id,
            score=payload.score,
            max_score=payload.max_score,
            feedback=payload.feedback,
            graded_at=datetime.utcnow(),
        )
        db.add(grade)

    submission.assignment.grade = payload.score
    submission.assignment.teacher_comment = payload.feedback
    db.commit()
    db.refresh(grade)
    return GradeResponse.model_validate(grade)


@router.get("/submissions/{submission_id}", response_model=GradeResponse)
def get_submission_grade(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GradeResponse:
    grade = db.scalar(select(Grade).where(Grade.submission_id == submission_id))
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена.")

    if current_user.role == "student" and grade.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой оценке.")
    if current_user.role == "teacher" and not is_course_teacher(grade.submission.assignment.course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к этой оценке.")

    return GradeResponse.model_validate(grade)
