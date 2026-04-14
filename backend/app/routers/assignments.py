from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.authorization import (
    assignment_visible_to_user,
    require_assignment_review_access,
    require_assignment_submit_access,
    submissions_query_for_user,
)
from app.core.config import settings
from app.database import get_db
from app.models import Assignment as AssignmentModel
from app.models import Course as CourseModel
from app.models import Grade as GradeModel
from app.models import Submission as SubmissionModel
from app.models import User
from app.dependencies import get_current_user
from app.schemas.assignments import (
    Assignment,
    AssignmentCreateResponse,
    Submission,
    SubmissionRequest,
    SubmissionResponse,
)
from app.storage import save_upload

router = APIRouter(prefix="/assignments", tags=["assignments"])
MAX_SUBMISSION_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT = 50
ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS = {
    ".txt",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
}


def resolve_media_file_path(file_url: str) -> Path:
    media_url_prefix = settings.media_url.rstrip("/")
    expected_prefix = f"{media_url_prefix}/"
    if not file_url.startswith(expected_prefix):
        raise HTTPException(status_code=500, detail="Некорректный путь к файлу.")

    relative_path = file_url[len(expected_prefix):]
    media_root = Path(settings.media_root).resolve()
    target_path = (media_root / relative_path).resolve()

    if media_root not in target_path.parents and target_path != media_root:
        raise HTTPException(status_code=400, detail="Некорректный путь к файлу.")
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден на диске.")
    return target_path


@router.get("", response_model=list[Assignment])
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Assignment]:
    assignments = db.scalars(
        select(AssignmentModel)
        .options(
            selectinload(AssignmentModel.submissions).selectinload(SubmissionModel.grade_record),
            selectinload(AssignmentModel.created_by_teacher),
            selectinload(AssignmentModel.course),
        )
        .order_by(AssignmentModel.id)
    ).all()
    visible = [item for item in assignments if assignment_visible_to_user(item, current_user, db)]
    result = []
    for item in visible:
        submissions = item.submissions
        current_user_submissions = [submission for submission in submissions if submission.student_id == current_user.id]
        latest_submission = current_user_submissions[-1] if current_user_submissions else None
        latest_grade = (
            db.scalar(select(GradeModel).where(GradeModel.submission_id == latest_submission.id))
            if latest_submission
            else None
        )
        result.append(
            Assignment(
                id=item.id,
                course_id=item.course_id,
                course_title=item.course.title if item.course else None,
                title=item.title,
                description=item.description,
                deadline=item.deadline,
                max_score=item.max_score,
                type=item.type,
                status=item.status,
                grade=item.grade,
                teacher_comment=item.teacher_comment,
                material_file_name=item.material_file_name,
                material_file_url=item.material_file_url,
                material_file_mime_type=item.material_file_mime_type,
                teacher_name=(
                    item.created_by_teacher.full_name
                    if item.created_by_teacher
                    else "Не указан"
                ),
                can_delete=(
                    current_user.role == "admin"
                    or (
                        current_user.role == "teacher"
                        and item.created_by_teacher_id == current_user.id
                    )
                ),
                submissions_count=len(submissions),
                has_ungraded_submissions=any(submission.grade_record is None for submission in submissions),
                current_user_grade=latest_grade.score if latest_grade else None,
                current_user_feedback=latest_grade.feedback if latest_grade else None,
            )
        )
    return result


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    assignment = db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено.")

    if current_user.role not in {"teacher", "admin"}:
        raise HTTPException(status_code=403, detail="Удалять задания может преподаватель или админ.")
    if current_user.role == "teacher" and assignment.created_by_teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Можно удалять только свои задания.")

    submission_ids = db.scalars(
        select(SubmissionModel.id).where(SubmissionModel.assignment_id == assignment_id)
    ).all()
    if submission_ids:
        db.execute(delete(GradeModel).where(GradeModel.submission_id.in_(submission_ids)))

    db.delete(assignment)
    db.commit()


@router.get("/{assignment_id}/material")
def download_assignment_material(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    assignment = db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено.")
    if not assignment_visible_to_user(assignment, current_user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к этому заданию.")
    if not assignment.material_file_url:
        raise HTTPException(status_code=404, detail="Файл задания не найден.")
    target_path = resolve_media_file_path(assignment.material_file_url)

    return FileResponse(
        path=target_path,
        filename=assignment.material_file_name or target_path.name,
        media_type=assignment.material_file_mime_type or "text/plain",
    )


@router.post("/courses/{course_id}/upload", response_model=AssignmentCreateResponse, status_code=status.HTTP_201_CREATED)
def create_assignment_with_material(
    course_id: int,
    title: str = Form(...),
    deadline: datetime = Form(...),
    max_score: int = Form(100),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentCreateResponse:
    course = db.scalar(select(CourseModel).where(CourseModel.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    if current_user.role not in {"teacher", "admin"}:
        raise HTTPException(status_code=403, detail="Создавать задания может только преподаватель.")
    if max_score < 1 or max_score > MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT:
        raise HTTPException(
            status_code=400,
            detail=f"Максимальный балл за одно задание должен быть в диапазоне 1..{MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT}.",
        )

    current_total_score = db.scalar(
        select(func.coalesce(func.sum(AssignmentModel.max_score), 0)).where(
            AssignmentModel.course_id == course_id,
            AssignmentModel.created_by_teacher_id == current_user.id,
        )
    ) or 0
    next_total_score = int(current_total_score) + int(max_score)
    if next_total_score > MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT:
        remaining = max(MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT - int(current_total_score), 0)
        raise HTTPException(
            status_code=400,
            detail=(
                "Сумма максимальных баллов по предмету не может превышать "
                f"{MAX_TOTAL_ASSIGNMENT_SCORE_PER_SUBJECT}. Доступно: {remaining}."
            ),
        )

    original_name = (file.filename or "").strip()
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_ASSIGNMENT_MATERIAL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Недопустимый формат файла. Разрешены: "
                "TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX, "
                "PNG, JPG, JPEG, GIF, WEBP, BMP, TIF, TIFF, "
                "ZIP, RAR, 7Z, TAR, GZ."
            ),
        )

    file_name, mime_type, file_url = save_upload(file, f"assignment-materials/{course_id}")
    assignment = AssignmentModel(
        course_id=course_id,
        created_by_teacher_id=current_user.id,
        title=title.strip(),
        description=description.strip() if description else "",
        deadline=deadline,
        max_score=max_score,
        type="file",
        status="pending",
        grade=None,
        teacher_comment=None,
        material_file_name=file_name,
        material_file_url=file_url,
        material_file_mime_type=mime_type,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return AssignmentCreateResponse(
        assignment_id=assignment.id,
        course_id=assignment.course_id,
        title=assignment.title,
        deadline=assignment.deadline,
        max_score=assignment.max_score,
        material_file_name=file_name,
        material_file_url=file_url,
        material_file_mime_type=mime_type,
        message="Задание создано и файл успешно загружен.",
    )


@router.post("/{assignment_id}/submit", response_model=SubmissionResponse)
def submit_assignment(
    assignment_id: int,
    payload: SubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    assignment = require_assignment_submit_access(
        db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id)),
        current_user,
        db,
    )

    submission = SubmissionModel(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submitted_text=payload.submitted_text,
        submitted_file_name=payload.submitted_file_name,
        submitted_file_url=None,
        submitted_file_mime_type=None,
        status="review",
        created_at=datetime.utcnow(),
    )
    db.add(submission)
    assignment.status = "review"
    db.commit()
    db.refresh(submission)
    return SubmissionResponse(
        submission_id=submission.id,
        assignment_id=assignment_id,
        submitted_text=payload.submitted_text,
        submitted_file_name=payload.submitted_file_name,
        submitted_file_url=None,
        submitted_file_mime_type=None,
        status="review",
        message="Решение отправлено преподавателю на проверку.",
    )


@router.post("/{assignment_id}/upload", response_model=SubmissionResponse)
def upload_assignment_file(
    assignment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    assignment = require_assignment_submit_access(
        db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id)),
        current_user,
        db,
    )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size <= 0:
        raise HTTPException(status_code=400, detail="Файл решения пустой.")
    if file_size > MAX_SUBMISSION_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Размер файла превышает 50 МБ.",
        )

    file_name, mime_type, file_url = save_upload(file, f"assignments/{assignment_id}")
    submission = SubmissionModel(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submitted_text=None,
        submitted_file_name=file_name,
        submitted_file_url=file_url,
        submitted_file_mime_type=mime_type,
        status="review",
        created_at=datetime.utcnow(),
    )
    db.add(submission)
    assignment.status = "review"
    db.commit()
    db.refresh(submission)
    return SubmissionResponse(
        submission_id=submission.id,
        assignment_id=assignment_id,
        submitted_text=None,
        submitted_file_name=file_name,
        submitted_file_url=file_url,
        submitted_file_mime_type=mime_type,
        status="review",
        message="Файл решения загружен и отправлен преподавателю.",
    )


@router.get("/{assignment_id}/submissions/{submission_id}/download")
def download_submission_file(
    assignment_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    assignment = require_assignment_review_access(
        db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id)),
        current_user,
        db,
    )
    submission = db.scalar(
        select(SubmissionModel).where(
            SubmissionModel.id == submission_id,
            SubmissionModel.assignment_id == assignment.id,
        )
    )
    if not submission or not submission.submitted_file_url:
        raise HTTPException(status_code=404, detail="Файл решения не найден.")

    target_path = resolve_media_file_path(submission.submitted_file_url)
    return FileResponse(
        path=target_path,
        filename=submission.submitted_file_name or target_path.name,
        media_type=submission.submitted_file_mime_type or "application/octet-stream",
    )


@router.get("/{assignment_id}/submissions", response_model=list[Submission])
def list_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Submission]:
    assignment = db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id))
    if current_user.role in {"teacher", "admin"}:
        require_assignment_review_access(assignment, current_user, db)
    else:
        require_assignment_submit_access(assignment, current_user, db)

    return [
        Submission(
            id=item.id,
            assignment_id=item.assignment_id,
            student_id=item.student_id,
            student_name=(item.student.full_name if item.student else None),
            submitted_text=item.submitted_text,
            submitted_file_name=item.submitted_file_name,
            submitted_file_url=item.submitted_file_url,
            submitted_file_mime_type=item.submitted_file_mime_type,
            status=item.status,
            grade_score=(grade.score if grade else None),
            grade_max_score=(grade.max_score if grade else None),
            grade_feedback=(grade.feedback if grade else None),
            graded_at=(grade.graded_at if grade else None),
            created_at=item.created_at,
        )
        for item in submissions_query_for_user(db, assignment_id, current_user)
        for grade in [db.scalar(select(GradeModel).where(GradeModel.submission_id == item.id))]
    ]
