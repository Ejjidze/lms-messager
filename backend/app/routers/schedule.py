import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import PlatformSetting, User
from app.schemas.schedule import WeeklySchedule

router = APIRouter(prefix="/schedule", tags=["schedule"])
SCHEDULE_SETTING_KEY = "weekly_schedule_v1"

DEFAULT_WEEKLY_SCHEDULE = WeeklySchedule(
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


def _get_or_create_schedule(db: Session) -> WeeklySchedule:
    row = db.get(PlatformSetting, SCHEDULE_SETTING_KEY)
    if row:
        try:
            return WeeklySchedule.model_validate(json.loads(row.value))
        except (json.JSONDecodeError, ValueError):
            pass

    payload = DEFAULT_WEEKLY_SCHEDULE.model_dump()
    if row:
        row.value = json.dumps(payload, ensure_ascii=False)
        row.updated_at = datetime.utcnow()
    else:
        db.add(
            PlatformSetting(
                key=SCHEDULE_SETTING_KEY,
                value=json.dumps(payload, ensure_ascii=False),
                updated_at=datetime.utcnow(),
            )
        )
    db.commit()
    return DEFAULT_WEEKLY_SCHEDULE


@router.get("", response_model=WeeklySchedule)
def get_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklySchedule:
    if current_user.role not in {"student", "teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к расписанию.")
    return _get_or_create_schedule(db)


@router.put("", response_model=WeeklySchedule)
def update_schedule(
    payload: WeeklySchedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeeklySchedule:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Редактировать расписание может только админ.")

    row = db.get(PlatformSetting, SCHEDULE_SETTING_KEY)
    serialized = json.dumps(payload.model_dump(), ensure_ascii=False)
    if row:
        row.value = serialized
        row.updated_at = datetime.utcnow()
    else:
        db.add(PlatformSetting(key=SCHEDULE_SETTING_KEY, value=serialized, updated_at=datetime.utcnow()))
    db.commit()
    return payload
