from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.authorization import filter_chats_for_user, require_chat_participant
from app.dependencies import get_current_user
from app.database import get_db
from app.models import Chat as ChatModel
from app.models import Message as MessageModel
from app.models import User
from app.schemas.chats import Chat, ChatMessage, ChatWithMessages, MessageCreate
from app.storage import save_upload

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[Chat])
def list_chats(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Chat]:
    query = select(ChatModel).order_by(ChatModel.id)
    if search:
        search_term = f"%{search}%"
        query = query.where(or_(ChatModel.title.ilike(search_term), ChatModel.chat_type.ilike(search_term)))
    result = db.scalars(query).all()
    result = filter_chats_for_user(result, current_user, db)
    return [Chat.model_validate(chat) for chat in result]


@router.get("/{chat_id}", response_model=ChatWithMessages)
def get_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatWithMessages:
    chat = db.scalar(
        select(ChatModel)
        .options(selectinload(ChatModel.messages))
        .where(ChatModel.id == chat_id)
    )
    chat = require_chat_participant(chat, current_user, db)

    chat_messages = [ChatMessage.model_validate(message) for message in sorted(chat.messages, key=lambda item: item.id)]
    return ChatWithMessages(
        id=chat.id,
        title=chat.title,
        chat_type=chat.chat_type,
        participant_ids=chat.participant_ids,
        course_id=chat.course_id,
        messages=chat_messages,
    )


@router.post("/{chat_id}/messages", response_model=ChatMessage)
def create_message(
    chat_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessage:
    chat = require_chat_participant(
        db.scalar(select(ChatModel).where(ChatModel.id == chat_id)),
        current_user,
        db,
    )

    new_message = MessageModel(
        chat_id=chat_id,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        content=payload.content,
        message_type=payload.message_type,
        attachment_name=None,
        attachment_url=None,
        attachment_mime_type=None,
        status="sent",
        created_at=payload.created_at,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return ChatMessage.model_validate(new_message)


@router.post("/{chat_id}/attachments", response_model=ChatMessage)
def upload_chat_attachment(
    chat_id: int,
    file: UploadFile = File(...),
    content: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessage:
    require_chat_participant(
        db.scalar(select(ChatModel).where(ChatModel.id == chat_id)),
        current_user,
        db,
    )

    file_name, mime_type, file_url = save_upload(file, f"chats/{chat_id}")
    message_type = "image" if (file.content_type or "").startswith("image/") else "file"

    message = MessageModel(
        chat_id=chat_id,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        content=content or file_name,
        message_type=message_type,
        attachment_name=file_name,
        attachment_url=file_url,
        attachment_mime_type=mime_type,
        status="sent",
        created_at=datetime.utcnow(),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return ChatMessage.model_validate(message)
