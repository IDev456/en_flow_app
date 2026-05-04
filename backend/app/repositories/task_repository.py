from abc import ABC, abstractmethod
from uuid import uuid4

from sqlalchemy import select

from app.db.models import TaskModel
from app.db.session import session_scope
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


class PostgresTaskRepository(TaskRepository):
    def list(self) -> list[TaskPublic]:
        with session_scope() as session:
            tasks = session.scalars(select(TaskModel).order_by(TaskModel.title.asc(), TaskModel.id.asc())).all()
            return [self._to_schema(task) for task in tasks]

    def create(self, payload: TaskCreate) -> TaskPublic:
        task = TaskModel(
            id=str(uuid4()),
            title=payload.title,
            description=payload.description,
            completed=False,
        )
        with session_scope() as session:
            session.add(task)
            session.flush()
            session.refresh(task)
            return self._to_schema(task)

    def update(self, task_id: str, payload: TaskUpdate) -> TaskPublic | None:
        with session_scope() as session:
            task = session.get(TaskModel, task_id)
            if task is None:
                return None

            if payload.title is not None:
                task.title = payload.title
            if payload.description is not None:
                task.description = payload.description
            if payload.completed is not None:
                task.completed = payload.completed

            session.flush()
            session.refresh(task)
            return self._to_schema(task)

    def _to_schema(self, task: TaskModel) -> TaskPublic:
        return TaskPublic(
            id=task.id,
            title=task.title,
            description=task.description,
            completed=task.completed,
        )
