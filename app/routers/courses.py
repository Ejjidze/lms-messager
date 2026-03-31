from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.authorization import can_access_course
from app.database import get_db
from app.models import Course as CourseModel
from app.models import Enrollment, Grade, ProgressHistory, Submission, User
from app.models import Module as ModuleModel
from app.schemas.courses import Course, CourseDetails, Module
from app.dependencies import get_current_user

router = APIRouter(prefix="/courses", tags=["courses"])


def calculate_average_grade(course: CourseModel, db: Session) -> float | None:
    grades = db.scalars(
        select(Grade)
        .join(Submission, Submission.id == Grade.submission_id)
        .where(Submission.assignment_id.in_([assignment.id for assignment in course.assignments]))
    ).all()
    if not grades:
        return None
    return round(sum(item.score for item in grades) / len(grades), 2)


def get_student_progress(course_id: int, student_id: int, db: Session) -> int | None:
    progress_items = db.scalars(
        select(ProgressHistory)
        .where(ProgressHistory.course_id == course_id, ProgressHistory.student_id == student_id)
        .order_by(ProgressHistory.created_at.desc())
    ).all()
    return progress_items[0].progress_percent if progress_items else None


@router.get("", response_model=list[Course])
def list_courses(
    category: str | None = Query(default=None),
    level: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Course]:
    query = (
        select(CourseModel)
        .options(selectinload(CourseModel.teacher), selectinload(CourseModel.assignments))
        .order_by(CourseModel.id)
    )
    if category:
        query = query.where(CourseModel.category.ilike(category))
    if level:
        query = query.where(CourseModel.level.ilike(level))
    if search:
        search_term = f"%{search}%"
        query = query.where(CourseModel.title.ilike(search_term) | CourseModel.description.ilike(search_term))

    result = [course for course in db.scalars(query).all() if can_access_course(course.id, current_user, db)]
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
            current_user_progress=get_student_progress(course.id, current_user.id, db)
            if current_user.role == "student"
            else course.progress_percent,
            average_grade=calculate_average_grade(course, db),
        )
        for course in result
    ]


@router.get("/{course_id}", response_model=CourseDetails)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseDetails:
    course = db.scalar(
        select(CourseModel)
        .options(
            selectinload(CourseModel.teacher),
            selectinload(CourseModel.assignments),
            selectinload(CourseModel.modules).selectinload(ModuleModel.lessons),
        )
        .where(CourseModel.id == course_id)
    )
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")
    if not can_access_course(course.id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к этому курсу.")

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
        current_user_progress=get_student_progress(course.id, current_user.id, db)
        if current_user.role == "student"
        else course.progress_percent,
        average_grade=calculate_average_grade(course, db),
        enrolled_students_count=len(
            db.scalars(select(Enrollment).where(Enrollment.course_id == course.id)).all()
        ),
        modules=course_modules,
    )
