from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_workflow_service
from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.schemas.workflow import StepCreate, StepInstancePublic, WorkflowDetail, WorkflowSummary, WorkflowTemplatePublic
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("/", response_model=list[WorkflowSummary])
def list_workflows(service: WorkflowService = Depends(get_workflow_service)) -> list[WorkflowSummary]:
    return service.list_workflows()


@router.get("/{workflow_id}", response_model=WorkflowDetail)
def get_workflow(workflow_id: str, service: WorkflowService = Depends(get_workflow_service)) -> WorkflowDetail:
    try:
        return service.get_workflow(workflow_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{workflow_id}/steps", response_model=list[StepInstancePublic])
def get_workflow_steps(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> list[StepInstancePublic]:
    try:
        return service.get_workflow_steps(workflow_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{workflow_id}/steps", response_model=StepInstancePublic, status_code=status.HTTP_201_CREATED)
def create_workflow_step(
    workflow_id: str,
    payload: StepCreate,
    service: WorkflowService = Depends(get_workflow_service),
) -> StepInstancePublic:
    try:
        return service.create_workflow_step(workflow_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BusinessRuleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/templates/list", response_model=list[WorkflowTemplatePublic])
def list_workflow_templates(service: WorkflowService = Depends(get_workflow_service)) -> list[WorkflowTemplatePublic]:
    return service.list_workflow_templates()

