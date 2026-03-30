import os

from dotenv import load_dotenv


load_dotenv()


class Settings:
    app_name: str = "EduFlow LMS API"
    database_url: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@localhost:3306/eduflow_lms?charset=utf8mb4",
    )


settings = Settings()
