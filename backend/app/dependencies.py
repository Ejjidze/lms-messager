from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import UTC, datetime

from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Некорректный токен.")

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден.")
    if user.is_blocked and (user.blocked_until is None or user.blocked_until >= datetime.utcnow()):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь временно заблокирован.")

    issued_at = payload.get("iat")
    if user.session_revoked_at is not None and issued_at is not None:
        issued_dt = datetime.fromtimestamp(int(issued_at), tz=UTC).replace(tzinfo=None)
        if issued_dt <= user.session_revoked_at:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия отозвана. Выполните вход снова.")
    return user
