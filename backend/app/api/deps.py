from functools import lru_cache

from app.repositories.task_repository import InMemoryTaskRepository, TaskRepository
from app.repositories.workflow_repository import InMemoryWorkflowRepository, WorkflowRepository
from app.services.task_service import TaskService
from app.services.workflow_service import WorkflowService


@lru_cache
def get_task_repository() -> TaskRepository:
    return InMemoryTaskRepository()


def get_task_service() -> TaskService:
    return TaskService(repository=get_task_repository())


@lru_cache
def get_workflow_repository() -> WorkflowRepository:
    return InMemoryWorkflowRepository()


def get_workflow_service() -> WorkflowService:
    return WorkflowService(repository=get_workflow_repository())
