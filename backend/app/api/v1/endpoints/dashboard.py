from fastapi import APIRouter, Depends

from app.api.deps import get_workflow_service
from app.schemas.workflow import DailyBoardResponse, StepInstancePublic, WorkflowSummary
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/pending-steps", response_model=list[StepInstancePublic])
def list_pending_steps(service: WorkflowService = Depends(get_workflow_service)) -> list[StepInstancePublic]:
    return service.list_pending_steps()


@router.get("/active-workflows", response_model=list[WorkflowSummary])
def list_active_workflows(service: WorkflowService = Depends(get_workflow_service)) -> list[WorkflowSummary]:
    return service.list_active_workflows()


@router.get("/daily-board", response_model=DailyBoardResponse)
def get_daily_board(service: WorkflowService = Depends(get_workflow_service)) -> DailyBoardResponse:
    return service.get_daily_board()
