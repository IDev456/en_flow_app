from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class TriggerStatus(StrEnum):
    SIN_FLOWS = "sin_flows"
    EN_PROCESO = "en_proceso"
    ESPERANDO_RESPUESTA = "esperando_respuesta"
    CON_PROBLEMA = "con_problema"
    RESUELTO = "resuelto"
    CANCELADO = "cancelado"


class WorkflowStatus(StrEnum):
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    ESPERANDO_RESPUESTA = "esperando_respuesta"
    EN_ESPERA = "en_espera"
    CON_PROBLEMA = "con_problema"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class StepStatus(StrEnum):
    ACTIVO = "activo"
    ESPERA = "espera"
    PROBLEMA = "problema"
    ESPERANDO_RESPUESTA = "esperando_respuesta"
    COMPLETADO = "completado"
    CANCELADA = "cancelada"


class StepTransitionType(StrEnum):
    NEXT_TASK = "next_task"
    WAIT_EXTERNAL = "wait_external"
    FINISH_FLOW = "finish_flow"


class TriggerBase(BaseModel):
    solicitante: str | None = Field(default=None, max_length=150)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: str = Field(default="requerimiento", min_length=1, max_length=80)
    metadata: dict[str, Any] | None = None


class TriggerCreate(TriggerBase):
    creado_por: str = Field(default="sistema", min_length=1, max_length=120)


class TriggerUpdate(BaseModel):
    solicitante: str | None = Field(default=None, max_length=150)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: str | None = Field(default=None, min_length=1, max_length=80)
    metadata: dict[str, Any] | None = None


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
    codigo: str = Field(min_length=1, max_length=120)
    depends_on: list[str] = Field(default_factory=list)
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    orden: int = Field(ge=1)
    tipo: str = Field(min_length=1, max_length=80)
    requiere_aprobacion: bool = False
    puede_tener_comentarios: bool = True
    condicion_para_activarse: str | None = None
    condicion_para_cerrarse: str | None = None
    action_type: str = Field(default="continue", min_length=1, max_length=80)
    action_config: dict[str, Any] | None = None
    action_label: str | None = Field(default=None, max_length=160)
    waits_for_external_response: bool = False
    expected_external_event: str | None = Field(default=None, max_length=120)
    external_wait_reason: str | None = Field(default=None, max_length=300)
    external_reference: str | None = Field(default=None, max_length=200)


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
    trigger_id: str | None = None
    requirement_ids: list[str] = Field(default_factory=list)
    workflow_template_id: str
    workflow_template_nombre: str
    estado: WorkflowStatus
    pasos_activos: list[int] = Field(default_factory=list)
    paso_actual: int | None = None
    total_pasos: int = Field(default=0, ge=0)
    fecha_inicio: datetime
    fecha_fin: datetime | None = None


class StepInstanceBase(BaseModel):
    codigo: str | None = Field(default=None, max_length=120)
    depends_on: list[str] = Field(default_factory=list)
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    orden: int = Field(ge=1)
    action_type: str = Field(default="continue", min_length=1, max_length=80)
    action_config: dict[str, Any] | None = None
    action_label: str | None = Field(default=None, max_length=160)
    waits_for_external_response: bool = False
    expected_external_event: str | None = Field(default=None, max_length=120)
    external_wait_reason: str | None = Field(default=None, max_length=300)
    external_reference: str | None = Field(default=None, max_length=200)


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
    ultimo_comentario_fecha: datetime | None = None
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
    action_type: str = Field(default="continue", min_length=1, max_length=80)
    action_config: dict[str, Any] | None = None
    action_label: str | None = Field(default=None, max_length=160)
    waits_for_external_response: bool = False
    expected_external_event: str | None = Field(default=None, max_length=120)
    external_wait_reason: str | None = Field(default=None, max_length=300)
    external_reference: str | None = Field(default=None, max_length=200)


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


class NextTaskInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    asignado_a: str | None = Field(default=None, max_length=120)
    fecha_vencimiento: datetime | None = None


class ExternalWaitInput(BaseModel):
    que_se_espera: str = Field(min_length=1, max_length=200)
    origen: str | None = Field(default=None, max_length=120)
    detalle: str | None = Field(default=None, max_length=1000)
    referencia_externa: str | None = Field(default=None, max_length=200)
    attachments: list[AttachmentBase] = Field(default_factory=list)


class FinishFlowInput(BaseModel):
    resultado_final: str | None = Field(default=None, max_length=1000)
    motivo_cierre: str | None = Field(default=None, max_length=1000)
    attachments: list[AttachmentBase] = Field(default_factory=list)


class StepCompletePayload(BaseModel):
    usuario: str = Field(min_length=1, max_length=120)
    resultado_cierre: str | None = Field(default=None, max_length=1000)
    comentario: str | None = Field(default=None, max_length=1000)
    observaciones: str | None = Field(default=None, max_length=1000)
    transition_type: StepTransitionType
    next_task: NextTaskInput | None = None
    external_wait: ExternalWaitInput | None = None
    finish_data: FinishFlowInput | None = None
    attachments: list[AttachmentBase] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_transition(self) -> "StepCompletePayload":
        closing_note = (self.resultado_cierre or self.comentario or "").strip()
        if len(closing_note) < 3:
            raise ValueError("Debes indicar un resultado de cierre de al menos 3 caracteres")

        if self.transition_type == StepTransitionType.NEXT_TASK and self.next_task is None:
            raise ValueError("Debes indicar la proxima tarea")
        if self.transition_type == StepTransitionType.WAIT_EXTERNAL and self.external_wait is None:
            raise ValueError("Debes indicar la informacion de espera externa")
        if self.transition_type == StepTransitionType.FINISH_FLOW and self.finish_data is None:
            raise ValueError("Debes indicar los datos de cierre del flow")
        return self


class ExternalResponseDecisionPayload(BaseModel):
    usuario: str = Field(min_length=1, max_length=120)
    resultado_cierre: str | None = Field(default=None, max_length=1000)
    comentario: str | None = Field(default=None, max_length=1000)
    transition_type: StepTransitionType
    next_task: NextTaskInput | None = None
    finish_data: FinishFlowInput | None = None
    attachments: list[AttachmentBase] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_transition(self) -> "ExternalResponseDecisionPayload":
        closing_note = (self.resultado_cierre or self.comentario or "").strip()
        if len(closing_note) < 3:
            raise ValueError("Debes indicar un resultado de cierre de al menos 3 caracteres")
        if self.transition_type not in {StepTransitionType.NEXT_TASK, StepTransitionType.FINISH_FLOW}:
            raise ValueError("Luego de una respuesta externa solo puedes crear proxima tarea o finalizar flow")
        if self.transition_type == StepTransitionType.NEXT_TASK and self.next_task is None:
            raise ValueError("Debes indicar la proxima tarea")
        if self.transition_type == StepTransitionType.FINISH_FLOW and self.finish_data is None:
            raise ValueError("Debes indicar los datos de cierre del flow")
        return self


class QuickCaptureRequest(BaseModel):
    titulo: str = Field(min_length=3, max_length=200)
    detalle: str | None = Field(default=None, max_length=1000)
    asignado_a: str | None = Field(default=None, max_length=120)
    fecha_vencimiento: datetime | None = None
    creado_por: str = Field(default="sistema", min_length=1, max_length=120)


class RequirementLinkPayload(BaseModel):
    requirement_id: str


class RequirementCreateFromFlowPayload(BaseModel):
    descripcion: str = Field(min_length=3, max_length=1000)
    solicitante: str | None = Field(default=None, max_length=150)
    creado_por: str = Field(default="sistema", min_length=1, max_length=120)


class DailyBoardResponse(BaseModel):
    tareas_activas: list[StepInstancePublic] = Field(default_factory=list)
    tareas_esperando_respuesta: list[StepInstancePublic] = Field(default_factory=list)
    tareas_en_pausa: list[StepInstancePublic] = Field(default_factory=list)
    tareas_con_problema: list[StepInstancePublic] = Field(default_factory=list)
    flows_recientes: list[WorkflowSummary] = Field(default_factory=list)
    flows_cerrados_recientes: list[WorkflowSummary] = Field(default_factory=list)


class CommentCreate(BaseModel):
    autor: str = Field(min_length=1, max_length=120)
    comentario: str | None = Field(default=None, max_length=1000)
    attachments: list[AttachmentBase] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_content(self) -> "CommentCreate":
        if not (self.comentario and self.comentario.strip()) and not self.attachments:
            raise ValueError("Debes enviar un registro o al menos un adjunto")
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


class ExternalEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=120)
    source: str = Field(default="manual", min_length=1, max_length=120)
    payload: dict[str, Any] | None = None
    comentario: str | None = Field(default=None, max_length=1000)
    attachments: list[AttachmentBase] = Field(default_factory=list)
    registrado_por: str = Field(default="sistema", min_length=1, max_length=120)


class ExternalEventPublic(BaseModel):
    id: str
    workflow_id: str
    step_id: str
    event_type: str
    source: str
    payload: dict[str, Any] | None = None
    comentario: str | None = None
    attachments: list[AttachmentPublic] = Field(default_factory=list)
    fecha_creacion: datetime
    registrado_por: str
