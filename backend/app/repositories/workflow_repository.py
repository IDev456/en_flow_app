from abc import ABC, abstractmethod
from datetime import datetime, timezone
import unicodedata
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import (
    DEFAULT_WORKFLOW_TEMPLATE_ID,
    CommentModel,
    ExternalEventModel,
    RequirementFlowLinkModel,
    StepHistoryModel,
    StepModel,
    TriggerModel,
    WorkflowModel,
    WorkflowTemplateModel,
)
from app.db.session import session_scope
from app.schemas.workflow import (
    Ambito,
    AttachmentBase,
    AttachmentPublic,
    CommentCreate,
    CommentPublic,
    ExternalEventCreate,
    ExternalEventPublic,
    StepCreate,
    StepHistoryPublic,
    StepInstancePublic,
    StepStatus,
    StepTemplatePublic,
    WorkLogEntry,
    WorkLogEntryType,
    TriggerCreate,
    TriggerDetail,
    TriggerPublic,
    TriggerStatus,
    WorkflowDetail,
    WorkflowInstanceBase,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowTemplatePublic,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA, StepStatus.ESPERANDO_RESPUESTA}


def _sort_template_steps(steps: list[StepTemplatePublic]) -> list[StepTemplatePublic]:
    return sorted(steps, key=lambda item: (item.orden, item.codigo, item.id))


def _sort_step_instances(steps: list[StepInstancePublic]) -> list[StepInstancePublic]:
    return sorted(steps, key=lambda item: (item.orden, item.codigo or "", item.id))


def _active_step_orders(steps: list[StepInstancePublic]) -> list[int]:
    return [step.orden for step in _sort_step_instances(steps) if step.estado in OPEN_STEP_STATUSES]


def _clean_text(value: object | None) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_journal_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    without_accents = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return " ".join(without_accents.split())


def _is_noisy_automatic_journal_text(value: str | None) -> bool:
    normalized = _normalize_journal_text(value or "")
    if not normalized:
        return False
    return (
        "tarea creada desde cierre dinamico" in normalized
        or "se creo la proxima tarea" in normalized
        or "esperando respuesta externa de externo" in normalized
        or "esperando respuesta de externo" in normalized
    )


def _format_workflow_title(objetivo_final: str | None, workflow_id: str) -> str:
    title = _clean_text(objetivo_final)
    if title:
        return title
    return f"Flow {workflow_id[:8]}"


def _format_history_summary(entry: StepHistoryPublic) -> str:
    note = _clean_text(entry.nota)
    if note:
        return note

    field = _clean_text(entry.campo) or "campo"
    if entry.campo == "estado":
        previous = _clean_text(entry.valor_anterior) or "sin estado"
        current = _clean_text(entry.valor_nuevo) or "sin estado"
        return f"Cambio de estado: {previous} -> {current}"

    previous = _clean_text(entry.valor_anterior) or "sin valor"
    current = _clean_text(entry.valor_nuevo) or "sin valor"
    return f"Cambio en {field}: {previous} -> {current}"


def _attachment_summary(attachments: list[AttachmentPublic]) -> str | None:
    if not attachments:
        return None
    first = attachments[0]
    return "Imagen adjunta" if first.content_type.startswith("image/") else "Archivo adjunto"


def _resolve_first_step_name(payload: WorkflowInstanceBase) -> str:
    first_step_override = getattr(payload, "primer_paso", None)
    if first_step_override:
        override_name = _clean_text(getattr(first_step_override, "nombre", None))
        if override_name:
            return override_name

    objective_name = _clean_text(getattr(payload, "objetivo_final", None))
    if objective_name:
        return objective_name

    return "Tarea inicial"


def _normalize_template_steps(steps: list[StepTemplatePublic]) -> list[StepTemplatePublic]:
    ordered = _sort_template_steps(steps)
    if len(ordered) <= 1:
        return ordered

    # Legacy guard:
    # if all dependencies are empty and template looks strictly linear by orden,
    # infer dependencia del paso anterior para evitar activar todo al inicio.
    all_empty_dependencies = all(len(step.depends_on) == 0 for step in ordered)
    order_values = [step.orden for step in ordered]
    strictly_increasing_orders = all(curr > prev for prev, curr in zip(order_values, order_values[1:]))
    unique_orders = len(set(order_values)) == len(order_values)

    if not (all_empty_dependencies and strictly_increasing_orders and unique_orders):
        return ordered

    normalized: list[StepTemplatePublic] = []
    previous_code: str | None = None
    for step in ordered:
        depends_on = [previous_code] if previous_code else []
        normalized_step = step.model_copy(update={"depends_on": depends_on})
        normalized.append(normalized_step)
        previous_code = normalized_step.codigo

    return normalized


class WorkflowRepository(ABC):
    @abstractmethod
    def list_triggers(self) -> list[TriggerDetail]:
        raise NotImplementedError

    @abstractmethod
    def get_trigger(self, trigger_id: str) -> TriggerDetail | None:
        raise NotImplementedError

    @abstractmethod
    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        raise NotImplementedError

    @abstractmethod
    def delete_trigger(self, trigger_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def delete_workflow(self, workflow_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def save_trigger(self, trigger: TriggerPublic) -> TriggerPublic:
        raise NotImplementedError

    @abstractmethod
    def list_workflows(self) -> list[WorkflowSummary]:
        raise NotImplementedError

    @abstractmethod
    def get_workflow(self, workflow_id: str) -> WorkflowDetail | None:
        raise NotImplementedError

    @abstractmethod
    def create_workflow(
        self,
        trigger_id: str | None,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        raise NotImplementedError

    @abstractmethod
    def link_requirement_to_workflow(self, requirement_id: str, workflow_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def unlink_requirement_from_workflow(self, requirement_id: str, workflow_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_workflow_requirement_ids(self, workflow_id: str) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def save_workflow(self, workflow: WorkflowSummary) -> WorkflowSummary:
        raise NotImplementedError

    @abstractmethod
    def list_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        raise NotImplementedError

    @abstractmethod
    def get_step(self, step_id: str) -> StepInstancePublic | None:
        raise NotImplementedError

    @abstractmethod
    def create_step(
        self,
        workflow_id: str,
        payload: StepCreate,
        orden: int,
        estado: StepStatus = StepStatus.ACTIVO,
        *,
        step_template_id: str | None = None,
        codigo: str | None = None,
        depends_on: list[str] | None = None,
    ) -> StepInstancePublic:
        raise NotImplementedError

    @abstractmethod
    def save_step(self, step: StepInstancePublic) -> StepInstancePublic:
        raise NotImplementedError

    @abstractmethod
    def add_comment(self, step_id: str, payload: CommentCreate) -> CommentPublic:
        raise NotImplementedError

    @abstractmethod
    def list_comments(self, step_id: str) -> list[CommentPublic]:
        raise NotImplementedError

    @abstractmethod
    def add_history(self, entry: StepHistoryPublic) -> StepHistoryPublic:
        raise NotImplementedError

    @abstractmethod
    def list_history(self, step_id: str) -> list[StepHistoryPublic]:
        raise NotImplementedError

    @abstractmethod
    def add_external_event(self, step_id: str, payload: ExternalEventCreate) -> ExternalEventPublic:
        raise NotImplementedError

    @abstractmethod
    def list_step_external_events(self, step_id: str) -> list[ExternalEventPublic]:
        raise NotImplementedError

    @abstractmethod
    def list_workflow_external_events(self, workflow_id: str) -> list[ExternalEventPublic]:
        raise NotImplementedError

    @abstractmethod
    def list_pending_steps(self) -> list[StepInstancePublic]:
        raise NotImplementedError

    @abstractmethod
    def list_active_workflows(self) -> list[WorkflowSummary]:
        raise NotImplementedError

    @abstractmethod
    def list_work_log_entries(self) -> list[WorkLogEntry]:
        raise NotImplementedError

    @abstractmethod
    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        raise NotImplementedError

    @abstractmethod
    def get_workflow_template(self, template_id: str) -> WorkflowTemplatePublic | None:
        raise NotImplementedError

    @abstractmethod
    def get_default_workflow_template(self) -> WorkflowTemplatePublic:
        raise NotImplementedError


class InMemoryWorkflowRepository(WorkflowRepository):
    def __init__(self) -> None:
        self._triggers: dict[str, TriggerPublic] = {}
        self._workflow_ids_by_trigger: dict[str, list[str]] = {}
        self._requirement_ids_by_workflow: dict[str, list[str]] = {}
        self._workflows: dict[str, WorkflowSummary] = {}
        self._steps: dict[str, StepInstancePublic] = {}
        self._step_ids_by_workflow: dict[str, list[str]] = {}
        self._comments_by_step: dict[str, list[CommentPublic]] = {}
        self._history_by_step: dict[str, list[StepHistoryPublic]] = {}
        self._external_events_by_step: dict[str, list[ExternalEventPublic]] = {}
        self._external_events_by_workflow: dict[str, list[ExternalEventPublic]] = {}
        self._workflow_templates: dict[str, WorkflowTemplatePublic] = {}
        self._seed_templates()

    def _seed_templates(self) -> None:
        diagnostico = StepTemplatePublic(
            id=str(uuid4()),
            codigo="diagnostico",
            depends_on=[],
            nombre="Diagnostico",
            descripcion="Analizar el disparador y definir alcance inicial.",
            orden=1,
            tipo="analisis",
            requiere_aprobacion=False,
            puede_tener_comentarios=True,
        )
        ejecucion = StepTemplatePublic(
            id=str(uuid4()),
            codigo="ejecucion",
            depends_on=["diagnostico"],
            nombre="Ejecucion",
            descripcion="Implementar o resolver la accion principal del flujo.",
            orden=2,
            tipo="ejecucion",
            requiere_aprobacion=False,
            puede_tener_comentarios=True,
        )
        verificacion = StepTemplatePublic(
            id=str(uuid4()),
            codigo="verificacion_final",
            depends_on=["ejecucion"],
            nombre="Verificacion final",
            descripcion="Confirmar resultado y cierre del caso.",
            orden=3,
            tipo="verificacion",
            requiere_aprobacion=True,
            puede_tener_comentarios=True,
        )
        template = WorkflowTemplatePublic(
            id=str(uuid4()),
            nombre="Flujo base de 3 pasos",
            descripcion="Plantilla inicial para diagnostico, ejecucion y verificacion final.",
            steps=[diagnostico, ejecucion, verificacion],
        )
        self._workflow_templates[template.id] = template

    def list_triggers(self) -> list[TriggerDetail]:
        ordered_ids = [
            trigger.id
            for trigger in sorted(self._triggers.values(), key=lambda item: item.fecha_actualizacion, reverse=True)
        ]
        items: list[TriggerDetail] = []
        for trigger_id in ordered_ids:
            trigger = self.get_trigger(trigger_id)
            if trigger is not None:
                items.append(trigger)
        return items

    def get_trigger(self, trigger_id: str) -> TriggerDetail | None:
        trigger = self._triggers.get(trigger_id)
        if trigger is None:
            return None

        workflow_ids = list(self._workflow_ids_by_trigger.get(trigger_id, []))
        workflow_ids_sorted = [
            workflow_id
            for workflow_id, _ in sorted(
                (
                    (workflow_id, self._workflows.get(workflow_id))
                    for workflow_id in workflow_ids
                ),
                key=lambda item: item[1].fecha_inicio if item[1] is not None else datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
        ]

        return TriggerDetail(
            **trigger.model_dump(exclude={"workflow_ids"}),
            workflow_ids=workflow_ids_sorted,
        )

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        now = utc_now()
        trigger = TriggerPublic(
            id=str(uuid4()),
            solicitante=payload.solicitante,
            descripcion=payload.descripcion,
            tipo=payload.tipo,
            ambito=payload.ambito,
            estado_general=TriggerStatus.SIN_FLOWS,
            fecha_creacion=now,
            fecha_actualizacion=now,
            creado_por=payload.creado_por,
            metadata=payload.metadata,
            workflow_activo_id=None,
        )
        self._triggers[trigger.id] = trigger
        self._workflow_ids_by_trigger[trigger.id] = []
        return trigger

    def delete_trigger(self, trigger_id: str) -> bool:
        trigger = self._triggers.pop(trigger_id, None)
        workflow_ids = self._workflow_ids_by_trigger.pop(trigger_id, [])
        if trigger is None:
            return False

        for workflow_id in workflow_ids:
            requirement_ids = self._requirement_ids_by_workflow.get(workflow_id, [])
            self._requirement_ids_by_workflow[workflow_id] = [item for item in requirement_ids if item != trigger_id]
            workflow = self._workflows.get(workflow_id)
            if workflow:
                next_trigger_id = workflow.trigger_id
                if workflow.trigger_id == trigger_id:
                    next_trigger_id = self._requirement_ids_by_workflow[workflow_id][0] if self._requirement_ids_by_workflow[workflow_id] else None
                self._workflows[workflow_id] = workflow.model_copy(
                    update={
                        "trigger_id": next_trigger_id,
                        "requirement_ids": list(self._requirement_ids_by_workflow[workflow_id]),
                    }
                )

        return True

    def delete_workflow(self, workflow_id: str) -> bool:
        workflow = self._workflows.pop(workflow_id, None)
        if workflow is None:
            return False

        for step_id in self._step_ids_by_workflow.pop(workflow_id, []):
            self._steps.pop(step_id, None)
            self._comments_by_step.pop(step_id, None)
            self._history_by_step.pop(step_id, None)
            self._external_events_by_step.pop(step_id, None)

        self._external_events_by_workflow.pop(workflow_id, None)

        requirement_ids = self._requirement_ids_by_workflow.pop(workflow_id, [])
        for requirement_id in requirement_ids:
            workflow_ids = self._workflow_ids_by_trigger.get(requirement_id, [])
            self._workflow_ids_by_trigger[requirement_id] = [item for item in workflow_ids if item != workflow_id]

        return True

    def save_trigger(self, trigger: TriggerPublic) -> TriggerPublic:
        normalized = TriggerPublic(**trigger.model_dump(exclude={"workflow_ids"}))
        self._triggers[trigger.id] = normalized
        return normalized

    def list_workflows(self) -> list[WorkflowSummary]:
        items: list[WorkflowSummary] = []
        for workflow in sorted(self._workflows.values(), key=lambda item: item.fecha_inicio, reverse=True):
            steps = self.list_workflow_steps(workflow.id)
            active_orders = _active_step_orders(steps)
            requirement_ids = list(self._requirement_ids_by_workflow.get(workflow.id, workflow.requirement_ids))
            primary_requirement_id = workflow.trigger_id or (requirement_ids[0] if requirement_ids else None)
            items.append(
                workflow.model_copy(
                    update={
                        "trigger_id": primary_requirement_id,
                        "requirement_ids": requirement_ids,
                        "pasos_activos": active_orders,
                        "paso_actual": active_orders[0] if active_orders else None,
                        "total_pasos": len(steps),
                    }
                )
            )
        return items

    def get_workflow(self, workflow_id: str) -> WorkflowDetail | None:
        workflow = self._workflows.get(workflow_id)
        if workflow is None:
            return None

        steps = self.list_workflow_steps(workflow_id)
        active_orders = _active_step_orders(steps)
        requirement_ids = list(self._requirement_ids_by_workflow.get(workflow.id, workflow.requirement_ids))
        primary_requirement_id = workflow.trigger_id or (requirement_ids[0] if requirement_ids else None)
        summary = workflow.model_copy(
            update={
                "trigger_id": primary_requirement_id,
                "requirement_ids": requirement_ids,
                "pasos_activos": active_orders,
                "paso_actual": active_orders[0] if active_orders else None,
                "total_pasos": len(steps),
            }
        )
        return WorkflowDetail(**summary.model_dump(exclude={"steps"}), steps=steps)

    def create_workflow(
        self,
        trigger_id: str | None,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        now = utc_now()
        first_step_override = getattr(payload, "primer_paso", None)
        first_step_name = _resolve_first_step_name(payload)
        workflow = WorkflowSummary(
            id=str(uuid4()),
            trigger_id=trigger_id,
            requirement_ids=[trigger_id] if trigger_id else [],
            workflow_template_id=template.id,
            workflow_template_nombre=template.nombre,
            estado=WorkflowStatus.EN_PROCESO,
            pasos_activos=[1],
            paso_actual=1,
            total_pasos=1,
            fecha_inicio=now,
            fecha_fin=None,
            objetivo_final=payload.objetivo_final,
            resolucion_esperada=payload.resolucion_esperada,
            ambito=payload.ambito,
        )
        self._workflows[workflow.id] = workflow
        self._step_ids_by_workflow[workflow.id] = []
        self._requirement_ids_by_workflow[workflow.id] = [trigger_id] if trigger_id else []
        if trigger_id:
            self._workflow_ids_by_trigger.setdefault(trigger_id, []).append(workflow.id)

        step = StepInstancePublic(
            id=str(uuid4()),
            workflow_id=workflow.id,
            step_template_id=None,
            codigo=None,
            depends_on=[],
            nombre=first_step_name,
            descripcion=first_step_override.descripcion if first_step_override else None,
            orden=1,
            tipo="manual",
            requiere_aprobacion=False,
            puede_tener_comentarios=True,
            action_type="continue",
            action_config=None,
            action_label="Continuar flow",
            waits_for_external_response=False,
            expected_external_event=None,
            external_wait_reason=None,
            external_reference=None,
            estado=StepStatus.ACTIVO,
            fecha_estado_actual=now,
            asignado_a=first_step_override.asignado_a if first_step_override else None,
            fecha_creacion=now,
            fecha_inicio=now,
            fecha_vencimiento=first_step_override.fecha_vencimiento if first_step_override else None,
            fecha_ejecucion_estimada=first_step_override.fecha_ejecucion_estimada if first_step_override else None,
            fecha_cierre=None,
            resultado=None,
            observaciones=None,
            ambito=workflow.ambito,
        )
        self._steps[step.id] = step
        self._step_ids_by_workflow[workflow.id].append(step.id)
        self._comments_by_step[step.id] = []
        self._history_by_step[step.id] = []
        self._external_events_by_step[step.id] = []
        self._external_events_by_workflow.setdefault(workflow.id, [])

        return self.get_workflow(workflow.id)  # type: ignore[return-value]

    def save_workflow(self, workflow: WorkflowSummary) -> WorkflowSummary:
        normalized = WorkflowSummary(**workflow.model_dump(exclude={"steps"}))
        self._workflows[workflow.id] = normalized
        self._requirement_ids_by_workflow[workflow.id] = list(workflow.requirement_ids)
        if workflow.trigger_id and workflow.trigger_id not in self._requirement_ids_by_workflow[workflow.id]:
            self._requirement_ids_by_workflow[workflow.id].append(workflow.trigger_id)
        return normalized

    def link_requirement_to_workflow(self, requirement_id: str, workflow_id: str) -> None:
        requirement_ids = self._requirement_ids_by_workflow.setdefault(workflow_id, [])
        if requirement_id not in requirement_ids:
            requirement_ids.append(requirement_id)
        workflow_ids = self._workflow_ids_by_trigger.setdefault(requirement_id, [])
        if workflow_id not in workflow_ids:
            workflow_ids.append(workflow_id)
        workflow = self._workflows.get(workflow_id)
        if workflow and not workflow.trigger_id:
            self._workflows[workflow_id] = workflow.model_copy(update={"trigger_id": requirement_id, "requirement_ids": requirement_ids})

    def unlink_requirement_from_workflow(self, requirement_id: str, workflow_id: str) -> None:
        requirement_ids = self._requirement_ids_by_workflow.get(workflow_id, [])
        self._requirement_ids_by_workflow[workflow_id] = [item for item in requirement_ids if item != requirement_id]
        workflow_ids = self._workflow_ids_by_trigger.get(requirement_id, [])
        self._workflow_ids_by_trigger[requirement_id] = [item for item in workflow_ids if item != workflow_id]
        workflow = self._workflows.get(workflow_id)
        if workflow:
            next_trigger_id = workflow.trigger_id
            if workflow.trigger_id == requirement_id:
                next_trigger_id = self._requirement_ids_by_workflow[workflow_id][0] if self._requirement_ids_by_workflow[workflow_id] else None
            self._workflows[workflow_id] = workflow.model_copy(
                update={"trigger_id": next_trigger_id, "requirement_ids": list(self._requirement_ids_by_workflow[workflow_id])}
            )

    def list_workflow_requirement_ids(self, workflow_id: str) -> list[str]:
        return list(self._requirement_ids_by_workflow.get(workflow_id, []))

    def list_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        step_ids = self._step_ids_by_workflow.get(workflow_id, [])
        steps = [self._enrich_step(self._steps[step_id]) for step_id in step_ids]
        return _sort_step_instances(steps)

    def get_step(self, step_id: str) -> StepInstancePublic | None:
        step = self._steps.get(step_id)
        if step is None:
            return None
        return self._enrich_step(step)

    def create_step(
        self,
        workflow_id: str,
        payload: StepCreate,
        orden: int,
        estado: StepStatus = StepStatus.ACTIVO,
        *,
        step_template_id: str | None = None,
        codigo: str | None = None,
        depends_on: list[str] | None = None,
    ) -> StepInstancePublic:
        now = utc_now()
        step = StepInstancePublic(
            id=str(uuid4()),
            workflow_id=workflow_id,
            step_template_id=step_template_id,
            codigo=codigo,
            depends_on=list(depends_on or []),
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            orden=orden,
            tipo=payload.tipo,
            requiere_aprobacion=payload.requiere_aprobacion,
            puede_tener_comentarios=payload.puede_tener_comentarios,
            action_type=payload.action_type,
            action_config=payload.action_config,
            action_label=payload.action_label,
            waits_for_external_response=payload.waits_for_external_response,
            expected_external_event=payload.expected_external_event,
            external_wait_reason=payload.external_wait_reason,
            external_reference=payload.external_reference,
            estado=estado,
            fecha_estado_actual=now,
            asignado_a=payload.asignado_a,
            fecha_creacion=now,
            fecha_inicio=now if estado == StepStatus.ACTIVO else None,
            fecha_vencimiento=payload.fecha_vencimiento,
            fecha_ejecucion_estimada=payload.fecha_ejecucion_estimada,
            fecha_cierre=None,
            resultado=None,
            observaciones=None,
            ambito=self._workflows[workflow_id].ambito,
        )
        self._steps[step.id] = step
        self._step_ids_by_workflow.setdefault(workflow_id, []).append(step.id)
        self._comments_by_step[step.id] = []
        self._history_by_step[step.id] = []
        self._external_events_by_step[step.id] = []
        self._external_events_by_workflow.setdefault(workflow_id, [])
        return step

    def save_step(self, step: StepInstancePublic) -> StepInstancePublic:
        self._steps[step.id] = step
        return step

    def add_comment(self, step_id: str, payload: CommentCreate) -> CommentPublic:
        comment = CommentPublic(
            id=str(uuid4()),
            step_instance_id=step_id,
            autor=payload.autor,
            comentario=payload.comentario,
            fecha_creacion=utc_now(),
            attachments=self._materialize_attachments(payload.attachments),
        )
        self._comments_by_step.setdefault(step_id, []).append(comment)
        return comment

    def list_comments(self, step_id: str) -> list[CommentPublic]:
        return list(self._comments_by_step.get(step_id, []))

    def add_history(self, entry: StepHistoryPublic) -> StepHistoryPublic:
        self._history_by_step.setdefault(entry.step_instance_id, []).append(entry)
        return entry

    def list_history(self, step_id: str) -> list[StepHistoryPublic]:
        return list(self._history_by_step.get(step_id, []))

    def add_external_event(self, step_id: str, payload: ExternalEventCreate) -> ExternalEventPublic:
        step = self._steps.get(step_id)
        if step is None:
            raise ValueError(f"Step {step_id} not found")

        event = ExternalEventPublic(
            id=str(uuid4()),
            workflow_id=step.workflow_id,
            step_id=step_id,
            event_type=payload.event_type,
            source=payload.source,
            payload=payload.payload,
            comentario=payload.comentario,
            attachments=self._materialize_attachments(payload.attachments),
            fecha_creacion=utc_now(),
            registrado_por=payload.registrado_por,
        )
        self._external_events_by_step.setdefault(step_id, []).append(event)
        self._external_events_by_workflow.setdefault(step.workflow_id, []).append(event)
        return event

    def list_step_external_events(self, step_id: str) -> list[ExternalEventPublic]:
        return list(self._external_events_by_step.get(step_id, []))

    def list_workflow_external_events(self, workflow_id: str) -> list[ExternalEventPublic]:
        return list(self._external_events_by_workflow.get(workflow_id, []))

    def list_pending_steps(self) -> list[StepInstancePublic]:
        steps = [step for step in self._steps.values() if step.estado in OPEN_STEP_STATUSES]
        return sorted(steps, key=lambda item: (item.estado != StepStatus.ACTIVO, item.workflow_id, item.orden))

    def list_active_workflows(self) -> list[WorkflowSummary]:
        return [
            workflow
            for workflow in self.list_workflows()
            if workflow.estado
            in {
                WorkflowStatus.PENDIENTE,
                WorkflowStatus.EN_PROCESO,
                WorkflowStatus.ESPERANDO_RESPUESTA,
                WorkflowStatus.EN_ESPERA,
                WorkflowStatus.CON_PROBLEMA,
            }
        ]

    def list_work_log_entries(self) -> list[WorkLogEntry]:
        entries: list[WorkLogEntry] = []

        for step in self._steps.values():
            workflow = self._workflows.get(step.workflow_id)
            if workflow is None:
                continue

            requirement_ids = list(self._requirement_ids_by_workflow.get(workflow.id, workflow.requirement_ids))
            primary_requirement_id = workflow.trigger_id or (requirement_ids[0] if requirement_ids else None)
            primary_requirement = self._triggers.get(primary_requirement_id) if primary_requirement_id else None
            requirement_title = _clean_text(primary_requirement.descripcion) if primary_requirement else None
            workflow_title = _format_workflow_title(workflow.objetivo_final, workflow.id)

            comments = self._comments_by_step.get(step.id, [])
            history_entries = self._history_by_step.get(step.id, [])
            external_events = self._external_events_by_step.get(step.id, [])

            for comment in comments:
                text = _clean_text(comment.comentario)
                if text and _is_noisy_automatic_journal_text(text):
                    continue
                summary = text or _attachment_summary(comment.attachments)
                if not summary:
                    continue
                entries.append(
                    WorkLogEntry(
                        id=f"comment:{comment.id}",
                        timestamp=comment.fecha_creacion,
                        entry_type=WorkLogEntryType.COMMENT,
                        summary=summary,
                        author=comment.autor,
                        step_id=step.id,
                        step_name=step.nombre,
                        step_order=step.orden,
                        workflow_id=workflow.id,
                        workflow_title=workflow_title,
                        requirement_id=primary_requirement_id,
                        requirement_title=requirement_title,
                        attachments_count=len(comment.attachments),
                    )
                )

            for entry in history_entries:
                summary = _format_history_summary(entry)
                if _is_noisy_automatic_journal_text(summary):
                    continue
                entries.append(
                    WorkLogEntry(
                        id=f"history:{entry.id}",
                        timestamp=entry.fecha,
                        entry_type=WorkLogEntryType.STATUS_CHANGE if entry.campo == "estado" else WorkLogEntryType.FIELD_CHANGE,
                        summary=summary,
                        author=entry.usuario,
                        step_id=step.id,
                        step_name=step.nombre,
                        step_order=step.orden,
                        workflow_id=workflow.id,
                        workflow_title=workflow_title,
                        requirement_id=primary_requirement_id,
                        requirement_title=requirement_title,
                        attachments_count=len(entry.attachments),
                    )
                )

            for event in external_events:
                text = _clean_text(event.comentario)
                summary = text or f"Evento externo: {event.event_type}"
                if _is_noisy_automatic_journal_text(summary):
                    continue
                entries.append(
                    WorkLogEntry(
                        id=f"external:{event.id}",
                        timestamp=event.fecha_creacion,
                        entry_type=WorkLogEntryType.EXTERNAL_EVENT,
                        summary=summary,
                        author=event.registrado_por,
                        step_id=step.id,
                        step_name=step.nombre,
                        step_order=step.orden,
                        workflow_id=workflow.id,
                        workflow_title=workflow_title,
                        requirement_id=primary_requirement_id,
                        requirement_title=requirement_title,
                        attachments_count=len(event.attachments),
                    )
                )

        return sorted(entries, key=lambda item: item.timestamp, reverse=True)

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        return list(self._workflow_templates.values())

    def get_workflow_template(self, template_id: str) -> WorkflowTemplatePublic | None:
        return self._workflow_templates.get(template_id)

    def get_default_workflow_template(self) -> WorkflowTemplatePublic:
        return next(iter(self._workflow_templates.values()))

    def _enrich_step(self, step: StepInstancePublic) -> StepInstancePublic:
        comments = self._comments_by_step.get(step.id, [])
        history_entries = self._history_by_step.get(step.id, [])

        latest_snapshot = self._empty_latest_snapshot()
        for comment in reversed(comments):
            snapshot = self._build_latest_snapshot_from_comment(comment)
            if snapshot["timestamp"]:
                latest_snapshot = snapshot
                break

        for entry in reversed(history_entries):
            snapshot = self._build_latest_snapshot_from_history(entry)
            if not snapshot["timestamp"]:
                continue
            if latest_snapshot["timestamp"] is None or snapshot["timestamp"] > latest_snapshot["timestamp"]:
                latest_snapshot = snapshot
            break

        return step.model_copy(
            update={
                "ultimo_comentario": latest_snapshot["text"],
                "ultimo_comentario_fecha": latest_snapshot["timestamp"],
                "ultimo_comentario_tipo": latest_snapshot["kind"],
                "ultimo_comentario_adjunto_nombre": latest_snapshot["attachment_name"],
                "ultimo_comentario_adjunto_content_type": latest_snapshot["attachment_content_type"],
            }
        )

    def _build_latest_snapshot_from_comment(self, comment: CommentPublic | None) -> dict[str, object | None]:
        if comment is None:
            return self._empty_latest_snapshot()

        text = (comment.comentario or "").strip()
        if text and not _is_noisy_automatic_journal_text(text):
            return {
                "text": text,
                "kind": "texto",
                "attachment_name": None,
                "attachment_content_type": None,
                "timestamp": comment.fecha_creacion,
            }

        if comment.attachments:
            attachment = comment.attachments[0]
            return {
                "text": "Imagen adjunta" if attachment.content_type.startswith("image/") else "Archivo adjunto",
                "kind": "imagen" if attachment.content_type.startswith("image/") else "adjunto",
                "attachment_name": attachment.nombre,
                "attachment_content_type": attachment.content_type,
                "timestamp": comment.fecha_creacion,
            }

        return self._empty_latest_snapshot()

    def _build_latest_snapshot_from_history(self, entry: StepHistoryPublic | None) -> dict[str, object | None]:
        if entry is None:
            return self._empty_latest_snapshot()

        text = (entry.nota or "").strip()
        if text and not _is_noisy_automatic_journal_text(text):
            return {
                "text": text,
                "kind": "texto",
                "attachment_name": None,
                "attachment_content_type": None,
                "timestamp": entry.fecha,
            }

        if entry.attachments:
            attachment = entry.attachments[0]
            return {
                "text": "Imagen adjunta" if attachment.content_type.startswith("image/") else "Archivo adjunto",
                "kind": "imagen" if attachment.content_type.startswith("image/") else "adjunto",
                "attachment_name": attachment.nombre,
                "attachment_content_type": attachment.content_type,
                "timestamp": entry.fecha,
            }

        return self._empty_latest_snapshot()

    def _empty_latest_snapshot(self) -> dict[str, object | None]:
        return {
            "text": None,
            "kind": None,
            "attachment_name": None,
            "attachment_content_type": None,
            "timestamp": None,
        }

    def _materialize_attachments(self, attachments: list[AttachmentBase]) -> list[AttachmentPublic]:
        return [
            AttachmentPublic(
                id=str(uuid4()),
                nombre=item.nombre,
                content_type=item.content_type,
                size_bytes=item.size_bytes,
                content_base64=item.content_base64,
            )
            for item in attachments
        ]


class PostgresWorkflowRepository(WorkflowRepository):
    def list_triggers(self) -> list[TriggerDetail]:
        with session_scope() as session:
            triggers = session.scalars(
                select(TriggerModel)
                .options(selectinload(TriggerModel.workflows))
                .order_by(TriggerModel.fecha_actualizacion.desc())
            ).all()
            return [self._trigger_to_detail(trigger) for trigger in triggers]

    def get_trigger(self, trigger_id: str) -> TriggerDetail | None:
        with session_scope() as session:
            trigger = session.scalar(
                select(TriggerModel)
                .options(selectinload(TriggerModel.workflows))
                .where(TriggerModel.id == trigger_id)
            )
            if trigger is None:
                return None
            return self._trigger_to_detail(trigger)

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        now = utc_now()
        trigger = TriggerModel(
            id=str(uuid4()),
            solicitante=payload.solicitante,
            descripcion=payload.descripcion,
            tipo=payload.tipo,
            ambito=payload.ambito.value if payload.ambito else None,
            estado_general=TriggerStatus.SIN_FLOWS.value,
            fecha_creacion=now,
            fecha_actualizacion=now,
            creado_por=payload.creado_por,
            metadata_payload=payload.metadata,
            workflow_activo_id=None,
        )
        with session_scope() as session:
            session.add(trigger)
            session.flush()
            session.refresh(trigger)
            return self._trigger_to_public(trigger)

    def delete_trigger(self, trigger_id: str) -> bool:
        with session_scope() as session:
            trigger = session.get(TriggerModel, trigger_id)
            if trigger is None:
                return False
            session.delete(trigger)
            session.flush()
            return True

    def delete_workflow(self, workflow_id: str) -> bool:
        with session_scope() as session:
            workflow = session.get(WorkflowModel, workflow_id)
            if workflow is None:
                return False
            session.delete(workflow)
            session.flush()
            return True

    def save_trigger(self, trigger: TriggerPublic) -> TriggerPublic:
        with session_scope() as session:
            existing = session.get(TriggerModel, trigger.id)
            if existing is None:
                existing = TriggerModel(id=trigger.id, tipo=trigger.tipo, estado_general=trigger.estado_general.value, fecha_creacion=trigger.fecha_creacion, fecha_actualizacion=trigger.fecha_actualizacion, creado_por=trigger.creado_por)
                session.add(existing)

            existing.solicitante = trigger.solicitante
            existing.descripcion = trigger.descripcion
            existing.tipo = trigger.tipo
            existing.metadata_payload = trigger.metadata
            existing.ambito = trigger.ambito.value if trigger.ambito else None
            existing.estado_general = trigger.estado_general.value
            existing.fecha_creacion = trigger.fecha_creacion
            existing.fecha_actualizacion = trigger.fecha_actualizacion
            existing.creado_por = trigger.creado_por
            existing.workflow_activo_id = trigger.workflow_activo_id

            session.flush()
            session.refresh(existing)
            return self._trigger_to_public(existing)

    def list_workflows(self) -> list[WorkflowSummary]:
        with session_scope() as session:
            workflows = session.scalars(
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.steps), selectinload(WorkflowModel.requirements))
                .order_by(WorkflowModel.fecha_inicio.desc())
            ).all()
            return [self._workflow_to_summary(workflow) for workflow in workflows]

    def get_workflow(self, workflow_id: str) -> WorkflowDetail | None:
        with session_scope() as session:
            workflow = session.scalar(
                select(WorkflowModel)
                .options(
                    selectinload(WorkflowModel.requirements),
                    selectinload(WorkflowModel.steps).selectinload(StepModel.comments),
                    selectinload(WorkflowModel.steps).selectinload(StepModel.history_entries),
                )
                .where(WorkflowModel.id == workflow_id)
            )
            if workflow is None:
                return None
            return self._workflow_to_detail(workflow)

    def create_workflow(
        self,
        trigger_id: str | None,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        now = utc_now()
        first_step_override = getattr(payload, "primer_paso", None)
        first_step_name = _resolve_first_step_name(payload)
        workflow = WorkflowModel(
            id=str(uuid4()),
            trigger_id=trigger_id,
            workflow_template_id=template.id,
            workflow_template_nombre=template.nombre,
            estado=WorkflowStatus.EN_PROCESO.value,
            paso_actual=1,
            total_pasos=1,
            fecha_inicio=now,
            fecha_fin=None,
            objetivo_final=payload.objetivo_final,
            resolucion_esperada=payload.resolucion_esperada,
            ambito=payload.ambito.value if payload.ambito else None,
        )

        workflow.steps.append(
            StepModel(
                id=str(uuid4()),
                step_template_id=None,
                codigo=None,
                depends_on=[],
                nombre=first_step_name,
                descripcion=first_step_override.descripcion if first_step_override else None,
                orden=1,
                tipo="manual",
                requiere_aprobacion=False,
                puede_tener_comentarios=True,
                action_type="continue",
                action_config=None,
                action_label="Continuar flow",
                waits_for_external_response=False,
                expected_external_event=None,
                external_wait_reason=None,
                external_reference=None,
                estado=StepStatus.ACTIVO.value,
                fecha_estado_actual=now,
                asignado_a=first_step_override.asignado_a if first_step_override else None,
                fecha_creacion=now,
                fecha_inicio=now,
                fecha_vencimiento=first_step_override.fecha_vencimiento if first_step_override else None,
                fecha_ejecucion_estimada=first_step_override.fecha_ejecucion_estimada if first_step_override else None,
                fecha_cierre=None,
                resultado=None,
                observaciones=None,
                ambito=payload.ambito.value if payload.ambito else None,
            )
        )

        with session_scope() as session:
            session.add(workflow)
            session.flush()
            if trigger_id:
                session.merge(
                    RequirementFlowLinkModel(
                        requirement_id=trigger_id,
                        workflow_id=workflow.id,
                        fecha_vinculacion=now,
                    )
                )
            workflow = session.scalar(
                select(WorkflowModel)
                .options(
                    selectinload(WorkflowModel.requirements),
                    selectinload(WorkflowModel.steps).selectinload(StepModel.comments),
                    selectinload(WorkflowModel.steps).selectinload(StepModel.history_entries),
                )
                .where(WorkflowModel.id == workflow.id)
            )
            return self._workflow_to_detail(workflow)  # type: ignore[arg-type]

    def link_requirement_to_workflow(self, requirement_id: str, workflow_id: str) -> None:
        with session_scope() as session:
            link = session.get(RequirementFlowLinkModel, {"requirement_id": requirement_id, "workflow_id": workflow_id})
            if link is None:
                session.add(
                    RequirementFlowLinkModel(
                        requirement_id=requirement_id,
                        workflow_id=workflow_id,
                        fecha_vinculacion=utc_now(),
                    )
                )

            workflow = session.get(WorkflowModel, workflow_id)
            if workflow and not workflow.trigger_id:
                workflow.trigger_id = requirement_id
            session.flush()

    def unlink_requirement_from_workflow(self, requirement_id: str, workflow_id: str) -> None:
        with session_scope() as session:
            link = session.get(RequirementFlowLinkModel, {"requirement_id": requirement_id, "workflow_id": workflow_id})
            if link is not None:
                session.delete(link)
                session.flush()

            workflow = session.get(WorkflowModel, workflow_id)
            if workflow and workflow.trigger_id == requirement_id:
                next_requirement_id = session.scalar(
                    select(RequirementFlowLinkModel.requirement_id)
                    .where(RequirementFlowLinkModel.workflow_id == workflow_id)
                    .order_by(RequirementFlowLinkModel.fecha_vinculacion.asc())
                )
                workflow.trigger_id = next_requirement_id
            session.flush()

    def list_workflow_requirement_ids(self, workflow_id: str) -> list[str]:
        with session_scope() as session:
            ids = session.scalars(
                select(RequirementFlowLinkModel.requirement_id)
                .where(RequirementFlowLinkModel.workflow_id == workflow_id)
                .order_by(RequirementFlowLinkModel.fecha_vinculacion.asc())
            ).all()
            return list(ids)

    def save_workflow(self, workflow: WorkflowSummary) -> WorkflowSummary:
        with session_scope() as session:
            existing = session.get(WorkflowModel, workflow.id)
            if existing is None:
                raise ValueError(f"Workflow {workflow.id} not found")

            existing.trigger_id = workflow.trigger_id
            existing.workflow_template_id = workflow.workflow_template_id
            existing.workflow_template_nombre = workflow.workflow_template_nombre
            existing.estado = workflow.estado.value
            existing.paso_actual = workflow.paso_actual
            existing.total_pasos = workflow.total_pasos
            existing.fecha_inicio = workflow.fecha_inicio
            existing.fecha_fin = workflow.fecha_fin
            existing.objetivo_final = workflow.objetivo_final
            existing.resolucion_esperada = workflow.resolucion_esperada
            existing.ambito = workflow.ambito.value if workflow.ambito else None

            session.flush()
            session.refresh(existing)
            return self._workflow_to_summary(existing)

    def list_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        with session_scope() as session:
            steps = session.scalars(
                select(StepModel)
                .options(selectinload(StepModel.comments), selectinload(StepModel.history_entries))
                .where(StepModel.workflow_id == workflow_id)
                .order_by(StepModel.orden.asc(), StepModel.codigo.asc(), StepModel.id.asc())
            ).all()
            return [self._step_to_public(step) for step in steps]

    def get_step(self, step_id: str) -> StepInstancePublic | None:
        with session_scope() as session:
            step = session.scalar(
                select(StepModel)
                .options(selectinload(StepModel.comments), selectinload(StepModel.history_entries))
                .where(StepModel.id == step_id)
            )
            if step is None:
                return None
            return self._step_to_public(step)

    def create_step(
        self,
        workflow_id: str,
        payload: StepCreate,
        orden: int,
        estado: StepStatus = StepStatus.ACTIVO,
        *,
        step_template_id: str | None = None,
        codigo: str | None = None,
        depends_on: list[str] | None = None,
    ) -> StepInstancePublic:
        now = utc_now()
        workflow = self.get_workflow(workflow_id)
        step = StepModel(
            id=str(uuid4()),
            workflow_id=workflow_id,
            step_template_id=step_template_id,
            codigo=codigo,
            depends_on=list(depends_on or []),
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            orden=orden,
            tipo=payload.tipo,
            requiere_aprobacion=payload.requiere_aprobacion,
            puede_tener_comentarios=payload.puede_tener_comentarios,
            action_type=payload.action_type,
            action_config=payload.action_config,
            action_label=payload.action_label,
            waits_for_external_response=payload.waits_for_external_response,
            expected_external_event=payload.expected_external_event,
            external_wait_reason=payload.external_wait_reason,
            external_reference=payload.external_reference,
            estado=estado.value,
            fecha_estado_actual=now,
            asignado_a=payload.asignado_a,
            fecha_creacion=now,
            fecha_inicio=now if estado == StepStatus.ACTIVO else None,
            fecha_vencimiento=payload.fecha_vencimiento,
            fecha_ejecucion_estimada=payload.fecha_ejecucion_estimada,
            fecha_cierre=None,
            resultado=None,
            observaciones=None,
            ambito=workflow.ambito.value if workflow and workflow.ambito else None,
        )
        with session_scope() as session:
            session.add(step)
            session.flush()
            step = session.scalar(
                select(StepModel)
                .options(selectinload(StepModel.comments), selectinload(StepModel.history_entries))
                .where(StepModel.id == step.id)
            )
            return self._step_to_public(step)  # type: ignore[arg-type]

    def save_step(self, step: StepInstancePublic) -> StepInstancePublic:
        with session_scope() as session:
            existing = session.get(StepModel, step.id)
            if existing is None:
                raise ValueError(f"Step {step.id} not found")

            existing.workflow_id = step.workflow_id
            existing.step_template_id = step.step_template_id
            existing.codigo = step.codigo
            existing.depends_on = list(step.depends_on)
            existing.nombre = step.nombre
            existing.descripcion = step.descripcion
            existing.orden = step.orden
            existing.tipo = step.tipo
            existing.requiere_aprobacion = step.requiere_aprobacion
            existing.puede_tener_comentarios = step.puede_tener_comentarios
            existing.action_type = step.action_type
            existing.action_config = step.action_config
            existing.action_label = step.action_label
            existing.waits_for_external_response = step.waits_for_external_response
            existing.expected_external_event = step.expected_external_event
            existing.external_wait_reason = step.external_wait_reason
            existing.external_reference = step.external_reference
            existing.estado = step.estado.value
            existing.fecha_estado_actual = step.fecha_estado_actual
            existing.asignado_a = step.asignado_a
            existing.fecha_creacion = step.fecha_creacion
            existing.fecha_inicio = step.fecha_inicio
            existing.fecha_vencimiento = step.fecha_vencimiento
            existing.fecha_ejecucion_estimada = step.fecha_ejecucion_estimada
            existing.fecha_cierre = step.fecha_cierre
            existing.resultado = step.resultado
            existing.observaciones = step.observaciones
            existing.ambito = step.ambito.value if step.ambito else None

            session.flush()
            step_with_relations = session.scalar(
                select(StepModel)
                .options(selectinload(StepModel.comments), selectinload(StepModel.history_entries))
                .where(StepModel.id == step.id)
            )
            return self._step_to_public(step_with_relations)  # type: ignore[arg-type]

    def add_comment(self, step_id: str, payload: CommentCreate) -> CommentPublic:
        comment = CommentModel(
            id=str(uuid4()),
            step_instance_id=step_id,
            autor=payload.autor,
            comentario=payload.comentario,
            fecha_creacion=utc_now(),
            attachments=[
                {
                    "id": str(uuid4()),
                    "nombre": item.nombre,
                    "content_type": item.content_type,
                    "size_bytes": item.size_bytes,
                    "content_base64": item.content_base64,
                }
                for item in payload.attachments
            ],
        )
        with session_scope() as session:
            session.add(comment)
            session.flush()
            session.refresh(comment)
            return self._comment_to_public(comment)

    def list_comments(self, step_id: str) -> list[CommentPublic]:
        with session_scope() as session:
            comments = session.scalars(
                select(CommentModel)
                .where(CommentModel.step_instance_id == step_id)
                .order_by(CommentModel.fecha_creacion.asc())
            ).all()
            return [self._comment_to_public(comment) for comment in comments]

    def add_history(self, entry: StepHistoryPublic) -> StepHistoryPublic:
        history = StepHistoryModel(
            id=entry.id,
            step_instance_id=entry.step_instance_id,
            campo=entry.campo,
            valor_anterior=entry.valor_anterior,
            valor_nuevo=entry.valor_nuevo,
            usuario=entry.usuario,
            fecha=entry.fecha,
            nota=entry.nota,
            attachments=[item.model_dump() for item in entry.attachments],
        )
        with session_scope() as session:
            session.add(history)
            session.flush()
            session.refresh(history)
            return self._history_to_public(history)

    def list_history(self, step_id: str) -> list[StepHistoryPublic]:
        with session_scope() as session:
            entries = session.scalars(
                select(StepHistoryModel)
                .where(StepHistoryModel.step_instance_id == step_id)
                .order_by(StepHistoryModel.fecha.asc())
            ).all()
            return [self._history_to_public(entry) for entry in entries]

    def add_external_event(self, step_id: str, payload: ExternalEventCreate) -> ExternalEventPublic:
        with session_scope() as session:
            step = session.get(StepModel, step_id)
            if step is None:
                raise ValueError(f"Step {step_id} not found")

            event = ExternalEventModel(
                id=str(uuid4()),
                workflow_id=step.workflow_id,
                step_id=step_id,
                event_type=payload.event_type,
                source=payload.source,
                payload=payload.payload,
                comentario=payload.comentario,
                attachments=[
                    {
                        "id": str(uuid4()),
                        "nombre": item.nombre,
                        "content_type": item.content_type,
                        "size_bytes": item.size_bytes,
                        "content_base64": item.content_base64,
                    }
                    for item in payload.attachments
                ],
                fecha_creacion=utc_now(),
                registrado_por=payload.registrado_por,
            )
            session.add(event)
            session.flush()
            session.refresh(event)
            return self._external_event_to_public(event)

    def list_step_external_events(self, step_id: str) -> list[ExternalEventPublic]:
        with session_scope() as session:
            events = session.scalars(
                select(ExternalEventModel)
                .where(ExternalEventModel.step_id == step_id)
                .order_by(ExternalEventModel.fecha_creacion.asc())
            ).all()
            return [self._external_event_to_public(item) for item in events]

    def list_workflow_external_events(self, workflow_id: str) -> list[ExternalEventPublic]:
        with session_scope() as session:
            events = session.scalars(
                select(ExternalEventModel)
                .where(ExternalEventModel.workflow_id == workflow_id)
                .order_by(ExternalEventModel.fecha_creacion.asc())
            ).all()
            return [self._external_event_to_public(item) for item in events]

    def list_pending_steps(self) -> list[StepInstancePublic]:
        with session_scope() as session:
            steps = session.scalars(
                select(StepModel)
                .options(selectinload(StepModel.comments), selectinload(StepModel.history_entries))
                .where(StepModel.estado.in_([status.value for status in OPEN_STEP_STATUSES]))
                .order_by(StepModel.estado != StepStatus.ACTIVO.value, StepModel.workflow_id.asc(), StepModel.orden.asc())
            ).all()
            return [self._step_to_public(step) for step in steps]

    def list_active_workflows(self) -> list[WorkflowSummary]:
        with session_scope() as session:
            workflows = session.scalars(
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.steps), selectinload(WorkflowModel.requirements))
                .where(
                    WorkflowModel.estado.in_(
                        [
                            WorkflowStatus.PENDIENTE.value,
                            WorkflowStatus.EN_PROCESO.value,
                            WorkflowStatus.ESPERANDO_RESPUESTA.value,
                            WorkflowStatus.EN_ESPERA.value,
                            WorkflowStatus.CON_PROBLEMA.value,
                        ]
                    )
                )
                .order_by(WorkflowModel.fecha_inicio.desc())
            ).all()
            return [self._workflow_to_summary(workflow) for workflow in workflows]

    def list_work_log_entries(self) -> list[WorkLogEntry]:
        with session_scope() as session:
            steps = session.scalars(
                select(StepModel)
                .options(
                    selectinload(StepModel.comments),
                    selectinload(StepModel.history_entries),
                    selectinload(StepModel.external_events),
                    selectinload(StepModel.workflow).selectinload(WorkflowModel.requirements),
                )
            ).all()

            entries: list[WorkLogEntry] = []
            for step in steps:
                workflow = step.workflow
                if workflow is None:
                    continue

                sorted_requirements = sorted(workflow.requirements, key=lambda requirement: requirement.fecha_creacion)
                requirement_ids = [requirement.id for requirement in sorted_requirements]
                primary_requirement_id = workflow.trigger_id or (requirement_ids[0] if requirement_ids else None)
                requirement_descriptions = {
                    requirement.id: _clean_text(requirement.descripcion)
                    for requirement in sorted_requirements
                }
                requirement_title = (
                    requirement_descriptions.get(primary_requirement_id)
                    if primary_requirement_id
                    else None
                )
                workflow_title = _format_workflow_title(workflow.objetivo_final, workflow.id)

                comments = [self._comment_to_public(comment) for comment in step.comments]
                history_entries = [self._history_to_public(entry) for entry in step.history_entries]
                external_events = [self._external_event_to_public(event) for event in step.external_events]

                for comment in comments:
                    text = _clean_text(comment.comentario)
                    if text and _is_noisy_automatic_journal_text(text):
                        continue
                    summary = text or _attachment_summary(comment.attachments)
                    if not summary:
                        continue
                    entries.append(
                        WorkLogEntry(
                            id=f"comment:{comment.id}",
                            timestamp=comment.fecha_creacion,
                            entry_type=WorkLogEntryType.COMMENT,
                            summary=summary,
                            author=comment.autor,
                            step_id=step.id,
                            step_name=step.nombre,
                            step_order=step.orden,
                            workflow_id=workflow.id,
                            workflow_title=workflow_title,
                            requirement_id=primary_requirement_id,
                            requirement_title=requirement_title,
                            attachments_count=len(comment.attachments),
                        )
                    )

                for entry in history_entries:
                    summary = _format_history_summary(entry)
                    if _is_noisy_automatic_journal_text(summary):
                        continue
                    entries.append(
                        WorkLogEntry(
                            id=f"history:{entry.id}",
                            timestamp=entry.fecha,
                            entry_type=WorkLogEntryType.STATUS_CHANGE if entry.campo == "estado" else WorkLogEntryType.FIELD_CHANGE,
                            summary=summary,
                            author=entry.usuario,
                            step_id=step.id,
                            step_name=step.nombre,
                            step_order=step.orden,
                            workflow_id=workflow.id,
                            workflow_title=workflow_title,
                            requirement_id=primary_requirement_id,
                            requirement_title=requirement_title,
                            attachments_count=len(entry.attachments),
                        )
                    )

                for event in external_events:
                    text = _clean_text(event.comentario)
                    summary = text or f"Evento externo: {event.event_type}"
                    if _is_noisy_automatic_journal_text(summary):
                        continue
                    entries.append(
                        WorkLogEntry(
                            id=f"external:{event.id}",
                            timestamp=event.fecha_creacion,
                            entry_type=WorkLogEntryType.EXTERNAL_EVENT,
                            summary=summary,
                            author=event.registrado_por,
                            step_id=step.id,
                            step_name=step.nombre,
                            step_order=step.orden,
                            workflow_id=workflow.id,
                            workflow_title=workflow_title,
                            requirement_id=primary_requirement_id,
                            requirement_title=requirement_title,
                            attachments_count=len(event.attachments),
                        )
                    )

            return sorted(entries, key=lambda item: item.timestamp, reverse=True)

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        with session_scope() as session:
            templates = session.scalars(
                select(WorkflowTemplateModel)
                .options(selectinload(WorkflowTemplateModel.steps))
                .order_by(WorkflowTemplateModel.nombre.asc())
            ).all()
            return [self._template_to_public(template) for template in templates]

    def get_workflow_template(self, template_id: str) -> WorkflowTemplatePublic | None:
        with session_scope() as session:
            template = session.scalar(
                select(WorkflowTemplateModel)
                .options(selectinload(WorkflowTemplateModel.steps))
                .where(WorkflowTemplateModel.id == template_id)
            )
            if template is None:
                return None
            return self._template_to_public(template)

    def get_default_workflow_template(self) -> WorkflowTemplatePublic:
        default_template = self.get_workflow_template(DEFAULT_WORKFLOW_TEMPLATE_ID)
        if default_template is not None:
            return default_template

        with session_scope() as session:
            template = session.scalar(
                select(WorkflowTemplateModel)
                .options(selectinload(WorkflowTemplateModel.steps))
                .order_by(WorkflowTemplateModel.nombre.asc())
            )
            if template is None:
                raise ValueError("No workflow templates configured")
            return self._template_to_public(template)

    def _trigger_to_public(self, trigger: TriggerModel) -> TriggerPublic:
        return TriggerPublic(
            id=trigger.id,
            solicitante=trigger.solicitante,
            descripcion=trigger.descripcion,
            tipo=trigger.tipo,
            metadata=trigger.metadata_payload,
            ambito=Ambito(trigger.ambito) if trigger.ambito else None,
            estado_general=TriggerStatus(trigger.estado_general),
            fecha_creacion=trigger.fecha_creacion,
            fecha_actualizacion=trigger.fecha_actualizacion,
            creado_por=trigger.creado_por,
            workflow_activo_id=trigger.workflow_activo_id,
        )

    def _trigger_to_detail(self, trigger: TriggerModel) -> TriggerDetail:
        return TriggerDetail(
            **self._trigger_to_public(trigger).model_dump(),
            workflow_ids=[workflow.id for workflow in sorted(trigger.workflows, key=lambda item: item.fecha_inicio, reverse=True)],
        )

    def _workflow_to_summary(self, workflow: WorkflowModel) -> WorkflowSummary:
        steps = _sort_step_instances([self._step_to_public(item) for item in workflow.steps])
        active_orders = _active_step_orders(steps)
        requirement_ids = [item.id for item in sorted(workflow.requirements, key=lambda requirement: requirement.fecha_creacion)]
        primary_requirement_id = workflow.trigger_id or (requirement_ids[0] if requirement_ids else None)
        return WorkflowSummary(
            id=workflow.id,
            trigger_id=primary_requirement_id,
            requirement_ids=requirement_ids,
            workflow_template_id=workflow.workflow_template_id,
            workflow_template_nombre=workflow.workflow_template_nombre,
            estado=WorkflowStatus(workflow.estado),
            pasos_activos=active_orders,
            paso_actual=active_orders[0] if active_orders else None,
            total_pasos=len(steps) if steps else workflow.total_pasos,
            fecha_inicio=workflow.fecha_inicio,
            fecha_fin=workflow.fecha_fin,
            objetivo_final=workflow.objetivo_final,
            resolucion_esperada=workflow.resolucion_esperada,
            ambito=Ambito(workflow.ambito) if workflow.ambito else None,
        )

    def _workflow_to_detail(self, workflow: WorkflowModel) -> WorkflowDetail:
        steps = _sort_step_instances([self._step_to_public(step) for step in workflow.steps])
        active_orders = _active_step_orders(steps)
        summary = self._workflow_to_summary(workflow).model_copy(
            update={
                "pasos_activos": active_orders,
                "paso_actual": active_orders[0] if active_orders else None,
                "total_pasos": len(steps),
            }
        )
        return WorkflowDetail(
            **summary.model_dump(),
            steps=steps,
        )

    def _step_to_public(self, step: StepModel) -> StepInstancePublic:
        comments = [self._comment_to_public(comment) for comment in step.comments]
        history_entries = [self._history_to_public(entry) for entry in step.history_entries]
        latest_snapshot = self._empty_latest_snapshot()
        for comment in reversed(comments):
            snapshot = self._build_latest_snapshot_from_comment(comment)
            if snapshot["timestamp"]:
                latest_snapshot = snapshot
                break

        for entry in reversed(history_entries):
            snapshot = self._build_latest_snapshot_from_history(entry)
            if not snapshot["timestamp"]:
                continue
            if latest_snapshot["timestamp"] is None or snapshot["timestamp"] > latest_snapshot["timestamp"]:
                latest_snapshot = snapshot
            break

        return StepInstancePublic(
            id=step.id,
            workflow_id=step.workflow_id,
            step_template_id=step.step_template_id,
            codigo=step.codigo,
            depends_on=list(step.depends_on or []),
            nombre=step.nombre,
            descripcion=step.descripcion,
            orden=step.orden,
            tipo=step.tipo,
            requiere_aprobacion=step.requiere_aprobacion,
            puede_tener_comentarios=step.puede_tener_comentarios,
            action_type=step.action_type or "continue",
            action_config=step.action_config,
            action_label=step.action_label,
            waits_for_external_response=bool(step.waits_for_external_response),
            expected_external_event=step.expected_external_event,
            external_wait_reason=step.external_wait_reason,
            external_reference=step.external_reference,
            estado=StepStatus(step.estado),
            fecha_estado_actual=step.fecha_estado_actual,
            asignado_a=step.asignado_a,
            fecha_creacion=step.fecha_creacion,
            fecha_inicio=step.fecha_inicio,
            fecha_vencimiento=step.fecha_vencimiento,
            fecha_ejecucion_estimada=step.fecha_ejecucion_estimada,
            fecha_cierre=step.fecha_cierre,
            resultado=step.resultado,
            observaciones=step.observaciones,
            ambito=Ambito(step.ambito) if step.ambito else None,
            ultimo_comentario=latest_snapshot["text"],
            ultimo_comentario_fecha=latest_snapshot["timestamp"],
            ultimo_comentario_tipo=latest_snapshot["kind"],
            ultimo_comentario_adjunto_nombre=latest_snapshot["attachment_name"],
            ultimo_comentario_adjunto_content_type=latest_snapshot["attachment_content_type"],
        )

    def _comment_to_public(self, comment: CommentModel) -> CommentPublic:
        return CommentPublic(
            id=comment.id,
            step_instance_id=comment.step_instance_id,
            autor=comment.autor,
            comentario=comment.comentario,
            fecha_creacion=comment.fecha_creacion,
            attachments=self._deserialize_attachments(comment.attachments),
        )

    def _history_to_public(self, entry: StepHistoryModel) -> StepHistoryPublic:
        return StepHistoryPublic(
            id=entry.id,
            step_instance_id=entry.step_instance_id,
            campo=entry.campo,
            valor_anterior=entry.valor_anterior,
            valor_nuevo=entry.valor_nuevo,
            usuario=entry.usuario,
            fecha=entry.fecha,
            nota=entry.nota,
            attachments=self._deserialize_attachments(entry.attachments),
        )

    def _external_event_to_public(self, event: ExternalEventModel) -> ExternalEventPublic:
        return ExternalEventPublic(
            id=event.id,
            workflow_id=event.workflow_id,
            step_id=event.step_id,
            event_type=event.event_type,
            source=event.source,
            payload=event.payload,
            comentario=event.comentario,
            attachments=self._deserialize_attachments(event.attachments),
            fecha_creacion=event.fecha_creacion,
            registrado_por=event.registrado_por,
        )

    def _template_to_public(self, template: WorkflowTemplateModel) -> WorkflowTemplatePublic:
        ordered_steps = sorted(template.steps, key=lambda item: item.orden)
        fallback_codes = [step.nombre.strip().lower().replace(" ", "_") for step in ordered_steps]
        step_items = [
            StepTemplatePublic(
                id=step.id,
                codigo=(step.codigo or fallback_codes[index]),
                depends_on=(
                    list(step.depends_on)
                    if step.depends_on is not None
                    else ([fallback_codes[index - 1]] if index > 0 else [])
                ),
                nombre=step.nombre,
                descripcion=step.descripcion,
                orden=step.orden,
                tipo=step.tipo,
                requiere_aprobacion=step.requiere_aprobacion,
                puede_tener_comentarios=step.puede_tener_comentarios,
                action_type=step.action_type or "continue",
                action_config=step.action_config,
                action_label=step.action_label,
                waits_for_external_response=bool(step.waits_for_external_response),
                expected_external_event=step.expected_external_event,
                external_wait_reason=step.external_wait_reason,
                external_reference=step.external_reference,
                condicion_para_activarse=step.condicion_para_activarse,
                condicion_para_cerrarse=step.condicion_para_cerrarse,
            )
            for index, step in enumerate(ordered_steps)
        ]
        return WorkflowTemplatePublic(
            id=template.id,
            nombre=template.nombre,
            descripcion=template.descripcion,
            steps=_normalize_template_steps(step_items),
        )

    def _deserialize_attachments(self, attachments: list[dict] | None) -> list[AttachmentPublic]:
        return [AttachmentPublic(**attachment) for attachment in attachments or []]

    def _build_latest_snapshot_from_comment(self, comment: CommentPublic | None) -> dict[str, object | None]:
        if comment is None:
            return self._empty_latest_snapshot()

        text = (comment.comentario or "").strip()
        if text and not _is_noisy_automatic_journal_text(text):
            return {
                "text": text,
                "kind": "texto",
                "attachment_name": None,
                "attachment_content_type": None,
                "timestamp": comment.fecha_creacion,
            }

        if comment.attachments:
            attachment = comment.attachments[0]
            return {
                "text": "Imagen adjunta" if attachment.content_type.startswith("image/") else "Archivo adjunto",
                "kind": "imagen" if attachment.content_type.startswith("image/") else "adjunto",
                "attachment_name": attachment.nombre,
                "attachment_content_type": attachment.content_type,
                "timestamp": comment.fecha_creacion,
            }

        return self._empty_latest_snapshot()

    def _build_latest_snapshot_from_history(self, entry: StepHistoryPublic | None) -> dict[str, object | None]:
        if entry is None:
            return self._empty_latest_snapshot()

        text = (entry.nota or "").strip()
        if text and not _is_noisy_automatic_journal_text(text):
            return {
                "text": text,
                "kind": "texto",
                "attachment_name": None,
                "attachment_content_type": None,
                "timestamp": entry.fecha,
            }

        if entry.attachments:
            attachment = entry.attachments[0]
            return {
                "text": "Imagen adjunta" if attachment.content_type.startswith("image/") else "Archivo adjunto",
                "kind": "imagen" if attachment.content_type.startswith("image/") else "adjunto",
                "attachment_name": attachment.nombre,
                "attachment_content_type": attachment.content_type,
                "timestamp": entry.fecha,
            }

        return self._empty_latest_snapshot()

    def _empty_latest_snapshot(self) -> dict[str, object | None]:
        return {
            "text": None,
            "kind": None,
            "attachment_name": None,
            "attachment_content_type": None,
            "timestamp": None,
        }
