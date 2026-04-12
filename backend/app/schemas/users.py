from typing import Literal

from pydantic import BaseModel


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: str
    role: Literal["student", "teacher", "admin"]
    bio: str
    avatar: str
    online: bool

    model_config = {"from_attributes": True}
