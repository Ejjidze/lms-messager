from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.database import get_db
from app.models import SecurityEvent, User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.users import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user and user.password_hash == hash_password(payload.password):
        if user.is_blocked and (user.blocked_until is None or user.blocked_until >= datetime.utcnow()):
            db.add(
                SecurityEvent(
                    user_id=user.id,
                    event_type="login_blocked",
                    severity="warning",
                    details=f"email={payload.email}",
                    created_at=datetime.utcnow(),
                )
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт временно заблокирован.")
        user.last_login_at = datetime.utcnow()
        user.online = True
        db.add(
            SecurityEvent(
                user_id=user.id,
                event_type="login_success",
                severity="info",
                details=f"email={payload.email}",
                created_at=datetime.utcnow(),
            )
        )
        db.commit()
        public_user = UserPublic.model_validate(user)
        return TokenResponse(
            access_token=create_access_token(subject=user.email, user_id=user.id),
            token_type="bearer",
            user=public_user,
        )

    db.add(
        SecurityEvent(
            user_id=user.id if user else None,
            event_type="login_failed",
            severity="warning",
            details=f"email={payload.email}",
            created_at=datetime.utcnow(),
        )
    )
    db.commit()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверный email или пароль.",
    )
