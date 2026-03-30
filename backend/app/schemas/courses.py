from pydantic import BaseModel


class Lesson(BaseModel):
    id: int
    title: str
    description: str
    content_type: list[str]
    duration_minutes: int

    model_config = {"from_attributes": True}


class Module(BaseModel):
    id: int
    course_id: int
    title: str
    lessons: list[Lesson]

    model_config = {"from_attributes": True}


class Course(BaseModel):
    id: int
    title: str
    description: str
    category: str
    level: str
    teacher_id: int
    teacher_name: str
    students_count: int
    progress_percent: int
    cover_url: str

    model_config = {"from_attributes": True}


class CourseDetails(Course):
    modules: list[Module]
