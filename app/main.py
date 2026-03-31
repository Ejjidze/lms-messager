from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect

from app.core.config import settings
from app.database import SessionLocal, engine
from app.routers import analytics, assignments, auth, chats, courses, enrollments, grades, learning, notifications, progress, users, websocket
from app.seed import seed_database
from app.storage import ensure_media_root


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_media_root()
    db = SessionLocal()
    try:
        if inspect(engine).has_table("users"):
            seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend API для LMS-платформы со встроенным мессенджером.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

media_directory = ensure_media_root()
app.mount(
    settings.media_url,
    StaticFiles(directory=media_directory),
    name="media",
)


@app.get("/api/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "EduFlow LMS API"}


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(enrollments.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(grades.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(chats.router, prefix="/api")
app.include_router(websocket.router)
