from fastapi import APIRouter, Depends

from app.api.deps import get_workflow_service
from app.schemas.workflow import DailyBoardResponse
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/daily-board", response_model=DailyBoardResponse)
def get_daily_board(service: WorkflowService = Depends(get_workflow_service)) -> DailyBoardResponse:
    return service.get_daily_board()
