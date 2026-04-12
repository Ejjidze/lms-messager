from pydantic import BaseModel

from app.schemas.users import UserPublic


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserPublic


class TokenPayload(BaseModel):
    sub: str
    user_id: int
    exp: int
