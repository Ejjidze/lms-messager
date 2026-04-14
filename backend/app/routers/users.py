from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AttendanceRecord, User
from app.schemas.users import (
    AttendanceDayEntry,
    AttendanceMarkRequest,
    AttendanceMarkResponse,
    AttendanceSummaryEntry,
    UserPublic,
)

router = APIRouter(prefix="/users", tags=["users"])
MAX_NB_PER_STUDENT = 72


def validate_attendance_date(attendance_date: date) -> None:
    if attendance_date.weekday() == 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя выставлять посещаемость на воскресенье.",
        )


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserPublic]:
    return [UserPublic.model_validate(user) for user in db.scalars(select(User).order_by(User.id)).all()]


@router.get("/directory", response_model=list[UserPublic])
def list_directory_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    query = select(User).order_by(User.full_name)

    if current_user.role == "student":
        query = query.where(User.role == "teacher")
    elif current_user.role == "teacher":
        query = query.where(User.role == "student")
    else:
        query = query.where(User.role.in_(("student", "teacher")))

    return [UserPublic.model_validate(user) for user in db.scalars(query).all()]


@router.get("/attendance", response_model=list[AttendanceDayEntry])
def list_attendance_for_date(
    date_value: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceDayEntry]:
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только преподаватель может просматривать посещаемость.")
    validate_attendance_date(date_value)

    rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.teacher_id == current_user.id,
            AttendanceRecord.attendance_date == date_value,
        )
    ).all()
    return [AttendanceDayEntry(student_id=row.student_id, status="NB") for row in rows]


@router.get("/me/attendance-summary", response_model=list[AttendanceSummaryEntry])
def get_attendance_summary_for_student(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceSummaryEntry]:
    if current_user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступно только студенту.")

    rows = db.scalars(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.student_id == current_user.id,
            AttendanceRecord.status == "NB",
        )
        .order_by(AttendanceRecord.attendance_date.desc())
    ).all()

    grouped: dict[int, list[date]] = {}
    for row in rows:
        grouped.setdefault(int(row.teacher_id), []).append(row.attendance_date)

    return [
        AttendanceSummaryEntry(
            teacher_id=teacher_id,
            nb_count=len(dates),
            dates=dates,
        )
        for teacher_id, dates in grouped.items()
    ]


@router.post("/{student_id}/attendance", response_model=AttendanceMarkResponse)
def set_attendance(
    student_id: int,
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceMarkResponse:
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только преподаватель может выставлять посещаемость.")
    validate_attendance_date(payload.date)

    student = db.scalar(select(User).where(User.id == student_id))
    if not student or student.role != "student":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Студент не найден.")

    existing = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.teacher_id == current_user.id,
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.attendance_date == payload.date,
        )
    )

    if payload.is_absent:
        if not existing:
            total_nb = db.scalar(
                select(func.count(AttendanceRecord.id)).where(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.status == "NB",
                )
            ) or 0
            if int(total_nb) >= MAX_NB_PER_STUDENT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Достигнут максимум НБ для студента: {MAX_NB_PER_STUDENT}.",
                )
        if not existing:
            existing = AttendanceRecord(
                teacher_id=current_user.id,
                student_id=student_id,
                attendance_date=payload.date,
                status="NB",
            )
            db.add(existing)
        else:
            existing.status = "NB"
        db.commit()
        return AttendanceMarkResponse(student_id=student_id, date=payload.date, status="NB")

    if existing:
        db.delete(existing)
        db.commit()
    return AttendanceMarkResponse(student_id=student_id, date=payload.date, status="")
