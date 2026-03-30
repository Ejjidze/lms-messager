from datetime import UTC, datetime

from app.database import SessionLocal
from app.services.analytics import refresh_all_materialized_summaries


def main() -> None:
    started_at = datetime.now(UTC).isoformat()
    print(f"[analytics-refresh] started at {started_at}")
    db = SessionLocal()
    try:
        refresh_all_materialized_summaries(db)
    finally:
        db.close()
    finished_at = datetime.now(UTC).isoformat()
    print(f"[analytics-refresh] finished at {finished_at}")


if __name__ == "__main__":
    main()
