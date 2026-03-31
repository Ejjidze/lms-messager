from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings


def ensure_media_root() -> Path:
    media_root = Path(settings.media_root)
    media_root.mkdir(parents=True, exist_ok=True)
    return media_root


def save_upload(upload: UploadFile, folder: str) -> tuple[str, str, str]:
    media_root = ensure_media_root()
    target_dir = media_root / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    original_name = upload.filename or "file"
    extension = Path(original_name).suffix
    safe_name = f"{uuid4().hex}{extension}"
    target_path = target_dir / safe_name

    with target_path.open("wb") as destination:
        destination.write(upload.file.read())

    relative_path = target_path.relative_to(media_root).as_posix()
    file_url = f"{settings.media_url}/{relative_path}"
    mime_type = upload.content_type or "application/octet-stream"
    return original_name, mime_type, file_url
