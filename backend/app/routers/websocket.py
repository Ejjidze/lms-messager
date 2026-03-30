from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, chat_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[chat_id].append(websocket)

    def disconnect(self, chat_id: int, websocket: WebSocket) -> None:
        if websocket in self.connections[chat_id]:
            self.connections[chat_id].remove(websocket)

    async def broadcast(self, chat_id: int, payload: dict) -> None:
        for connection in list(self.connections[chat_id]):
            await connection.send_json(payload)


manager = ConnectionManager()


@router.websocket("/ws/chats/{chat_id}")
async def chat_websocket(websocket: WebSocket, chat_id: int) -> None:
    await manager.connect(chat_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(chat_id, data)
    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
