from datetime import UTC, datetime, timedelta
from hashlib import sha256

from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    # Demo-level хеширование; в production заменить на passlib/bcrypt.
    return sha256(password.encode("utf-8")).hexdigest()


def create_access_token(subject: str, user_id: int, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload = {
        "sub": subject,
        "user_id": user_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as error:
        raise ValueError("Невалидный или просроченный токен.") from error
