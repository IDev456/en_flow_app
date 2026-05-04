from fastapi import APIRouter, HTTPException, status

from app.db import ping_database

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    try:
        ping_database()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc

    return {"status": "ok", "database": "ok"}
