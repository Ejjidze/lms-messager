from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.authorization import has_active_enrollment, is_course_teacher
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Course, Lesson, ProgressHistory, Quiz, QuizAttempt, QuizOption, QuizQuestion, User
from app.schemas.learning import (
    LessonCompletionResponse,
    QuizCreate,
    QuizAttemptResponse,
    QuizQuestionCreate,
    QuizQuestionUpdate,
    QuizResponse,
    QuizSubmitRequest,
    QuizUpdate,
)
from app.services.progress import calculate_course_progress, record_progress_event

router = APIRouter(tags=["learning"])


def ensure_quiz_manage_access(course_id: int, current_user: User, db: Session) -> None:
    if current_user.role == "admin":
        return
    if current_user.role != "teacher" or not is_course_teacher(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Управлять тестами может только преподаватель курса или администратор.")


def validate_lesson_for_course(lesson_id: int | None, course_id: int, db: Session) -> None:
    if lesson_id is None:
        return
    lesson = db.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден.")
    if lesson.module.course_id != course_id:
        raise HTTPException(status_code=400, detail="Урок не относится к этому курсу.")


def create_question_with_options(db: Session, quiz_id: int, payload: QuizQuestionCreate | QuizQuestionUpdate) -> QuizQuestion:
    if not payload.options:
        raise HTTPException(status_code=400, detail="У вопроса должен быть хотя бы один вариант ответа.")
    question = QuizQuestion(
        quiz_id=quiz_id,
        text=payload.text,
        question_type=payload.question_type,
    )
    db.add(question)
    db.flush()
    db.add_all(
        [
            QuizOption(question_id=question.id, text=option.text, is_correct=option.is_correct)
            for option in payload.options
        ]
    )
    db.flush()
    return question


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompletionResponse, status_code=status.HTTP_201_CREATED)
def complete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonCompletionResponse:
    lesson = db.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден.")

    course_id = lesson.module.course_id
    if current_user.role != "student" or not has_active_enrollment(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Проходить урок может только записанный студент.")

    existing = db.scalar(
        select(ProgressHistory).where(
            ProgressHistory.student_id == current_user.id,
            ProgressHistory.course_id == course_id,
            ProgressHistory.lesson_id == lesson_id,
            ProgressHistory.event_type == "lesson_completed",
        )
    )
    if existing:
        return LessonCompletionResponse(
            lesson_id=lesson_id,
            course_id=course_id,
            event_type=existing.event_type,
            progress_percent=existing.progress_percent,
            created_at=existing.created_at,
        )

    event = record_progress_event(
        db,
        student_id=current_user.id,
        course_id=course_id,
        lesson_id=lesson_id,
        event_type="lesson_completed",
    )
    return LessonCompletionResponse(
        lesson_id=lesson_id,
        course_id=course_id,
        event_type=event.event_type,
        progress_percent=event.progress_percent,
        created_at=event.created_at,
    )


@router.get("/quizzes/courses/{course_id}", response_model=list[QuizResponse])
def list_course_quizzes(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuizResponse]:
    if current_user.role == "student" and not has_active_enrollment(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к тестам этого курса.")

    quizzes = db.scalars(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.course_id == course_id)
        .order_by(Quiz.id)
    ).all()
    return [QuizResponse.model_validate(item) for item in quizzes]


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Тест не найден.")
    if current_user.role == "student" and not has_active_enrollment(quiz.course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к этому тесту.")
    return QuizResponse.model_validate(quiz)


@router.post("/quizzes/courses/{course_id}", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz(
    course_id: int,
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    if not db.scalar(select(Course).where(Course.id == course_id)):
        raise HTTPException(status_code=404, detail="Курс не найден.")
    ensure_quiz_manage_access(course_id, current_user, db)
    validate_lesson_for_course(payload.lesson_id, course_id, db)

    quiz = Quiz(
        course_id=course_id,
        lesson_id=payload.lesson_id,
        title=payload.title,
        description=payload.description,
        passing_score=payload.passing_score,
    )
    db.add(quiz)
    db.flush()

    for question in payload.questions:
        create_question_with_options(db, quiz.id, question)

    db.commit()
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz.id)
    )
    return QuizResponse.model_validate(quiz)


@router.patch("/quizzes/{quiz_id}", response_model=QuizResponse)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Тест не найден.")
    ensure_quiz_manage_access(quiz.course_id, current_user, db)
    validate_lesson_for_course(payload.lesson_id, quiz.course_id, db)

    quiz.title = payload.title
    quiz.description = payload.description
    quiz.lesson_id = payload.lesson_id
    quiz.passing_score = payload.passing_score
    db.commit()
    db.refresh(quiz)
    return QuizResponse.model_validate(quiz)


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    quiz = db.scalar(select(Quiz).where(Quiz.id == quiz_id))
    if not quiz:
        raise HTTPException(status_code=404, detail="Тест не найден.")
    ensure_quiz_manage_access(quiz.course_id, current_user, db)
    db.delete(quiz)
    db.commit()


@router.post("/quizzes/{quiz_id}/questions", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz_question(
    quiz_id: int,
    payload: QuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Тест не найден.")
    ensure_quiz_manage_access(quiz.course_id, current_user, db)
    create_question_with_options(db, quiz.id, payload)
    db.commit()
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz.id)
    )
    return QuizResponse.model_validate(quiz)


@router.patch("/questions/{question_id}", response_model=QuizResponse)
def update_quiz_question(
    question_id: int,
    payload: QuizQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    question = db.scalar(
        select(QuizQuestion)
        .options(selectinload(QuizQuestion.options), selectinload(QuizQuestion.quiz))
        .where(QuizQuestion.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Вопрос не найден.")
    ensure_quiz_manage_access(question.quiz.course_id, current_user, db)
    if not payload.options:
        raise HTTPException(status_code=400, detail="У вопроса должен быть хотя бы один вариант ответа.")

    question.text = payload.text
    question.question_type = payload.question_type
    for option in list(question.options):
        db.delete(option)
    db.flush()
    db.add_all(
        [
            QuizOption(question_id=question.id, text=option.text, is_correct=option.is_correct)
            for option in payload.options
        ]
    )
    db.commit()
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == question.quiz_id)
    )
    return QuizResponse.model_validate(quiz)


@router.delete("/questions/{question_id}", response_model=QuizResponse)
def delete_quiz_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResponse:
    question = db.scalar(
        select(QuizQuestion)
        .options(selectinload(QuizQuestion.quiz))
        .where(QuizQuestion.id == question_id)
    )
    if not question:
        raise HTTPException(status_code=404, detail="Вопрос не найден.")
    quiz_id = question.quiz_id
    course_id = question.quiz.course_id
    ensure_quiz_manage_access(course_id, current_user, db)
    db.delete(question)
    db.commit()
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    return QuizResponse.model_validate(quiz)


@router.post("/quizzes/{quiz_id}/submit", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
def submit_quiz(
    quiz_id: int,
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizAttemptResponse:
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .where(Quiz.id == quiz_id)
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Тест не найден.")
    if current_user.role != "student" or not has_active_enrollment(quiz.course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Сдавать тест может только записанный студент.")

    answers_by_question = {item.question_id: set(item.option_ids) for item in payload.answers}
    score = 0
    max_score = len(quiz.questions) * 100

    for question in quiz.questions:
        correct_option_ids = {option.id for option in question.options if option.is_correct}
        submitted_option_ids = answers_by_question.get(question.id, set())
        if submitted_option_ids == correct_option_ids:
            score += 100

    passed = ((score / max_score) * 100) >= quiz.passing_score if max_score else False
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=current_user.id,
        score=score,
        max_score=max_score,
        passed=passed,
        submitted_answers=[item.model_dump() for item in payload.answers],
        created_at=datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    event = record_progress_event(
        db,
        student_id=current_user.id,
        course_id=quiz.course_id,
        lesson_id=quiz.lesson_id,
        event_type="quiz_passed" if passed else "quiz_attempted",
    )
    progress_percent = calculate_course_progress(db, quiz.course_id, current_user.id)
    return QuizAttemptResponse(
        quiz_id=quiz.id,
        score=attempt.score,
        max_score=attempt.max_score,
        passed=attempt.passed,
        progress_percent=progress_percent if passed else event.progress_percent,
        created_at=attempt.created_at,
    )
