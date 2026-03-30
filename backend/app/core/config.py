import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


class Settings:
    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "EduFlow LMS API")
        self.app_env = os.getenv("APP_ENV", "development")
        self.app_debug = os.getenv("APP_DEBUG", "true").lower() == "true"
        self.api_host = os.getenv("API_HOST", "127.0.0.1")
        self.api_port = int(os.getenv("API_PORT", "8000"))
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_access_token_expire_minutes = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        media_root = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / "media")))
        self.media_root = str(media_root if media_root.is_absolute() else (BASE_DIR / media_root).resolve())
        self.media_url = os.getenv("MEDIA_URL", "/media")
        self.database_url = os.getenv(
            "DATABASE_URL",
            "mysql+pymysql://root:password@localhost:3306/eduflow_lms?charset=utf8mb4",
        )


settings = Settings()
