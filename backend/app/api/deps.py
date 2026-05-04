from functools import lru_cache

from app.repositories.task_repository import PostgresTaskRepository, TaskRepository
from app.repositories.workflow_repository import PostgresWorkflowRepository, WorkflowRepository
from app.services.task_service import TaskService
from app.services.workflow_service import WorkflowService


@lru_cache
def get_task_repository() -> TaskRepository:
    return PostgresTaskRepository()


def get_task_service() -> TaskService:
    return TaskService(repository=get_task_repository())


@lru_cache
def get_workflow_repository() -> WorkflowRepository:
    return PostgresWorkflowRepository()


def get_workflow_service() -> WorkflowService:
    return WorkflowService(repository=get_workflow_repository())
