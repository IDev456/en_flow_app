from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_workflow_service
from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.schemas.workflow import TriggerCreate, TriggerDetail, TriggerPublic, WorkflowDetail, WorkflowStartRequest
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/", response_model=list[TriggerDetail])
def list_triggers(service: WorkflowService = Depends(get_workflow_service)) -> list[TriggerDetail]:
    return service.list_triggers()


@router.post("/", response_model=TriggerPublic, status_code=status.HTTP_201_CREATED)
def create_trigger(payload: TriggerCreate, service: WorkflowService = Depends(get_workflow_service)) -> TriggerPublic:
    return service.create_trigger(payload)


@router.get("/{trigger_id}", response_model=TriggerDetail)
def get_trigger(trigger_id: str, service: WorkflowService = Depends(get_workflow_service)) -> TriggerDetail:
    try:
        return service.get_trigger(trigger_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{trigger_id}/start-workflow", response_model=WorkflowDetail, status_code=status.HTTP_201_CREATED)
def start_workflow(
    trigger_id: str,
    payload: WorkflowStartRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowDetail:
    try:
        return service.start_workflow(trigger_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
