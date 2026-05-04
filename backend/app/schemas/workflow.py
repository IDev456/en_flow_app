from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class TriggerStatus(StrEnum):
    NUEVO = "nuevo"
    EN_PROCESO = "en_proceso"
    RESUELTO = "resuelto"
    CANCELADO = "cancelado"


class WorkflowStatus(StrEnum):
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class StepStatus(StrEnum):
    ACTIVO = "activo"
    ESPERA = "espera"
    PROBLEMA = "problema"
    COMPLETADO = "completado"


class TriggerBase(BaseModel):
    solicitante: str | None = Field(default=None, max_length=150)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: str = Field(default="requerimiento", min_length=1, max_length=80)
    metadata: dict[str, Any] | None = None


class TriggerCreate(TriggerBase):
    creado_por: str = Field(default="sistema", min_length=1, max_length=120)


class TriggerPublic(TriggerBase):
    id: str
    estado_general: TriggerStatus
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    creado_por: str
    workflow_activo_id: str | None = None


class TriggerDetail(TriggerPublic):
    workflow_ids: list[str] = Field(default_factory=list)


class StepTemplateBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    orden: int = Field(ge=1)
    tipo: str = Field(min_length=1, max_length=80)
    requiere_aprobacion: bool = False
    puede_tener_comentarios: bool = True
    condicion_para_activarse: str | None = None
    condicion_para_cerrarse: str | None = None


class StepTemplatePublic(StepTemplateBase):
    id: str


class WorkflowTemplatePublic(BaseModel):
    id: str
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    steps: list[StepTemplatePublic] = Field(default_factory=list)


class WorkflowInstanceBase(BaseModel):
    objetivo_final: str | None = Field(default=None, max_length=200)
    resolucion_esperada: str | None = Field(default=None, max_length=500)


class InitialStepOverride(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    asignado_a: str | None = Field(default=None, max_length=120)
    fecha_vencimiento: datetime | None = None


class WorkflowStartRequest(WorkflowInstanceBase):
    workflow_template_id: str | None = None
    primer_paso: InitialStepOverride


class WorkflowSummary(WorkflowInstanceBase):
    id: str
    trigger_id: str
    workflow_template_id: str
    workflow_template_nombre: str
    estado: WorkflowStatus
    paso_actual: int | None = None
    total_pasos: int = Field(default=0, ge=0)
    fecha_inicio: datetime
    fecha_fin: datetime | None = None


class StepInstanceBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    orden: int = Field(ge=1)


class StepInstancePublic(StepInstanceBase):
    id: str
    workflow_id: str
    step_template_id: str | None = None
    tipo: str = Field(min_length=1, max_length=80)
    requiere_aprobacion: bool = False
    puede_tener_comentarios: bool = True
    estado: StepStatus
    fecha_estado_actual: datetime
    asignado_a: str | None = None
    fecha_creacion: datetime
    fecha_inicio: datetime | None = None
    fecha_vencimiento: datetime | None = None
    fecha_cierre: datetime | None = None
    resultado: str | None = None
    observaciones: str | None = None
    ultimo_comentario: str | None = None
    ultimo_comentario_tipo: str | None = None
    ultimo_comentario_adjunto_nombre: str | None = None
    ultimo_comentario_adjunto_content_type: str | None = None


class WorkflowDetail(WorkflowSummary):
    steps: list[StepInstancePublic] = Field(default_factory=list)


class StepCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: str = Field(default="manual", min_length=1, max_length=80)
    requiere_aprobacion: bool = False
    puede_tener_comentarios: bool = True
    asignado_a: str | None = None
    fecha_vencimiento: datetime | None = None


class AttachmentBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    content_type: str = Field(min_length=1, max_length=120)
    size_bytes: int = Field(ge=0)
    content_base64: str = Field(min_length=1, max_length=10_000_000)


class AttachmentPublic(AttachmentBase):
    id: str


class StepStatusUpdate(BaseModel):
    estado: StepStatus
    usuario: str = Field(min_length=1, max_length=120)
    nota: str | None = Field(default=None, max_length=1000)
    attachments: list[AttachmentBase] = Field(default_factory=list)


class StepCompletePayload(BaseModel):
    usuario: str = Field(min_length=1, max_length=120)
    comentario: str = Field(min_length=3, max_length=1000)
    resultado: str | None = Field(default=None, max_length=1000)
    observaciones: str | None = Field(default=None, max_length=1000)
    siguiente_paso: StepCreate | None = None
    finalizar_workflow: bool = False
    attachments: list[AttachmentBase] = Field(default_factory=list)


class CommentCreate(BaseModel):
    autor: str = Field(min_length=1, max_length=120)
    comentario: str | None = Field(default=None, max_length=1000)
    attachments: list[AttachmentBase] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_content(self) -> "CommentCreate":
        if not (self.comentario and self.comentario.strip()) and not self.attachments:
            raise ValueError("Debes enviar un comentario o al menos un adjunto")
        return self


class CommentPublic(CommentCreate):
    id: str
    step_instance_id: str
    fecha_creacion: datetime


class StepHistoryPublic(BaseModel):
    id: str
    step_instance_id: str
    campo: str
    valor_anterior: str | None = None
    valor_nuevo: str | None = None
    usuario: str
    fecha: datetime
    nota: str | None = None
    attachments: list[AttachmentPublic] = Field(default_factory=list)
