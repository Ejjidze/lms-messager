from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


def get_current_user(db: Session = Depends(get_db)) -> User:
    # Demo-зависимость: до подключения JWT берём первого пользователя из базы.
    user = db.scalar(select(User).order_by(User.id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден.")
    return user
