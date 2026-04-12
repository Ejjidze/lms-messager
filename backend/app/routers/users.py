from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.users import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserPublic]:
    return [UserPublic.model_validate(user) for user in db.scalars(select(User).order_by(User.id)).all()]


@router.get("/directory", response_model=list[UserPublic])
def list_directory_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    query = select(User).order_by(User.full_name)

    if current_user.role == "student":
        query = query.where(User.role == "teacher")
    elif current_user.role == "teacher":
        query = query.where(User.role == "student")
    else:
        query = query.where(User.role.in_(("student", "teacher")))

    return [UserPublic.model_validate(user) for user in db.scalars(query).all()]
