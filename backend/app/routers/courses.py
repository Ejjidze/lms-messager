from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Course as CourseModel
from app.models import Module as ModuleModel
from app.schemas.courses import Course, CourseDetails, Module

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[Course])
def list_courses(
    category: str | None = Query(default=None),
    level: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Course]:
    query = select(CourseModel).options(selectinload(CourseModel.teacher)).order_by(CourseModel.id)
    if category:
        query = query.where(CourseModel.category.ilike(category))
    if level:
        query = query.where(CourseModel.level.ilike(level))
    if search:
        search_term = f"%{search}%"
        query = query.where(CourseModel.title.ilike(search_term) | CourseModel.description.ilike(search_term))

    result = db.scalars(query).all()
    return [
        Course(
            id=course.id,
            title=course.title,
            description=course.description,
            category=course.category,
            level=course.level,
            teacher_id=course.teacher_id,
            teacher_name=course.teacher.full_name,
            students_count=course.students_count,
            progress_percent=course.progress_percent,
            cover_url=course.cover_url,
        )
        for course in result
    ]


@router.get("/{course_id}", response_model=CourseDetails)
def get_course(course_id: int, db: Session = Depends(get_db)) -> CourseDetails:
    course = db.scalar(
        select(CourseModel)
        .options(
            selectinload(CourseModel.teacher),
            selectinload(CourseModel.modules).selectinload(ModuleModel.lessons),
        )
        .where(CourseModel.id == course_id)
    )
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    course_modules = [
        Module(
            id=module.id,
            course_id=module.course_id,
            title=module.title,
            lessons=[
                {
                    "id": lesson.id,
                    "title": lesson.title,
                    "description": lesson.description,
                    "content_type": lesson.content_type,
                    "duration_minutes": lesson.duration_minutes,
                }
                for lesson in module.lessons
            ],
        )
        for module in course.modules
    ]
    return CourseDetails(
        id=course.id,
        title=course.title,
        description=course.description,
        category=course.category,
        level=course.level,
        teacher_id=course.teacher_id,
        teacher_name=course.teacher.full_name,
        students_count=course.students_count,
        progress_percent=course.progress_percent,
        cover_url=course.cover_url,
        modules=course_modules,
    )
