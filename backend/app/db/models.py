from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DEFAULT_WORKFLOW_TEMPLATE_ID = "7f3244e0-8b1c-4f80-b6bb-0f9285df31f3"
DEFAULT_WORKFLOW_TEMPLATE_NAME = "Flujo base de 3 pasos"
DEFAULT_TEMPLATE_STEP_IDS = {
    "diagnostico": "353f7ad8-90cd-42b8-9d8d-e26bd73976a5",
    "ejecucion": "92356023-2523-48e3-8168-a9cf460e240e",
    "verificacion_final": "14700cbf-0b8a-47ef-a164-f531679cc6dd",
}


class TaskModel(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TriggerModel(Base):
    __tablename__ = "triggers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    solicitante: Mapped[str | None] = mapped_column(String(150))
    descripcion: Mapped[str | None] = mapped_column(Text)
    tipo: Mapped[str] = mapped_column(String(80), nullable=False)
    metadata_payload: Mapped[dict | None] = mapped_column("metadata", JSON)
    ambito: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estado_general: Mapped[str] = mapped_column(String(40), nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    creado_por: Mapped[str] = mapped_column(String(120), nullable=False)
    workflow_activo_id: Mapped[str | None] = mapped_column(String(36))

    workflows: Mapped[list["WorkflowModel"]] = relationship(
        secondary="requirement_flow_links",
        back_populates="requirements",
        order_by=lambda: WorkflowModel.fecha_inicio.desc(),
    )
    legacy_workflows: Mapped[list["WorkflowModel"]] = relationship(
        back_populates="trigger",
        cascade="all, delete-orphan",
        order_by=lambda: WorkflowModel.fecha_inicio.desc(),
    )


class WorkflowTemplateModel(Base):
    __tablename__ = "workflow_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)

    steps: Mapped[list["WorkflowTemplateStepModel"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by=lambda: WorkflowTemplateStepModel.orden,
    )


class WorkflowTemplateStepModel(Base):
    __tablename__ = "workflow_template_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workflow_template_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflow_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    codigo: Mapped[str | None] = mapped_column(String(120))
    depends_on: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(String(80), nullable=False)
    requiere_aprobacion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    puede_tener_comentarios: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    condicion_para_activarse: Mapped[str | None] = mapped_column(Text)
    condicion_para_cerrarse: Mapped[str | None] = mapped_column(Text)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, default="continue")
    action_config: Mapped[dict | None] = mapped_column(JSON)
    action_label: Mapped[str | None] = mapped_column(String(160))
    waits_for_external_response: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expected_external_event: Mapped[str | None] = mapped_column(String(120))
    external_wait_reason: Mapped[str | None] = mapped_column(String(300))
    external_reference: Mapped[str | None] = mapped_column(String(200))

    template: Mapped["WorkflowTemplateModel"] = relationship(back_populates="steps")


class WorkflowModel(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trigger_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("triggers.id", ondelete="SET NULL"), nullable=True)
    workflow_template_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflow_templates.id", ondelete="RESTRICT"),
        nullable=False,
    )
    workflow_template_nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    estado: Mapped[str] = mapped_column(String(40), nullable=False)
    paso_actual: Mapped[int | None] = mapped_column(Integer)
    total_pasos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_espera_desde: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    objetivo_final: Mapped[str | None] = mapped_column(String(200))
    resolucion_esperada: Mapped[str | None] = mapped_column(String(500))
    ambito: Mapped[str | None] = mapped_column(String(20), nullable=True)

    trigger: Mapped["TriggerModel | None"] = relationship(back_populates="legacy_workflows")
    requirements: Mapped[list["TriggerModel"]] = relationship(
        secondary="requirement_flow_links",
        back_populates="workflows",
    )
    steps: Mapped[list["StepModel"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by=lambda: StepModel.orden,
    )
    external_events: Mapped[list["ExternalEventModel"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by=lambda: ExternalEventModel.fecha_creacion,
    )


class StepModel(Base):
    __tablename__ = "steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    step_template_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("workflow_template_steps.id", ondelete="SET NULL"),
    )
    codigo: Mapped[str | None] = mapped_column(String(120))
    depends_on: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(String(80), nullable=False)
    requiere_aprobacion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    puede_tener_comentarios: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, default="continue")
    action_config: Mapped[dict | None] = mapped_column(JSON)
    action_label: Mapped[str | None] = mapped_column(String(160))
    waits_for_external_response: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expected_external_event: Mapped[str | None] = mapped_column(String(120))
    esperando_de: Mapped[str | None] = mapped_column(String(160))
    external_wait_reason: Mapped[str | None] = mapped_column(String(300))
    external_reference: Mapped[str | None] = mapped_column(String(200))
    estado: Mapped[str] = mapped_column(String(40), nullable=False)
    fecha_estado_actual: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    asignado_a: Mapped[str | None] = mapped_column(String(120))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_recordatorio_espera: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_ejecucion_estimada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resultado: Mapped[str | None] = mapped_column(Text)
    observaciones: Mapped[str | None] = mapped_column(Text)
    ambito: Mapped[str | None] = mapped_column(String(20), nullable=True)

    workflow: Mapped["WorkflowModel"] = relationship(back_populates="steps")
    comments: Mapped[list["CommentModel"]] = relationship(
        back_populates="step",
        cascade="all, delete-orphan",
        order_by=lambda: CommentModel.fecha_creacion,
    )
    history_entries: Mapped[list["StepHistoryModel"]] = relationship(
        back_populates="step",
        cascade="all, delete-orphan",
        order_by=lambda: StepHistoryModel.fecha,
    )
    external_events: Mapped[list["ExternalEventModel"]] = relationship(
        back_populates="step",
        cascade="all, delete-orphan",
        order_by=lambda: ExternalEventModel.fecha_creacion,
    )


class CommentModel(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    step_instance_id: Mapped[str] = mapped_column(String(36), ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    autor: Mapped[str] = mapped_column(String(120), nullable=False)
    comentario: Mapped[str | None] = mapped_column(Text)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attachments: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)

    step: Mapped["StepModel"] = relationship(back_populates="comments")


class StepHistoryModel(Base):
    __tablename__ = "step_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    step_instance_id: Mapped[str] = mapped_column(String(36), ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    campo: Mapped[str] = mapped_column(String(80), nullable=False)
    valor_anterior: Mapped[str | None] = mapped_column(Text)
    valor_nuevo: Mapped[str | None] = mapped_column(Text)
    usuario: Mapped[str] = mapped_column(String(120), nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    nota: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)

    step: Mapped["StepModel"] = relationship(back_populates="history_entries")


class ExternalEventModel(Base):
    __tablename__ = "external_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[str] = mapped_column(String(36), ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON)
    comentario: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    registrado_por: Mapped[str] = mapped_column(String(120), nullable=False)

    workflow: Mapped["WorkflowModel"] = relationship(back_populates="external_events")
    step: Mapped["StepModel"] = relationship(back_populates="external_events")


class RequirementFlowLinkModel(Base):
    __tablename__ = "requirement_flow_links"

    requirement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("triggers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    workflow_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        primary_key=True,
    )
    fecha_vinculacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
