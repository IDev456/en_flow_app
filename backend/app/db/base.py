from typing import Protocol

from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate


class TaskStore(Protocol):
    def list(self) -> list[TaskPublic]:
        ...

    def create(self, payload: TaskCreate) -> TaskPublic:
        ...

    def update(self, task_id: str, payload: TaskUpdate) -> TaskPublic | None:
        ...

