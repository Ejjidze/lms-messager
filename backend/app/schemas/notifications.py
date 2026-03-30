from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Notification(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    kind: Literal["assignment", "chat", "system"]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
