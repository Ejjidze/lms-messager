from typing import Literal

from pydantic import BaseModel, EmailStr


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: Literal["student", "teacher", "admin"]
    bio: str
    avatar: str
    online: bool

    model_config = {"from_attributes": True}
