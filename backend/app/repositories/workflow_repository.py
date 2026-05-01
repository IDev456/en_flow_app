from abc import ABC, abstractmethod
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.workflow import (
    CommentCreate,
    CommentPublic,
    StepCreate,
    StepHistoryPublic,
    StepInstancePublic,
    StepStatus,
    StepTemplatePublic,
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


class WorkflowRepository(ABC):
    @abstractmethod
    def list_triggers(self) -> list[TriggerPublic]:
        raise NotImplementedError

    @abstractmethod
    def get_trigger(self, trigger_id: str) -> TriggerDetail | None:
        raise NotImplementedError

    @abstractmethod
    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
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
        trigger_id: str,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
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
    def create_step(self, workflow_id: str, payload: StepCreate, orden: int) -> StepInstancePublic:
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
    def list_pending_steps(self) -> list[StepInstancePublic]:
        raise NotImplementedError

    @abstractmethod
    def list_active_workflows(self) -> list[WorkflowSummary]:
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
        self._workflows: dict[str, WorkflowSummary] = {}
        self._steps: dict[str, StepInstancePublic] = {}
        self._step_ids_by_workflow: dict[str, list[str]] = {}
        self._comments_by_step: dict[str, list[CommentPublic]] = {}
        self._history_by_step: dict[str, list[StepHistoryPublic]] = {}
        self._workflow_templates: dict[str, WorkflowTemplatePublic] = {}
        self._seed_templates()

    def _seed_templates(self) -> None:
        diagnostico = StepTemplatePublic(
            id=str(uuid4()),
            nombre="Diagnostico",
            descripcion="Analizar el disparador y definir alcance inicial.",
            orden=1,
            tipo="analisis",
            requiere_aprobacion=False,
            puede_tener_comentarios=True,
        )
        ejecucion = StepTemplatePublic(
            id=str(uuid4()),
            nombre="Ejecucion",
            descripcion="Implementar o resolver la accion principal del flujo.",
            orden=2,
            tipo="ejecucion",
            requiere_aprobacion=False,
            puede_tener_comentarios=True,
        )
        verificacion = StepTemplatePublic(
            id=str(uuid4()),
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

    def list_triggers(self) -> list[TriggerPublic]:
        return sorted(self._triggers.values(), key=lambda item: item.fecha_actualizacion, reverse=True)

    def get_trigger(self, trigger_id: str) -> TriggerDetail | None:
        trigger = self._triggers.get(trigger_id)
        if trigger is None:
            return None

        return TriggerDetail(
            **trigger.model_dump(exclude={"workflow_ids"}),
            workflow_ids=list(self._workflow_ids_by_trigger.get(trigger_id, [])),
        )

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        now = utc_now()
        trigger = TriggerPublic(
            id=str(uuid4()),
            titulo=payload.titulo,
            descripcion=payload.descripcion,
            tipo=payload.tipo,
            prioridad=payload.prioridad,
            estado_general=TriggerStatus.NUEVO,
            fecha_creacion=now,
            fecha_actualizacion=now,
            creado_por=payload.creado_por,
            metadata=payload.metadata,
            workflow_activo_id=None,
        )
        self._triggers[trigger.id] = trigger
        self._workflow_ids_by_trigger[trigger.id] = []
        return trigger

    def save_trigger(self, trigger: TriggerPublic) -> TriggerPublic:
        normalized = TriggerPublic(**trigger.model_dump(exclude={"workflow_ids"}))
        self._triggers[trigger.id] = normalized
        return normalized

    def list_workflows(self) -> list[WorkflowSummary]:
        return sorted(self._workflows.values(), key=lambda item: item.fecha_inicio, reverse=True)

    def get_workflow(self, workflow_id: str) -> WorkflowDetail | None:
        workflow = self._workflows.get(workflow_id)
        if workflow is None:
            return None

        return WorkflowDetail(**workflow.model_dump(exclude={"steps"}), steps=self.list_workflow_steps(workflow_id))

    def create_workflow(
        self,
        trigger_id: str,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        now = utc_now()
        ordered_templates = sorted(template.steps, key=lambda item: item.orden)
        workflow = WorkflowSummary(
            id=str(uuid4()),
            trigger_id=trigger_id,
            workflow_template_id=template.id,
            workflow_template_nombre=template.nombre,
            estado=WorkflowStatus.EN_PROCESO if ordered_templates else WorkflowStatus.PENDIENTE,
            paso_actual=ordered_templates[0].orden if ordered_templates else None,
            fecha_inicio=now,
            fecha_fin=None,
            objetivo_final=payload.objetivo_final,
            resolucion_esperada=payload.resolucion_esperada,
        )
        self._workflows[workflow.id] = workflow
        self._step_ids_by_workflow[workflow.id] = []
        self._workflow_ids_by_trigger.setdefault(trigger_id, []).append(workflow.id)

        for template_step in ordered_templates:
            first_step_override = getattr(payload, "primer_paso", None)
            is_first_step = template_step.orden == workflow.paso_actual
            step = StepInstancePublic(
                id=str(uuid4()),
                workflow_id=workflow.id,
                step_template_id=template_step.id,
                nombre=(
                    first_step_override.nombre
                    if is_first_step and first_step_override and first_step_override.nombre
                    else template_step.nombre
                ),
                descripcion=(
                    first_step_override.descripcion
                    if is_first_step and first_step_override and first_step_override.descripcion is not None
                    else template_step.descripcion
                ),
                orden=template_step.orden,
                tipo=template_step.tipo,
                requiere_aprobacion=template_step.requiere_aprobacion,
                puede_tener_comentarios=template_step.puede_tener_comentarios,
                estado=StepStatus.ACTIVO if template_step.orden == workflow.paso_actual else StepStatus.PENDIENTE,
                asignado_a=(
                    first_step_override.asignado_a
                    if is_first_step and first_step_override
                    else None
                ),
                fecha_creacion=now,
                fecha_inicio=now if template_step.orden == workflow.paso_actual else None,
                fecha_vencimiento=(
                    first_step_override.fecha_vencimiento
                    if is_first_step and first_step_override
                    else None
                ),
                fecha_cierre=None,
                resultado=None,
                observaciones=None,
            )
            self._steps[step.id] = step
            self._step_ids_by_workflow[workflow.id].append(step.id)
            self._comments_by_step[step.id] = []
            self._history_by_step[step.id] = []

        return self.get_workflow(workflow.id)  # type: ignore[return-value]

    def save_workflow(self, workflow: WorkflowSummary) -> WorkflowSummary:
        normalized = WorkflowSummary(**workflow.model_dump(exclude={"steps"}))
        self._workflows[workflow.id] = normalized
        return normalized

    def list_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        step_ids = self._step_ids_by_workflow.get(workflow_id, [])
        steps = [self._steps[step_id] for step_id in step_ids]
        return sorted(steps, key=lambda item: item.orden)

    def get_step(self, step_id: str) -> StepInstancePublic | None:
        return self._steps.get(step_id)

    def create_step(self, workflow_id: str, payload: StepCreate, orden: int) -> StepInstancePublic:
        now = utc_now()
        step = StepInstancePublic(
            id=str(uuid4()),
            workflow_id=workflow_id,
            step_template_id=None,
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            orden=orden,
            tipo=payload.tipo,
            requiere_aprobacion=payload.requiere_aprobacion,
            puede_tener_comentarios=payload.puede_tener_comentarios,
            estado=StepStatus.PENDIENTE,
            asignado_a=payload.asignado_a,
            fecha_creacion=now,
            fecha_inicio=None,
            fecha_vencimiento=payload.fecha_vencimiento,
            fecha_cierre=None,
            resultado=None,
            observaciones=None,
        )
        self._steps[step.id] = step
        self._step_ids_by_workflow.setdefault(workflow_id, []).append(step.id)
        self._comments_by_step[step.id] = []
        self._history_by_step[step.id] = []
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

    def list_pending_steps(self) -> list[StepInstancePublic]:
        visible_statuses = {
            StepStatus.PENDIENTE,
            StepStatus.ACTIVO,
            StepStatus.EN_REVISION,
            StepStatus.BLOQUEADO,
        }
        steps = [step for step in self._steps.values() if step.estado in visible_statuses]
        return sorted(steps, key=lambda item: (item.estado != StepStatus.ACTIVO, item.workflow_id, item.orden))

    def list_active_workflows(self) -> list[WorkflowSummary]:
        return [
            workflow
            for workflow in self.list_workflows()
            if workflow.estado in {WorkflowStatus.PENDIENTE, WorkflowStatus.EN_PROCESO}
        ]

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        return list(self._workflow_templates.values())

    def get_workflow_template(self, template_id: str) -> WorkflowTemplatePublic | None:
        return self._workflow_templates.get(template_id)

    def get_default_workflow_template(self) -> WorkflowTemplatePublic:
        return next(iter(self._workflow_templates.values()))
