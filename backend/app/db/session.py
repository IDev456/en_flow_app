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
    _migrate_workflow_schema()
    _seed_default_workflow_template()


def ping_database() -> bool:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True


def _seed_default_workflow_template() -> None:
    with session_scope() as session:
        existing = session.get(WorkflowTemplateModel, DEFAULT_WORKFLOW_TEMPLATE_ID)
        if existing is not None:
            _backfill_default_template_steps(existing)
            return

        fallback = session.scalar(
            select(WorkflowTemplateModel).where(WorkflowTemplateModel.nombre == DEFAULT_WORKFLOW_TEMPLATE_NAME)
        )
        if fallback is not None:
            _backfill_default_template_steps(fallback)
            return

        template = WorkflowTemplateModel(
            id=DEFAULT_WORKFLOW_TEMPLATE_ID,
            nombre=DEFAULT_WORKFLOW_TEMPLATE_NAME,
            descripcion="Plantilla inicial para diagnostico, ejecucion y verificacion final.",
            steps=[
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["diagnostico"],
                    codigo="diagnostico",
                    depends_on=[],
                    nombre="Diagnostico",
                    descripcion="Analizar el disparador y definir alcance inicial.",
                    orden=1,
                    tipo="analisis",
                    requiere_aprobacion=False,
                    puede_tener_comentarios=True,
                ),
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["ejecucion"],
                    codigo="ejecucion",
                    depends_on=["diagnostico"],
                    nombre="Ejecucion",
                    descripcion="Implementar o resolver la accion principal del flujo.",
                    orden=2,
                    tipo="ejecucion",
                    requiere_aprobacion=False,
                    puede_tener_comentarios=True,
                ),
                WorkflowTemplateStepModel(
                    id=DEFAULT_TEMPLATE_STEP_IDS["verificacion_final"],
                    codigo="verificacion_final",
                    depends_on=["ejecucion"],
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


def _backfill_default_template_steps(template: WorkflowTemplateModel) -> None:
    ordered_steps = sorted(template.steps, key=lambda item: item.orden)
    if not ordered_steps:
        return

    previous_code: str | None = None
    for step in ordered_steps:
        step.codigo = step.codigo or step.nombre.strip().lower().replace(" ", "_")
        # Compatibilidad legacy:
        # - versiones viejas pueden tener depends_on = NULL
        # - migraciones intermedias pueden dejar depends_on = [] en todos los pasos
        # Para plantilla lineal base, los pasos posteriores al primero deben depender del anterior.
        if step.depends_on is None or (previous_code and step.depends_on == []):
            step.depends_on = [previous_code] if previous_code else []
        step.action_type = step.action_type or "continue"
        if step.waits_for_external_response is None:
            step.waits_for_external_response = False
        previous_code = step.codigo


def _migrate_workflow_schema() -> None:
    is_postgres = engine.url.get_backend_name().startswith("postgres")
    empty_json_literal = "'[]'::json" if is_postgres else "'[]'"
    migration_statements = [
        """
        CREATE TABLE IF NOT EXISTS requirement_flow_links (
            requirement_id VARCHAR(36) NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
            workflow_id VARCHAR(36) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
            fecha_vinculacion TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (requirement_id, workflow_id)
        )
        """,
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS codigo VARCHAR(120)",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS depends_on JSON",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS action_type VARCHAR(80)",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS action_config JSON",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS action_label VARCHAR(160)",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS waits_for_external_response BOOLEAN",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS expected_external_event VARCHAR(120)",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS external_wait_reason VARCHAR(300)",
        "ALTER TABLE workflow_template_steps ADD COLUMN IF NOT EXISTS external_reference VARCHAR(200)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS codigo VARCHAR(120)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS depends_on JSON",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS action_type VARCHAR(80)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS action_config JSON",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS action_label VARCHAR(160)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS waits_for_external_response BOOLEAN",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS expected_external_event VARCHAR(120)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS external_wait_reason VARCHAR(300)",
        "ALTER TABLE steps ADD COLUMN IF NOT EXISTS external_reference VARCHAR(200)",
        f"UPDATE workflow_template_steps SET depends_on = {empty_json_literal} WHERE depends_on IS NULL",
        "UPDATE workflow_template_steps SET action_type = 'continue' WHERE action_type IS NULL",
        "UPDATE workflow_template_steps SET waits_for_external_response = FALSE WHERE waits_for_external_response IS NULL",
        f"UPDATE steps SET depends_on = {empty_json_literal} WHERE depends_on IS NULL",
        "UPDATE steps SET action_type = 'continue' WHERE action_type IS NULL",
        "UPDATE steps SET waits_for_external_response = FALSE WHERE waits_for_external_response IS NULL",
        """
        INSERT INTO requirement_flow_links (requirement_id, workflow_id, fecha_vinculacion)
        SELECT w.trigger_id, w.id, w.fecha_inicio
        FROM workflows w
        WHERE w.trigger_id IS NOT NULL
        ON CONFLICT (requirement_id, workflow_id) DO NOTHING
        """,
    ]
    if is_postgres:
        migration_statements.insert(1, "ALTER TABLE workflows ALTER COLUMN trigger_id DROP NOT NULL")
    with engine.begin() as connection:
        for statement in migration_statements:
            connection.execute(text(statement))
