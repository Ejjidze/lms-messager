import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import PlatformSetting, User
from app.schemas.schedule import WeeklySchedule

router = APIRouter(prefix="/schedule", tags=["schedule"])
SCHEDULE_SETTING_KEY_321 = "weekly_schedule_321_v1"
SCHEDULE_SETTING_KEY_320 = "weekly_schedule_320_v1"

DEFAULT_WEEKLY_SCHEDULE_321 = WeeklySchedule(
    days=[
        {
            "day_key": "monday",
            "day_label": "ПОНЕДЕЛЬНИК",
            "lessons": [
                {"time": "08:30", "subject": "", "room": ""},
                {"time": "10:00", "subject": "Индивидуальный проект (DI)-INP202", "room": "D-310"},
                {"time": "11:30", "subject": "Архитектура ПО (T)-SWA201", "room": "E-312"},
                {"time": "12:15", "subject": "Разработка мобильных приложений (DI)-MAD201", "room": "E-312"},
            ],
        },
        {
            "day_key": "tuesday",
            "day_label": "ВТОРНИК",
            "lessons": [
                {"time": "08:30", "subject": "Обеспечение качества ПО (4 кр)-SFQ201", "room": "A-405"},
                {"time": "10:00", "subject": "Архитектура ПО (T)-SWA201-2", "room": "E-310"},
            ],
        },
        {
            "day_key": "wednesday",
            "day_label": "СРЕДА",
            "lessons": [
                {"time": "08:30", "subject": "Обеспечение качества ПО (4 кр)-SFQ201-2", "room": "E-108"},
                {"time": "10:00", "subject": "Архитектура ПО (T)-SWA201", "room": "C-410"},
                {"time": "11:30", "subject": "Индивидуальный проект (DI)-INP202", "room": "D-309"},
            ],
        },
        {
            "day_key": "thursday",
            "day_label": "ЧЕТВЕРГ",
            "lessons": [
                {"time": "08:30", "subject": "", "room": ""},
                {"time": "10:00", "subject": "Разработка мобильных приложений (DI)-MAD201", "room": "C-410"},
                {"time": "11:30", "subject": "Разработка мобильных приложений (DI)-MAD201-2", "room": "E-310"},
            ],
        },
        {
            "day_key": "friday",
            "day_label": "ПЯТНИЦА",
            "lessons": [
                {"time": "08:30", "subject": "Безопасность жизнедеятельности-OEL202", "room": "D-307"},
                {"time": "10:00", "subject": "Безопасность жизнедеятельности-OEL202-2", "room": "B-210"},
            ],
        },
    ]
)

DEFAULT_WEEKLY_SCHEDULE_320 = WeeklySchedule(
    days=[
        {
            "day_key": "monday",
            "day_label": "ПОНЕДЕЛЬНИК",
            "lessons": [
                {"time": "08:30", "subject": "Обеспечение качества ПО (4 кр)-SFQ201", "room": "A-405"},
                {"time": "10:00", "subject": "Разработка мобильных приложений (DI)-MAD201", "room": "C-410"},
                {"time": "11:30", "subject": "", "room": ""},
            ],
        },
        {
            "day_key": "tuesday",
            "day_label": "ВТОРНИК",
            "lessons": [
                {"time": "08:30", "subject": "Индивидуальный проект (DI)-INP202", "room": "D-310"},
                {"time": "10:00", "subject": "Безопасность жизнедеятельности-OEL202", "room": "D-307"},
                {"time": "11:30", "subject": "", "room": ""},
            ],
        },
        {
            "day_key": "wednesday",
            "day_label": "СРЕДА",
            "lessons": [
                {"time": "08:30", "subject": "Архитектура ПО (T)-SWA201", "room": "E-312"},
                {"time": "10:00", "subject": "Индивидуальный проект (DI)-INP202", "room": "D-309"},
                {"time": "11:30", "subject": "", "room": ""},
            ],
        },
        {
            "day_key": "thursday",
            "day_label": "ЧЕТВЕРГ",
            "lessons": [
                {"time": "08:30", "subject": "Обеспечение качества ПО (4 кр)-SFQ201-2", "room": "E-108"},
                {"time": "10:00", "subject": "Разработка мобильных приложений (DI)-MAD201-2", "room": "E-310"},
                {"time": "11:30", "subject": "", "room": ""},
            ],
        },
        {
            "day_key": "friday",
            "day_label": "ПЯТНИЦА",
            "lessons": [
                {"time": "08:30", "subject": "Архитектура ПО (T)-SWA201-2", "room": "E-310"},
                {"time": "10:00", "subject": "Безопасность жизнедеятельности-OEL202-2", "room": "B-210"},
                {"time": "11:30", "subject": "", "room": ""},
            ],
        },
    ]
)


def _schedule_key_for_user(user: User) -> str:
    if user.role == "student" and "320-23 dir" in str(user.bio or "").lower():
        return SCHEDULE_SETTING_KEY_320
    return SCHEDULE_SETTING_KEY_321


def _setting_key_from_group(group: str | None) -> str:
    normalized = str(group or "").strip().lower().replace(" ", "")
    if normalized in {"320", "320-23dir", "320-23", "32023"}:
        return SCHEDULE_SETTING_KEY_320
    if normalized in {"321", "321-23dir", "321-23", "32123", ""}:
        return SCHEDULE_SETTING_KEY_321
    raise HTTPException(status_code=400, detail="Неизвестная группа расписания.")


def _get_default_schedule_by_key(setting_key: str) -> WeeklySchedule:
    return DEFAULT_WEEKLY_SCHEDULE_320 if setting_key == SCHEDULE_SETTING_KEY_320 else DEFAULT_WEEKLY_SCHEDULE_321


def _get_or_create_schedule(db: Session, setting_key: str) -> WeeklySchedule:
    row = db.get(PlatformSetting, setting_key)
    if row:
        try:
            return WeeklySchedule.model_validate(json.loads(row.value))
        except (json.JSONDecodeError, ValueError):
            pass

    default_schedule = _get_default_schedule_by_key(setting_key)
    payload = default_schedule.model_dump()
    if row:
        row.value = json.dumps(payload, ensure_ascii=False)
        row.updated_at = datetime.utcnow()
    else:
        db.add(
            PlatformSetting(
                key=setting_key,
                value=json.dumps(payload, ensure_ascii=False),
                updated_at=datetime.utcnow(),
            )
        )
    db.commit()
    return default_schedule


@router.get("", response_model=WeeklySchedule)
def get_schedule(
    group: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklySchedule:
    if current_user.role not in {"student", "teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к расписанию.")
    if current_user.role == "admin":
        return _get_or_create_schedule(db, _setting_key_from_group(group))
    return _get_or_create_schedule(db, _schedule_key_for_user(current_user))


@router.put("", response_model=WeeklySchedule)
def update_schedule(
    payload: WeeklySchedule,
    group: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklySchedule:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Редактировать расписание может только админ.")

    setting_key = _setting_key_from_group(group)
    row = db.get(PlatformSetting, setting_key)
    serialized = json.dumps(payload.model_dump(), ensure_ascii=False)
    if row:
        row.value = serialized
        row.updated_at = datetime.utcnow()
    else:
        db.add(PlatformSetting(key=setting_key, value=serialized, updated_at=datetime.utcnow()))
    db.commit()
    return payload
