from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import (
    DEFAULT_TEMPLATE_STEP_IDS,
    DEFAULT_WORKFLOW_TEMPLATE_ID,
    DEFAULT_WORKFLOW_TEMPLATE_NAME,
    WorkflowTemplateModel,
    WorkflowTemplateStepModel,
)

engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_default_workflow_template()


def ping_database() -> bool:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True


def _seed_default_workflow_template() -> None:
    with session_scope() as session:
        existing = session.get(WorkflowTemplateModel, DEFAULT_WORKFLOW_TEMPLATE_ID)
        if existing is not None:
            return

        fallback = session.scalar(
            select(WorkflowTemplateModel).where(WorkflowTemplateModel.nombre == DEFAULT_WORKFLOW_TEMPLATE_NAME)
        )
        if fallback is not None:
            return

        template = WorkflowTemplateModel(
            id=DEFAULT_WORKFLOW_TEMPLATE_ID,
            nombre=DEFAULT_WORKFLOW_TEMPLATE_NAME,
            descripcion="Plantilla inicial para diagnostico, ejecucion y verificacion final.",
            steps=[
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["diagnostico"],
                    nombre="Diagnostico",
                    descripcion="Analizar el disparador y definir alcance inicial.",
                    orden=1,
                    tipo="analisis",
                    requiere_aprobacion=False,
                    puede_tener_comentarios=True,
                ),
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["ejecucion"],
                    nombre="Ejecucion",
                    descripcion="Implementar o resolver la accion principal del flujo.",
                    orden=2,
                    tipo="ejecucion",
                    requiere_aprobacion=False,
                    puede_tener_comentarios=True,
                ),
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["verificacion_final"],
                    nombre="Verificacion final",
                    descripcion="Confirmar resultado y cierre del caso.",
                    orden=3,
                    tipo="verificacion",
                    requiere_aprobacion=True,
                    puede_tener_comentarios=True,
                ),
            ],
        )
        session.add(template)
