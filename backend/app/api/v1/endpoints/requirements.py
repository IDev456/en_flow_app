from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_workflow_service
from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.schemas.workflow import TriggerCreate, TriggerDetail, TriggerPublic, TriggerUpdate, WorkflowDetail, WorkflowStartRequest
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/", response_model=list[TriggerDetail])
def list_requirements(service: WorkflowService = Depends(get_workflow_service)) -> list[TriggerDetail]:
    return service.list_requirements()


@router.post("/", response_model=TriggerPublic, status_code=status.HTTP_201_CREATED)
def create_requirement(payload: TriggerCreate, service: WorkflowService = Depends(get_workflow_service)) -> TriggerPublic:
    return service.create_requirement(payload)


@router.get("/{requirement_id}", response_model=TriggerDetail)
def get_requirement(requirement_id: str, service: WorkflowService = Depends(get_workflow_service)) -> TriggerDetail:
    try:
        return service.get_requirement(requirement_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{requirement_id}", response_model=TriggerDetail)
def update_requirement(
    requirement_id: str,
    payload: TriggerUpdate,
    service: WorkflowService = Depends(get_workflow_service),
) -> TriggerDetail:
    try:
        return service.update_requirement(requirement_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_requirement(requirement_id: str, service: WorkflowService = Depends(get_workflow_service)) -> None:
    try:
        service.delete_requirement(requirement_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{requirement_id}/start-workflow", response_model=WorkflowDetail, status_code=status.HTTP_201_CREATED)
def start_workflow_for_requirement(
    requirement_id: str,
    payload: WorkflowStartRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowDetail:
    try:
        return service.start_workflow(requirement_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
