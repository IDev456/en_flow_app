from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate


class TaskService:
    def __init__(self, repository: TaskRepository) -> None:
        self.repository = repository

    def list_tasks(self) -> list[TaskPublic]:
        return self.repository.list()

    def create_task(self, payload: TaskCreate) -> TaskPublic:
        return self.repository.create(payload)

    def update_task(self, task_id: str, payload: TaskUpdate) -> TaskPublic | None:
        return self.repository.update(task_id, payload)

