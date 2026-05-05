from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_workflow_service
from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.schemas.workflow import (
    CommentCreate,
    CommentPublic,
    ExternalResponseDecisionPayload,
    ExternalEventCreate,
    ExternalEventPublic,
    StepCompletePayload,
    StepHistoryPublic,
    StepInstancePublic,
    StepStatusUpdate,
)
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/{step_id}", response_model=StepInstancePublic)
def get_step(step_id: str, service: WorkflowService = Depends(get_workflow_service)) -> StepInstancePublic:
    try:
        return service.get_step(step_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{step_id}/status", response_model=StepInstancePublic)
def update_step_status(
    step_id: str,
    payload: StepStatusUpdate,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.update_step_status(step_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{step_id}/complete", response_model=StepInstancePublic)
def complete_step(
    step_id: str,
    payload: StepCompletePayload,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.complete_step(step_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{step_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
def add_comment(
    step_id: str,
    payload: CommentCreate,
    service: WorkflowService = Depends(get_workflow_service),
) -> CommentPublic:
    try:
        return service.add_comment(step_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{step_id}/comments", response_model=list[CommentPublic])
def list_comments(step_id: str, service: WorkflowService = Depends(get_workflow_service)) -> list[CommentPublic]:
    try:
        return service.list_comments(step_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{step_id}/history", response_model=list[StepHistoryPublic])
def list_history(step_id: str, service: WorkflowService = Depends(get_workflow_service)) -> list[StepHistoryPublic]:
    try:
        return service.list_history(step_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{step_id}/external-events", response_model=ExternalEventPublic, status_code=status.HTTP_201_CREATED)
def register_external_event(
    step_id: str,
    payload: ExternalEventCreate,
    service: WorkflowService = Depends(get_workflow_service),
) -> ExternalEventPublic:
    try:
        return service.register_external_event(step_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{step_id}/external-response/resolve", response_model=StepInstancePublic)
def resolve_external_response(
    step_id: str,
    payload: ExternalResponseDecisionPayload,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.resolve_external_response(step_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{step_id}/external-events", response_model=list[ExternalEventPublic])
def list_external_events(step_id: str, service: WorkflowService = Depends(get_workflow_service)) -> list[ExternalEventPublic]:
    try:
        return service.list_step_external_events(step_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
