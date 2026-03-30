from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Chat(BaseModel):
    id: int
    title: str
    chat_type: Literal["direct", "group", "admin"]
    participant_ids: list[int]
    course_id: int | None

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: Literal["text", "image", "file"]
    attachment_name: str | None = None
    attachment_url: str | None = None
    attachment_mime_type: str | None = None
    status: Literal["sent", "delivered", "read"]
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatWithMessages(Chat):
    messages: list[ChatMessage]


class MessageCreate(BaseModel):
    sender_id: int
    sender_name: str
    content: str
    message_type: Literal["text", "image", "file"] = "text"
    created_at: datetime
