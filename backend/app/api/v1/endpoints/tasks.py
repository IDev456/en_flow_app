from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_task_service
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate
from app.services.task_service import TaskService

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

