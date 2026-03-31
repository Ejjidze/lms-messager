from datetime import datetime

from pydantic import BaseModel


class LessonCompletionResponse(BaseModel):
    lesson_id: int
    course_id: int
    event_type: str
    progress_percent: int
    created_at: datetime


class QuizOptionResponse(BaseModel):
    id: int
    text: str
    is_correct: bool | None = None

    model_config = {"from_attributes": True}


class QuizQuestionResponse(BaseModel):
    id: int
    text: str
    question_type: str
    options: list[QuizOptionResponse]

    model_config = {"from_attributes": True}


class QuizResponse(BaseModel):
    id: int
    course_id: int
    lesson_id: int | None
    title: str
    description: str
    passing_score: int
    questions: list[QuizQuestionResponse]

    model_config = {"from_attributes": True}


class QuizAnswerSubmission(BaseModel):
    question_id: int
    option_ids: list[int]


class QuizSubmitRequest(BaseModel):
    answers: list[QuizAnswerSubmission]


class QuizAttemptResponse(BaseModel):
    quiz_id: int
    score: int
    max_score: int
    passed: bool
    progress_percent: int
    created_at: datetime


class QuizOptionCreate(BaseModel):
    text: str
    is_correct: bool = False


class QuizQuestionCreate(BaseModel):
    text: str
    question_type: str = "single"
    options: list[QuizOptionCreate]


class QuizQuestionUpdate(BaseModel):
    text: str
    question_type: str = "single"
    options: list[QuizOptionCreate]


class QuizCreate(BaseModel):
    title: str
    description: str = ""
    lesson_id: int | None = None
    passing_score: int = 60
    questions: list[QuizQuestionCreate] = []


class QuizUpdate(BaseModel):
    title: str
    description: str = ""
    lesson_id: int | None = None
    passing_score: int = 60
