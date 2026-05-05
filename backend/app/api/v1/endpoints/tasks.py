from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_task_service, get_workflow_service
from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.schemas.workflow import ExternalEventCreate, ExternalEventPublic, ExternalResponseDecisionPayload, StepCompletePayload, StepInstancePublic
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate
from app.services.task_service import TaskService
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/", response_model=list[TaskPublic])
def list_tasks(service: TaskService = Depends(get_task_service)) -> list[TaskPublic]:
    return service.list_tasks()


@router.post("/", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, service: TaskService = Depends(get_task_service)) -> TaskPublic:
    return service.create_task(payload)


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    service: TaskService = Depends(get_task_service),
) -> TaskPublic:
    task = service.update_task(task_id, payload)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/{task_id}/complete-with-decision", response_model=StepInstancePublic)
def complete_task_with_decision(
    task_id: str,
    payload: StepCompletePayload,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.complete_step(task_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{task_id}/external-response", response_model=StepInstancePublic)
def resolve_external_response_from_task(
    task_id: str,
    payload: ExternalResponseDecisionPayload,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.resolve_external_response(task_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{task_id}/external-events", response_model=ExternalEventPublic)
def register_external_response_event_from_task(
    task_id: str,
    payload: ExternalEventCreate,
    service: WorkflowService = Depends(get_workflow_service),
) -> ExternalEventPublic:
    try:
        return service.register_external_event(task_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
