from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authorization import is_course_teacher
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Course, Enrollment, User
from app.schemas.enrollments import EnrollmentResponse

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.post("/courses/{course_id}", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_in_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrollmentResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Запись на курс доступна только студентам.")

    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    enrollment = db.scalar(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == current_user.id)
    )
    if enrollment:
        return EnrollmentResponse.model_validate(enrollment)

    enrollment = Enrollment(
        student_id=current_user.id,
        course_id=course_id,
        status="active",
        enrolled_at=datetime.utcnow(),
        completed_at=None,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return EnrollmentResponse.model_validate(enrollment)


@router.get("/courses/{course_id}", response_model=list[EnrollmentResponse])
def list_course_enrollments(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EnrollmentResponse]:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    if current_user.role == "student":
        enrollments = db.scalars(
            select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == current_user.id)
        ).all()
    elif current_user.role == "admin" or is_course_teacher(course_id, current_user, db):
        enrollments = db.scalars(select(Enrollment).where(Enrollment.course_id == course_id)).all()
    else:
        raise HTTPException(status_code=403, detail="Нет доступа к списку записей на курс.")

    return [EnrollmentResponse.model_validate(item) for item in enrollments]
