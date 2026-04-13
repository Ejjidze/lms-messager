from datetime import datetime, timedelta
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Assignment,
    Course,
    Enrollment,
    Message,
    ModerationReport,
    PlatformSetting,
    ProgressHistory,
    SecurityEvent,
    Submission,
    User,
)
from app.schemas.admin import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminSystemAnalytics,
    AdminUserItem,
    BlockUserRequest,
    BulkEnrollRequest,
    ModerationReportCreate,
    ModerationReportItem,
    ModerationReportResolve,
    MoveDeadlineRequest,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    ReassignTeacherRequest,
    ResetPasswordRequest,
    SecurityEventItem,
    UpdateUserRoleRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def ensure_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ только для администратора.")


def log_security_event(
    db: Session,
    event_type: str,
    severity: str = "info",
    details: str = "",
    user_id: int | None = None,
) -> None:
    db.add(
        SecurityEvent(
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            details=details,
            created_at=datetime.utcnow(),
        )
    )


def get_setting(db: Session, key: str, default: str) -> str:
    row = db.get(PlatformSetting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(PlatformSetting, key)
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
        return
    db.add(PlatformSetting(key=key, value=value, updated_at=datetime.utcnow()))


def build_student_bio_payload(profile) -> str:
    scholarship = "Да" if profile.scholarship else "Нет"
    return (
        f"Куратор: {profile.curator}\n"
        f"Направление: {profile.direction}\n"
        f"Степень: {profile.degree}\n"
        f"Курс: {profile.study_year}\n"
        f"Язык обучения: {profile.language.upper()}\n"
        f"Тип обучения: {profile.study_type}\n"
        f"Группа: {profile.group_name}\n"
        f"Стипендия: {scholarship}"
    )


@router.get("/users", response_model=list[AdminUserItem])
def list_admin_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AdminUserItem]:
    ensure_admin(current_user)
    users = db.scalars(select(User).order_by(User.id)).all()
    return [AdminUserItem.model_validate(item) for item in users]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    payload: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    existing = db.scalar(select(User).where(User.email == payload.login.strip()))
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует.")

    bio = ""
    if payload.role == "student":
        if not payload.student_profile:
            raise HTTPException(status_code=400, detail="Для студента нужно заполнить профиль.")
        bio = build_student_bio_payload(payload.student_profile)

    user = User(
        email=payload.login.strip(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        bio=bio,
        avatar="EF",
        online=False,
        is_blocked=False,
        blocked_until=None,
        session_revoked_at=None,
        last_login_at=None,
    )
    db.add(user)
    db.flush()
    log_security_event(
        db,
        event_type="admin_user_created",
        details=f"admin={current_user.id}; user={user.id}; role={user.role}",
        user_id=user.id,
    )
    db.commit()
    return {"status": "ok", "user_id": user.id, "message": "Пользователь добавлен."}


@router.patch("/users/{user_id}")
def update_user_by_admin(
    user_id: int,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    if payload.login is not None:
        login = payload.login.strip()
        existing = db.scalar(select(User).where(User.email == login, User.id != user.id))
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует.")
        user.email = login

    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.session_revoked_at = datetime.utcnow()

    if user.role == "student" and payload.student_profile:
        user.bio = build_student_bio_payload(payload.student_profile)

    log_security_event(
        db,
        event_type="admin_user_updated",
        details=f"admin={current_user.id}; user={user.id}",
        user_id=user.id,
    )
    db.commit()
    return {"status": "ok", "message": "Данные пользователя обновлены."}


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя менять свою роль.")
    old_role = user.role
    user.role = payload.role
    log_security_event(
        db,
        event_type="admin_role_changed",
        details=f"admin={current_user.id}; user={user.id}; from={old_role}; to={payload.role}",
        user_id=user.id,
    )
    db.commit()
    return {"status": "ok", "message": "Роль обновлена."}


@router.post("/users/{user_id}/block")
def block_user(
    user_id: int,
    payload: BlockUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    raise HTTPException(status_code=403, detail="Функция блокировки отключена.")


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")
    user.password_hash = hash_password(payload.new_password)
    user.session_revoked_at = datetime.utcnow()
    log_security_event(
        db,
        event_type="admin_password_reset",
        severity="warning",
        details=f"admin={current_user.id}; user={user.id}",
        user_id=user.id,
    )
    db.commit()
    return {"status": "ok", "message": "Пароль сброшен."}


@router.post("/users/{user_id}/force-logout")
def force_logout_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    raise HTTPException(status_code=403, detail="Функция принудительного logout отключена.")


@router.post("/courses/{course_id}/teacher")
def reassign_course_teacher(
    course_id: int,
    payload: ReassignTeacherRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    course_model = db.get(Course, course_id)
    if not course_model:
        raise HTTPException(status_code=404, detail="Курс не найден.")
    teacher = db.get(User, payload.teacher_id)
    if not teacher or teacher.role != "teacher":
        raise HTTPException(status_code=400, detail="Нужно указать преподавателя.")
    course_model.teacher_id = teacher.id
    log_security_event(
        db,
        event_type="admin_reassign_teacher",
        details=f"admin={current_user.id}; course={course_model.id}; teacher={teacher.id}",
        user_id=teacher.id,
    )
    db.commit()
    return {"status": "ok", "message": "Преподаватель курса обновлен."}


@router.post("/courses/{course_id}/enrollments/bulk")
def bulk_enroll_students(
    course_id: int,
    payload: BulkEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    from app.models import Course

    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    added = 0
    for student_id in payload.student_ids:
        student = db.get(User, student_id)
        if not student or student.role != "student":
            continue
        exists = db.scalar(
            select(Enrollment).where(
                Enrollment.course_id == course_id,
                Enrollment.student_id == student_id,
            )
        )
        if exists:
            continue
        db.add(
            Enrollment(
                course_id=course_id,
                student_id=student_id,
                status="active",
                enrolled_at=datetime.utcnow(),
                completed_at=None,
            )
        )
        added += 1

    log_security_event(
        db,
        event_type="admin_bulk_enrollment",
        details=f"admin={current_user.id}; course={course_id}; added={added}",
    )
    db.commit()
    return {"status": "ok", "added": added}


@router.patch("/assignments/{assignment_id}/deadline")
def move_assignment_deadline(
    assignment_id: int,
    payload: MoveDeadlineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено.")
    assignment.deadline = payload.deadline
    log_security_event(
        db,
        event_type="admin_deadline_moved",
        details=f"admin={current_user.id}; assignment={assignment_id}; deadline={payload.deadline.isoformat()}",
    )
    db.commit()
    return {"status": "ok", "message": "Дедлайн обновлен."}


@router.post("/moderation/reports", response_model=ModerationReportItem, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ModerationReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModerationReportItem:
    report = ModerationReport(
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason.strip(),
        status="open",
        resolution_note=None,
        created_at=datetime.utcnow(),
        resolved_at=None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ModerationReportItem(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=current_user.full_name,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        status=report.status,
        resolution_note=report.resolution_note,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )


@router.get("/moderation/reports", response_model=list[ModerationReportItem])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ModerationReportItem]:
    ensure_admin(current_user)
    items = db.scalars(select(ModerationReport).options(joinedload(ModerationReport.reporter)).order_by(ModerationReport.created_at.desc())).all()
    return [
        ModerationReportItem(
            id=item.id,
            reporter_id=item.reporter_id,
            reporter_name=item.reporter.full_name if item.reporter else None,
            target_type=item.target_type,
            target_id=item.target_id,
            reason=item.reason,
            status=item.status,
            resolution_note=item.resolution_note,
            created_at=item.created_at,
            resolved_at=item.resolved_at,
        )
        for item in items
    ]


@router.patch("/moderation/reports/{report_id}")
def resolve_report(
    report_id: int,
    payload: ModerationReportResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_admin(current_user)
    report = db.get(ModerationReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена.")
    report.status = payload.status
    report.resolution_note = payload.resolution_note
    report.resolved_at = datetime.utcnow()
    log_security_event(
        db,
        event_type="admin_report_resolved",
        details=f"admin={current_user.id}; report={report_id}; status={payload.status}",
    )
    db.commit()
    return {"status": "ok", "message": "Жалоба обновлена."}


@router.delete("/moderation/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message_as_admin(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    ensure_admin(current_user)
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено.")
    db.delete(message)
    log_security_event(
        db,
        event_type="admin_message_deleted",
        severity="warning",
        details=f"admin={current_user.id}; message={message_id}",
    )
    db.commit()


def _extract_group(text: str) -> str:
    match = re.search(r"(\d{3}-\d{2}\s*[A-Za-zА-Яа-я]+)", text or "")
    if match:
        return match.group(1).strip()
    return "Unknown"


@router.get("/analytics/system", response_model=AdminSystemAnalytics)
def system_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminSystemAnalytics:
    ensure_admin(current_user)
    now = datetime.utcnow()
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.online.is_(True))) or 0
    total_courses = db.scalar(select(func.count(Course.id))) or 0
    overdue_assignments = db.scalar(
        select(func.count(Assignment.id)).where(Assignment.deadline < now)
    ) or 0
    pending_submissions = db.scalar(select(func.count(Submission.id)).where(Submission.status == "review")) or 0

    students = db.scalars(select(User).where(User.role == "student")).all()
    active_student_ids = {
        item[0]
        for item in db.execute(
            select(func.distinct(ProgressHistory.student_id)).where(
                ProgressHistory.created_at >= (now - timedelta(days=30))
            )
        ).all()
    }
    grouped: dict[str, dict[str, int | float]] = {}
    for student in students:
        group = _extract_group(student.bio or "")
        payload = grouped.setdefault(group, {"total": 0, "active_30_days": 0, "retention_rate_30_days": 0.0})
        payload["total"] = int(payload["total"]) + 1
        if student.id in active_student_ids:
            payload["active_30_days"] = int(payload["active_30_days"]) + 1
    retention_by_group = []
    for group_name, payload in grouped.items():
        total = int(payload["total"])
        active = int(payload["active_30_days"])
        retention_by_group.append(
            {
                "group": group_name,
                "total": total,
                "active_30_days": active,
                "retention_rate_30_days": round((active / total) * 100, 2) if total else 0.0,
            }
        )

    return AdminSystemAnalytics(
        total_users=total_users,
        active_users=active_users,
        total_courses=total_courses,
        overdue_assignments=overdue_assignments,
        pending_submissions=pending_submissions,
        retention_by_group=sorted(retention_by_group, key=lambda item: item["group"]),
    )


@router.get("/settings", response_model=PlatformSettingsResponse)
def get_platform_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlatformSettingsResponse:
    ensure_admin(current_user)
    return PlatformSettingsResponse(
        max_upload_mb=int(get_setting(db, "max_upload_mb", "50")),
        grading_policy=get_setting(db, "grading_policy", "standard"),
        cron_expression=get_setting(db, "cron_expression", "*/15 * * * *"),
    )


@router.put("/settings", response_model=PlatformSettingsResponse)
def update_platform_settings(
    payload: PlatformSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlatformSettingsResponse:
    ensure_admin(current_user)
    set_setting(db, "max_upload_mb", str(payload.max_upload_mb))
    set_setting(db, "grading_policy", payload.grading_policy.strip())
    set_setting(db, "cron_expression", payload.cron_expression.strip())
    log_security_event(
        db,
        event_type="admin_settings_updated",
        details=f"admin={current_user.id}; max_upload_mb={payload.max_upload_mb}; cron={payload.cron_expression}",
    )
    db.commit()
    return PlatformSettingsResponse(
        max_upload_mb=payload.max_upload_mb,
        grading_policy=payload.grading_policy.strip(),
        cron_expression=payload.cron_expression.strip(),
    )


@router.get("/security-events", response_model=list[SecurityEventItem])
def list_security_events(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SecurityEventItem]:
    ensure_admin(current_user)
    safe_limit = min(max(limit, 1), 500)
    items = db.scalars(
        select(SecurityEvent).options(joinedload(SecurityEvent.user)).order_by(SecurityEvent.created_at.desc()).limit(safe_limit)
    ).all()
    return [
        SecurityEventItem(
            id=item.id,
            user_id=item.user_id,
            user_name=item.user.full_name if item.user else None,
            event_type=item.event_type,
            severity=item.severity,
            details=item.details,
            created_at=item.created_at,
        )
        for item in items
    ]
