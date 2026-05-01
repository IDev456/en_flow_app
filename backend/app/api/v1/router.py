from fastapi import APIRouter

from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.steps import router as steps_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.triggers import router as triggers_router
from app.api.v1.endpoints.workflows import router as workflows_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(triggers_router, prefix="/triggers", tags=["triggers"])
api_router.include_router(workflows_router, prefix="/workflows", tags=["workflows"])
api_router.include_router(steps_router, prefix="/steps", tags=["steps"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
