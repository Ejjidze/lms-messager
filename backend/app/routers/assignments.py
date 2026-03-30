from datetime import datetime

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.authorization import (
    assignment_visible_to_user,
    require_assignment_review_access,
    require_assignment_submit_access,
    submissions_query_for_user,
)
from app.database import get_db
from app.models import Assignment as AssignmentModel
from app.models import Grade as GradeModel
from app.models import Submission as SubmissionModel
from app.models import User
from app.dependencies import get_current_user
from app.schemas.assignments import Assignment, Submission, SubmissionRequest, SubmissionResponse
from app.storage import save_upload

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[Assignment])
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Assignment]:
    assignments = db.scalars(
        select(AssignmentModel).options(selectinload(AssignmentModel.submissions)).order_by(AssignmentModel.id)
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
                title=item.title,
                description=item.description,
                deadline=item.deadline,
                type=item.type,
                status=item.status,
                grade=item.grade,
                teacher_comment=item.teacher_comment,
                submissions_count=len(submissions),
                current_user_grade=latest_grade.score if latest_grade else None,
                current_user_feedback=latest_grade.feedback if latest_grade else None,
            )
        )
    return result


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
