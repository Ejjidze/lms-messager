from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Chat as ChatModel
from app.models import Message as MessageModel
from app.schemas.chats import Chat, ChatMessage, ChatWithMessages, MessageCreate

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[Chat])
def list_chats(search: str | None = Query(default=None), db: Session = Depends(get_db)) -> list[Chat]:
    query = select(ChatModel).order_by(ChatModel.id)
    if search:
        search_term = f"%{search}%"
        query = query.where(or_(ChatModel.title.ilike(search_term), ChatModel.chat_type.ilike(search_term)))
    result = db.scalars(query).all()
    return [Chat.model_validate(chat) for chat in result]


@router.get("/{chat_id}", response_model=ChatWithMessages)
def get_chat(chat_id: int, db: Session = Depends(get_db)) -> ChatWithMessages:
    chat = db.scalar(
        select(ChatModel)
        .options(selectinload(ChatModel.messages))
        .where(ChatModel.id == chat_id)
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден.")

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
def create_message(chat_id: int, payload: MessageCreate, db: Session = Depends(get_db)) -> ChatMessage:
    chat = db.scalar(select(ChatModel).where(ChatModel.id == chat_id))
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден.")

    new_message = MessageModel(
        chat_id=chat_id,
        sender_id=payload.sender_id,
        sender_name=payload.sender_name,
        content=payload.content,
        message_type=payload.message_type,
        status="sent",
        created_at=payload.created_at,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return ChatMessage.model_validate(new_message)
