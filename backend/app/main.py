from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect

from app.core.config import settings
from app.database import SessionLocal, engine
from app.routers import admin, analytics, assignments, auth, chats, courses, enrollments, grades, learning, notifications, progress, schedule, users, websocket
from app.seed import seed_database
from app.storage import ensure_media_root

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGIN_FILE = PROJECT_ROOT / "login.html"
INDEX_FILE = PROJECT_ROOT / "index.html"
SCHEDULE_FILE = PROJECT_ROOT / "schedule.html"
ASSIGNMENTS_FILE = PROJECT_ROOT / "assignments.html"
TESTS_FILE = PROJECT_ROOT / "tests.html"
DIRECTORY_FILE = PROJECT_ROOT / "directory.html"
MESSENGER_FILE = PROJECT_ROOT / "messenger.html"
PROFILE_FILE = PROJECT_ROOT / "profile.html"
ADMIN_FILE = PROJECT_ROOT / "admin.html"
ADMIN_MODERATION_FILE = PROJECT_ROOT / "admin-moderation.html"
ADMIN_SETTINGS_FILE = PROJECT_ROOT / "admin-settings.html"
STYLES_FILE = PROJECT_ROOT / "styles.css"
APP_JS_FILE = PROJECT_ROOT / "app.js"
SITE_JS_FILE = PROJECT_ROOT / "site.js"


def frontend_file_response(path: Path, media_type: str | None = None) -> FileResponse:
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


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


@app.get("/", include_in_schema=False)
def frontend_login() -> FileResponse:
    return frontend_file_response(LOGIN_FILE)


@app.get("/login", include_in_schema=False)
def frontend_login_alias() -> FileResponse:
    return frontend_file_response(LOGIN_FILE)


@app.get("/dashboard", include_in_schema=False)
def frontend_index() -> RedirectResponse:
    return RedirectResponse(url="/profile", status_code=302)


@app.get("/schedule", include_in_schema=False)
def frontend_schedule() -> FileResponse:
    return frontend_file_response(SCHEDULE_FILE)


@app.get("/assignments", include_in_schema=False)
def frontend_assignments() -> FileResponse:
    return frontend_file_response(ASSIGNMENTS_FILE)


@app.get("/tests", include_in_schema=False)
def frontend_tests() -> FileResponse:
    return frontend_file_response(TESTS_FILE)


@app.get("/directory", include_in_schema=False)
def frontend_directory() -> FileResponse:
    return frontend_file_response(DIRECTORY_FILE)


@app.get("/messenger", include_in_schema=False)
def frontend_messenger() -> FileResponse:
    return frontend_file_response(MESSENGER_FILE)


@app.get("/profile", include_in_schema=False)
def frontend_profile() -> FileResponse:
    return frontend_file_response(PROFILE_FILE)


@app.get("/admin", include_in_schema=False)
def frontend_admin() -> FileResponse:
    return frontend_file_response(ADMIN_FILE)


@app.get("/admin/moderation", include_in_schema=False)
def frontend_admin_moderation() -> FileResponse:
    return frontend_file_response(ADMIN_MODERATION_FILE)


@app.get("/admin/settings", include_in_schema=False)
def frontend_admin_settings() -> FileResponse:
    return frontend_file_response(ADMIN_SETTINGS_FILE)


@app.get("/styles.css", include_in_schema=False)
def frontend_styles() -> FileResponse:
    return frontend_file_response(STYLES_FILE, media_type="text/css")


@app.get("/app.js", include_in_schema=False)
def frontend_app_js() -> FileResponse:
    return frontend_file_response(APP_JS_FILE, media_type="application/javascript")


@app.get("/site.js", include_in_schema=False)
def frontend_site_js() -> FileResponse:
    return frontend_file_response(SITE_JS_FILE, media_type="application/javascript")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/api/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "EduFlow LMS API"}


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(enrollments.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(grades.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(chats.router, prefix="/api")
app.include_router(websocket.router)
