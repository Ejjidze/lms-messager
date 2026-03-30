from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authorization import require_chat_participant
from app.core.security import decode_access_token
from app.database import SessionLocal
from app.models import Chat, Message, User

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[int, list[dict[str, int | WebSocket]]] = defaultdict(list)

    async def connect(self, chat_id: int, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[chat_id].append({"user_id": user_id, "websocket": websocket})

    def disconnect(self, chat_id: int, websocket: WebSocket) -> None:
        self.connections[chat_id] = [
            connection for connection in self.connections[chat_id] if connection["websocket"] != websocket
        ]

    async def broadcast(self, chat_id: int, payload: dict) -> None:
        for connection in list(self.connections[chat_id]):
            await connection["websocket"].send_json(payload)

    def has_other_active_participants(self, chat_id: int, user_id: int) -> bool:
        return any(connection["user_id"] != user_id for connection in self.connections[chat_id])

    def is_user_connected(self, chat_id: int, user_id: int) -> bool:
        return any(connection["user_id"] == user_id for connection in self.connections[chat_id])


manager = ConnectionManager()


def serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "content": message.content,
        "message_type": message.message_type,
        "attachment_name": message.attachment_name,
        "attachment_url": message.attachment_url,
        "attachment_mime_type": message.attachment_mime_type,
        "status": message.status,
        "created_at": message.created_at.isoformat(),
    }


def authenticate_websocket_user(websocket: WebSocket, db: Session) -> User:
    token = websocket.query_params.get("token")
    if not token:
        raise ValueError("Требуется JWT-токен в query-параметре `token`.")

    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise ValueError("Некорректный токен.")

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise ValueError("Пользователь не найден.")
    return user


def set_message_status(message: Message, new_status: str) -> bool:
    order = {"sent": 0, "delivered": 1, "read": 2}
    current = order.get(message.status, 0)
    target = order.get(new_status, 0)
    if target > current:
        message.status = new_status
        return True
    return False


def mark_chat_messages_as_delivered(db: Session, chat_id: int, user_id: int) -> list[Message]:
    messages = db.scalars(
        select(Message)
        .where(Message.chat_id == chat_id, Message.sender_id != user_id, Message.status == "sent")
        .order_by(Message.id)
    ).all()
    updated = [message for message in messages if set_message_status(message, "delivered")]
    if updated:
        db.commit()
    return updated


@router.websocket("/ws/chats/{chat_id}")
async def chat_websocket(websocket: WebSocket, chat_id: int) -> None:
    db = SessionLocal()
    try:
        user = authenticate_websocket_user(websocket, db)
        try:
            chat = require_chat_participant(db.scalar(select(Chat).where(Chat.id == chat_id)), user, db)
        except HTTPException:
            await websocket.close(code=1008, reason="Нет доступа к этому чату.")
            return

        await manager.connect(chat_id, user.id, websocket)

        delivered_on_connect = mark_chat_messages_as_delivered(db, chat_id, user.id)
        for message in delivered_on_connect:
            await manager.broadcast(
                chat_id,
                {
                    "event": "message:status",
                    "message_id": message.id,
                    "chat_id": chat_id,
                    "status": "delivered",
                    "updated_at": datetime.now(UTC).isoformat(),
                },
            )

        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "message:new":
                message = Message(
                    chat_id=chat_id,
                    sender_id=user.id,
                    sender_name=user.full_name,
                    content=data.get("content", ""),
                    message_type=data.get("message_type", "text"),
                    attachment_name=data.get("attachment_name"),
                    attachment_url=data.get("attachment_url"),
                    attachment_mime_type=data.get("attachment_mime_type"),
                    status="sent",
                    created_at=datetime.now(UTC),
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                await manager.broadcast(
                    chat_id,
                    {
                        "event": "message:new",
                        "message": serialize_message(message),
                    },
                )

                if manager.has_other_active_participants(chat_id, user.id) and set_message_status(message, "delivered"):
                    db.commit()
                    await manager.broadcast(
                        chat_id,
                        {
                            "event": "message:status",
                            "message_id": message.id,
                            "chat_id": chat_id,
                            "status": "delivered",
                            "updated_at": datetime.now(UTC).isoformat(),
                        },
                    )

            elif event == "message:delivered":
                message_id = data.get("message_id")
                message = db.scalar(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
                if message and message.sender_id != user.id and set_message_status(message, "delivered"):
                    db.commit()
                    await manager.broadcast(
                        chat_id,
                        {
                            "event": "message:status",
                            "message_id": message.id,
                            "chat_id": chat_id,
                            "status": "delivered",
                            "updated_at": datetime.now(UTC).isoformat(),
                        },
                    )

            elif event == "message:read":
                message_id = data.get("message_id")
                message = db.scalar(select(Message).where(Message.id == message_id, Message.chat_id == chat_id))
                if message and message.sender_id != user.id and set_message_status(message, "read"):
                    db.commit()
                    await manager.broadcast(
                        chat_id,
                        {
                            "event": "message:status",
                            "message_id": message.id,
                            "chat_id": chat_id,
                            "status": "read",
                            "updated_at": datetime.now(UTC).isoformat(),
                        },
                    )

            elif event == "typing:start":
                await manager.broadcast(
                    chat_id,
                    {
                        "event": "typing:start",
                        "chat_id": chat_id,
                        "user_id": user.id,
                        "user_name": user.full_name,
                    },
                )

            elif event == "typing:stop":
                await manager.broadcast(
                    chat_id,
                    {
                        "event": "typing:stop",
                        "chat_id": chat_id,
                        "user_id": user.id,
                        "user_name": user.full_name,
                    },
                )
    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
    except ValueError as error:
        await websocket.close(code=1008, reason=str(error))
    finally:
        db.close()
