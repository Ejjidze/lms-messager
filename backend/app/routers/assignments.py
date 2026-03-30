from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment as AssignmentModel
from app.schemas.assignments import Assignment, SubmissionRequest, SubmissionResponse

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[Assignment])
def list_assignments(db: Session = Depends(get_db)) -> list[Assignment]:
    return [Assignment.model_validate(item) for item in db.scalars(select(AssignmentModel).order_by(AssignmentModel.id)).all()]


@router.post("/{assignment_id}/submit", response_model=SubmissionResponse)
def submit_assignment(
    assignment_id: int,
    payload: SubmissionRequest,
    db: Session = Depends(get_db),
) -> SubmissionResponse:
    assignment = db.scalar(select(AssignmentModel).where(AssignmentModel.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="Задание не найдено.")

    assignment.status = "review"
    db.commit()
    return SubmissionResponse(
        assignment_id=assignment_id,
        submitted_text=payload.submitted_text,
        submitted_file_name=payload.submitted_file_name,
        status="review",
        message="Решение отправлено преподавателю на проверку.",
    )
