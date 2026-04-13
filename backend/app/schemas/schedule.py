from pydantic import BaseModel, Field


class ScheduleLesson(BaseModel):
    time: str = Field(min_length=1, max_length=20)
    subject: str = Field(default="", max_length=255)
    room: str = Field(default="", max_length=50)


class ScheduleDay(BaseModel):
    day_key: str = Field(min_length=2, max_length=20)
    day_label: str = Field(min_length=2, max_length=50)
    lessons: list[ScheduleLesson] = Field(default_factory=list)


class WeeklySchedule(BaseModel):
    days: list[ScheduleDay]
