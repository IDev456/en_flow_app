from abc import ABC, abstractmethod
from uuid import uuid4

from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate


class TaskRepository(ABC):
    @abstractmethod
    def list(self) -> list[TaskPublic]:
        raise NotImplementedError

    @abstractmethod
    def create(self, payload: TaskCreate) -> TaskPublic:
        raise NotImplementedError

    @abstractmethod
    def update(self, task_id: str, payload: TaskUpdate) -> TaskPublic | None:
        raise NotImplementedError


class InMemoryTaskRepository(TaskRepository):
    def __init__(self) -> None:
        self._tasks: dict[str, TaskPublic] = {}

    def list(self) -> list[TaskPublic]:
        return list(self._tasks.values())

    def create(self, payload: TaskCreate) -> TaskPublic:
        task = TaskPublic(
            id=str(uuid4()),
            title=payload.title,
            description=payload.description,
            completed=False,
        )
        self._tasks[task.id] = task
        return task

    def update(self, task_id: str, payload: TaskUpdate) -> TaskPublic | None:
        task = self._tasks.get(task_id)
        if task is None:
            return None

        updated = task.model_copy(
            update={
                "title": payload.title if payload.title is not None else task.title,
                "description": payload.description if payload.description is not None else task.description,
                "completed": payload.completed if payload.completed is not None else task.completed,
            }
        )
        self._tasks[task_id] = updated
        return updated

