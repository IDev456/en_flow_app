from abc import ABC, abstractmethod
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import (
    DEFAULT_WORKFLOW_TEMPLATE_ID,
    CommentModel,
    StepHistoryModel,
    StepModel,
    TriggerModel,
    WorkflowModel,
    WorkflowTemplateModel,
)
from app.db.session import session_scope
from app.schemas.workflow import (
    AttachmentBase,
    AttachmentPublic,
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


OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}


def _sort_template_steps(steps: list[StepTemplatePublic]) -> list[StepTemplatePublic]:
    return sorted(steps, key=lambda item: (item.orden, item.codigo, item.id))


def _sort_step_instances(steps: list[StepInstancePublic]) -> list[StepInstancePublic]:
    return sorted(steps, key=lambda item: (item.orden, item.codigo or "", item.id))


def _active_step_orders(steps: list[StepInstancePublic]) -> list[int]:
    return [step.orden for step in _sort_step_instances(steps) if step.estado in OPEN_STEP_STATUSES]


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

    def delete_trigger(self, trigger_id: str) -> bool:
        trigger = self._triggers.pop(trigger_id, None)
        workflow_ids = self._workflow_ids_by_trigger.pop(trigger_id, [])
        if trigger is None:
            return False

        for workflow_id in workflow_ids:
            step_ids = self._step_ids_by_workflow.pop(workflow_id, [])
            self._workflows.pop(workflow_id, None)
            for step_id in step_ids:
                self._steps.pop(step_id, None)
                self._comments_by_step.pop(step_id, None)
                self._history_by_step.pop(step_id, None)

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
            items.append(
                workflow.model_copy(
                    update={
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
        summary = workflow.model_copy(
            update={
                "pasos_activos": active_orders,
                "paso_actual": active_orders[0] if active_orders else None,
                "total_pasos": len(steps),
            }
        )
        return WorkflowDetail(**summary.model_dump(exclude={"steps"}), steps=steps)

    def create_workflow(
        self,
        trigger_id: str,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        now = utc_now()
        ordered_templates = _normalize_template_steps(template.steps)
        root_templates = [step for step in ordered_templates if not step.depends_on]
        workflow = WorkflowSummary(
            id=str(uuid4()),
            trigger_id=trigger_id,
            workflow_template_id=template.id,
            workflow_template_nombre=template.nombre,
            estado=WorkflowStatus.EN_PROCESO if root_templates else WorkflowStatus.FINALIZADO,
            pasos_activos=[step.orden for step in root_templates],
            paso_actual=root_templates[0].orden if root_templates else None,
            total_pasos=len(root_templates),
            fecha_inicio=now,
            fecha_fin=None,
            objetivo_final=payload.objetivo_final,
            resolucion_esperada=payload.resolucion_esperada,
        )
        self._workflows[workflow.id] = workflow
        self._step_ids_by_workflow[workflow.id] = []
        self._workflow_ids_by_trigger.setdefault(trigger_id, []).append(workflow.id)

        if root_templates:
            first_step_override = getattr(payload, "primer_paso", None)
            override_applied = False
            for template_step in root_templates:
                should_apply_override = bool(first_step_override and not override_applied)
                step = StepInstancePublic(
                    id=str(uuid4()),
                    workflow_id=workflow.id,
                    step_template_id=template_step.id,
                    codigo=template_step.codigo,
                    depends_on=list(template_step.depends_on),
                    nombre=(
                        first_step_override.nombre
                        if should_apply_override and first_step_override and first_step_override.nombre
                        else template_step.nombre
                    ),
                    descripcion=(
                        first_step_override.descripcion
                        if should_apply_override and first_step_override and first_step_override.descripcion is not None
                        else template_step.descripcion
                    ),
                    orden=template_step.orden,
                    tipo=template_step.tipo,
                    requiere_aprobacion=template_step.requiere_aprobacion,
                    puede_tener_comentarios=template_step.puede_tener_comentarios,
                    estado=StepStatus.ACTIVO,
                    fecha_estado_actual=now,
                    asignado_a=first_step_override.asignado_a if should_apply_override and first_step_override else None,
                    fecha_creacion=now,
                    fecha_inicio=now,
                    fecha_vencimiento=(
                        first_step_override.fecha_vencimiento
                        if should_apply_override and first_step_override
                        else None
                    ),
                    fecha_cierre=None,
                    resultado=None,
                    observaciones=None,
                )
                if should_apply_override:
                    override_applied = True
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
            estado=estado,
            fecha_estado_actual=now,
            asignado_a=payload.asignado_a,
            fecha_creacion=now,
            fecha_inicio=now if estado == StepStatus.ACTIVO else None,
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

    def list_pending_steps(self) -> list[StepInstancePublic]:
        steps = [step for step in self._steps.values() if step.estado in OPEN_STEP_STATUSES]
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

    def _enrich_step(self, step: StepInstancePublic) -> StepInstancePublic:
        comments = self._comments_by_step.get(step.id, [])
        history_entries = self._history_by_step.get(step.id, [])

        latest_comment = comments[-1] if comments else None
        latest_history = history_entries[-1] if history_entries else None

        latest_snapshot = self._build_latest_snapshot_from_comment(latest_comment)
        latest_history_snapshot = self._build_latest_snapshot_from_history(latest_history)

        if latest_history_snapshot["timestamp"] and (
            latest_snapshot["timestamp"] is None or latest_history_snapshot["timestamp"] > latest_snapshot["timestamp"]
        ):
            latest_snapshot = latest_history_snapshot

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
        if text:
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
        if text:
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
            estado_general=TriggerStatus.NUEVO.value,
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
                .options(selectinload(WorkflowModel.steps))
                .order_by(WorkflowModel.fecha_inicio.desc())
            ).all()
            return [self._workflow_to_summary(workflow) for workflow in workflows]

    def get_workflow(self, workflow_id: str) -> WorkflowDetail | None:
        with session_scope() as session:
            workflow = session.scalar(
                select(WorkflowModel)
                .options(
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
        trigger_id: str,
        template: WorkflowTemplatePublic,
        payload: WorkflowInstanceBase,
    ) -> WorkflowDetail:
        now = utc_now()
        ordered_templates = _normalize_template_steps(template.steps)
        root_templates = [step for step in ordered_templates if not step.depends_on]
        workflow = WorkflowModel(
            id=str(uuid4()),
            trigger_id=trigger_id,
            workflow_template_id=template.id,
            workflow_template_nombre=template.nombre,
            estado=WorkflowStatus.EN_PROCESO.value if root_templates else WorkflowStatus.FINALIZADO.value,
            paso_actual=root_templates[0].orden if root_templates else None,
            total_pasos=len(root_templates),
            fecha_inicio=now,
            fecha_fin=None,
            objetivo_final=payload.objetivo_final,
            resolucion_esperada=payload.resolucion_esperada,
        )

        if root_templates:
            first_step_override = getattr(payload, "primer_paso", None)
            override_applied = False
            for template_step in root_templates:
                use_override = bool(first_step_override and not override_applied)
                workflow.steps.append(
                    StepModel(
                        id=str(uuid4()),
                        step_template_id=template_step.id,
                        codigo=template_step.codigo,
                        depends_on=list(template_step.depends_on),
                        nombre=first_step_override.nombre if use_override and first_step_override and first_step_override.nombre else template_step.nombre,
                        descripcion=(
                            first_step_override.descripcion
                            if use_override and first_step_override and first_step_override.descripcion is not None
                            else template_step.descripcion
                        ),
                        orden=template_step.orden,
                        tipo=template_step.tipo,
                        requiere_aprobacion=template_step.requiere_aprobacion,
                        puede_tener_comentarios=template_step.puede_tener_comentarios,
                        estado=StepStatus.ACTIVO.value,
                        fecha_estado_actual=now,
                        asignado_a=first_step_override.asignado_a if use_override and first_step_override else None,
                        fecha_creacion=now,
                        fecha_inicio=now,
                        fecha_vencimiento=first_step_override.fecha_vencimiento if use_override and first_step_override else None,
                        fecha_cierre=None,
                        resultado=None,
                        observaciones=None,
                    )
                )
                if use_override:
                    override_applied = True

        with session_scope() as session:
            session.add(workflow)
            session.flush()
            workflow = session.scalar(
                select(WorkflowModel)
                .options(
                    selectinload(WorkflowModel.steps).selectinload(StepModel.comments),
                    selectinload(WorkflowModel.steps).selectinload(StepModel.history_entries),
                )
                .where(WorkflowModel.id == workflow.id)
            )
            return self._workflow_to_detail(workflow)  # type: ignore[arg-type]

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
            estado=estado.value,
            fecha_estado_actual=now,
            asignado_a=payload.asignado_a,
            fecha_creacion=now,
            fecha_inicio=now if estado == StepStatus.ACTIVO else None,
            fecha_vencimiento=payload.fecha_vencimiento,
            fecha_cierre=None,
            resultado=None,
            observaciones=None,
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
            existing.estado = step.estado.value
            existing.fecha_estado_actual = step.fecha_estado_actual
            existing.asignado_a = step.asignado_a
            existing.fecha_creacion = step.fecha_creacion
            existing.fecha_inicio = step.fecha_inicio
            existing.fecha_vencimiento = step.fecha_vencimiento
            existing.fecha_cierre = step.fecha_cierre
            existing.resultado = step.resultado
            existing.observaciones = step.observaciones

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
                .options(selectinload(WorkflowModel.steps))
                .where(WorkflowModel.estado.in_([WorkflowStatus.PENDIENTE.value, WorkflowStatus.EN_PROCESO.value]))
                .order_by(WorkflowModel.fecha_inicio.desc())
            ).all()
            return [self._workflow_to_summary(workflow) for workflow in workflows]

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
        return WorkflowSummary(
            id=workflow.id,
            trigger_id=workflow.trigger_id,
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
        latest_comment = comments[-1] if comments else None
        latest_history = history_entries[-1] if history_entries else None

        latest_snapshot = self._build_latest_snapshot_from_comment(latest_comment)
        latest_history_snapshot = self._build_latest_snapshot_from_history(latest_history)

        if latest_history_snapshot["timestamp"] and (
            latest_snapshot["timestamp"] is None or latest_history_snapshot["timestamp"] > latest_snapshot["timestamp"]
        ):
            latest_snapshot = latest_history_snapshot

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
            estado=StepStatus(step.estado),
            fecha_estado_actual=step.fecha_estado_actual,
            asignado_a=step.asignado_a,
            fecha_creacion=step.fecha_creacion,
            fecha_inicio=step.fecha_inicio,
            fecha_vencimiento=step.fecha_vencimiento,
            fecha_cierre=step.fecha_cierre,
            resultado=step.resultado,
            observaciones=step.observaciones,
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
        if text:
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
        if text:
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
