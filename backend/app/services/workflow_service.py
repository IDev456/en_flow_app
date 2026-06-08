from datetime import datetime, timezone
from uuid import uuid4

from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.repositories.workflow_repository import WorkflowRepository, utc_now
from app.schemas.workflow import (
    Ambito,
    AttachmentBase,
    CommentCreate,
    CommentPublic,
    CommentUpdate,
    DailyBoardResponse,
    ExternalResponseDecisionPayload,
    ExternalEventCreate,
    ExternalEventPublic,
    ExternalWaitInput,
    QuickCaptureRequest,
    REMINDER_PAST_ERROR,
    RequirementCreateFromFlowPayload,
    WorkLogEntry,
    StepDateUpdate,
    StepCompletePayload,
    StepCreate,
    StepHistoryPublic,
    StepInstancePublic,
    StepUpdate,
    StepStatus,
    StepTransitionType,
    StepStatusUpdate,
    StepTemplatePublic,
    TriggerCreate,
    TriggerDetail,
    TriggerPublic,
    TriggerUpdate,
    TriggerStatus,
    WorkflowDetail,
    WorkflowStartMode,
    WorkflowStartRequest,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowTemplatePublic,
    WorkflowUpdate,
    is_past_calendar_day,
)

OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA, StepStatus.ESPERANDO_RESPUESTA}
ACTIONABLE_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}
WORKFLOW_OPEN_STATUSES = {
    WorkflowStatus.PENDIENTE,
    WorkflowStatus.EN_PROCESO,
    WorkflowStatus.ESPERANDO_RESPUESTA,
    WorkflowStatus.EN_ESPERA,
    WorkflowStatus.CON_PROBLEMA,
}


class WorkflowService:
    def __init__(self, repository: WorkflowRepository) -> None:
        self.repository = repository

    def _ensure_reminder_not_past(self, *values: datetime | None) -> None:
        for value in values:
            if is_past_calendar_day(value):
                raise BusinessRuleError(REMINDER_PAST_ERROR)

    def _ensure_matching_ambito(self, workflow_ambito: Ambito | None, trigger_ambito: Ambito | None) -> None:
        if workflow_ambito is None or trigger_ambito is None or workflow_ambito != trigger_ambito:
            raise BusinessRuleError("No se puede asociar un flow con un proyecto de distinto ámbito.")

    def _ensure_workflow_links_allow_ambito(self, workflow: WorkflowDetail | WorkflowSummary, next_ambito: Ambito | None) -> list[TriggerDetail]:
        requirement_ids = self._collect_requirement_ids(workflow)
        requirements = [self.get_trigger(requirement_id) for requirement_id in requirement_ids]
        if not requirements:
            return requirements
        if next_ambito is None:
            raise BusinessRuleError("No se puede dejar un flow asociado sin ámbito definido.")
        for requirement in requirements:
            if requirement.ambito is None or requirement.ambito != next_ambito:
                raise BusinessRuleError("No se puede asociar un flow con un proyecto de distinto ámbito.")
        return requirements

    def _ensure_trigger_links_allow_ambito(self, trigger: TriggerDetail, next_ambito: Ambito | None) -> list[WorkflowDetail]:
        workflows = [self.get_workflow(workflow_id) for workflow_id in trigger.workflow_ids]
        if not workflows:
            return workflows
        if next_ambito is None:
            raise BusinessRuleError("No se puede dejar un proyecto asociado sin ámbito definido.")
        for workflow in workflows:
            if workflow.ambito is None or workflow.ambito != next_ambito:
                raise BusinessRuleError("No se puede asociar un flow con un proyecto de distinto ámbito.")
        return workflows

    def _ensure_trigger_propagation_safe(self, trigger_id: str, next_ambito: Ambito | None, workflows: list[WorkflowDetail]) -> None:
        if next_ambito is None and workflows:
            raise BusinessRuleError("No se puede dejar un proyecto asociado sin ámbito definido.")
        for workflow in workflows:
            for requirement_id in self._collect_requirement_ids(workflow):
                if requirement_id == trigger_id:
                    continue
                requirement = self.get_trigger(requirement_id)
                if requirement.ambito is None or requirement.ambito != next_ambito:
                    raise BusinessRuleError("No se puede asociar un flow con un proyecto de distinto ámbito.")

    def _propagate_workflow_ambito_to_steps(self, workflow_id: str, ambito: Ambito | None) -> None:
        for step in self.get_workflow_steps(workflow_id):
            if step.ambito == ambito:
                continue
            self.repository.save_step(step.model_copy(update={"ambito": ambito}))

    def list_triggers(self) -> list[TriggerDetail]:
        return self.repository.list_triggers()

    def list_requirements(self) -> list[TriggerDetail]:
        return self.list_triggers()

    def get_trigger(self, trigger_id: str) -> TriggerDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")
        return trigger

    def get_requirement(self, requirement_id: str) -> TriggerDetail:
        return self.get_trigger(requirement_id)

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        return self.repository.create_trigger(payload)

    def create_requirement(self, payload: TriggerCreate) -> TriggerPublic:
        return self.create_trigger(payload)

    def update_trigger(self, trigger_id: str, payload: TriggerUpdate) -> TriggerDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")

        patch_data = payload.model_dump(exclude_unset=True)
        update_data: dict[str, object] = {"fecha_actualizacion": utc_now()}
        next_ambito = trigger.ambito
        ambito_changed = "ambito" in patch_data and patch_data["ambito"] != trigger.ambito
        if ambito_changed:
            next_ambito = patch_data["ambito"]
            linked_workflows = self._ensure_trigger_links_allow_ambito(trigger, next_ambito) if not payload.propagate_ambito else [
                self.get_workflow(workflow_id) for workflow_id in trigger.workflow_ids
            ]
            if payload.propagate_ambito:
                self._ensure_trigger_propagation_safe(trigger_id, next_ambito, linked_workflows)
        if "solicitante" in patch_data:
            update_data["solicitante"] = patch_data["solicitante"]
        if "descripcion" in patch_data:
            update_data["descripcion"] = patch_data["descripcion"]
        if "tipo" in patch_data:
            update_data["tipo"] = patch_data["tipo"]
        if "metadata" in patch_data:
            update_data["metadata"] = patch_data["metadata"]
        if ambito_changed:
            update_data["ambito"] = next_ambito

        updated_trigger = trigger.model_copy(
            update=update_data
        )
        self.repository.save_trigger(updated_trigger)
        if ambito_changed and payload.propagate_ambito:
            for workflow_id in trigger.workflow_ids:
                workflow = self.get_workflow(workflow_id)
                self.repository.save_workflow(workflow.model_copy(update={"ambito": next_ambito}))
                self._propagate_workflow_ambito_to_steps(workflow.id, next_ambito)
        refreshed = self.repository.get_trigger(trigger_id)
        if refreshed is None:
            raise EntityNotFoundError("Trigger not found")
        return refreshed

    def update_requirement(self, requirement_id: str, payload: TriggerUpdate) -> TriggerDetail:
        return self.update_trigger(requirement_id, payload)

    def delete_trigger(self, trigger_id: str) -> None:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")
        if trigger.workflow_ids:
            raise BusinessRuleError("No puedes eliminar un requerimiento con flows vinculados")
        deleted = self.repository.delete_trigger(trigger_id)
        if not deleted:
            raise EntityNotFoundError("Trigger not found")

    def delete_workflow(self, workflow_id: str) -> None:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado not in {WorkflowStatus.CANCELADO, WorkflowStatus.FINALIZADO}:
            raise BusinessRuleError(
                "No se puede eliminar el flow porque no está cancelado ni finalizado. Primero debe cancelarse o finalizarse."
            )

        requirement_ids = self._collect_requirement_ids(workflow)
        deleted = self.repository.delete_workflow(workflow_id)
        if not deleted:
            raise EntityNotFoundError("Workflow not found")

        now = utc_now()
        for requirement_id in requirement_ids:
            self._reconcile_trigger_status(requirement_id, now)

    def delete_requirement(self, requirement_id: str) -> None:
        self.delete_trigger(requirement_id)

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        return self.repository.list_workflow_templates()

    def start_workflow(self, trigger_id: str, payload: WorkflowStartRequest) -> WorkflowDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")
        if trigger.ambito is None:
            raise BusinessRuleError("Debes definir el ámbito del proyecto antes de crear un flow.")
        if payload.ambito is not None and payload.ambito != trigger.ambito:
            raise BusinessRuleError("No se puede asociar un flow con un proyecto de distinto ámbito.")

        if payload.modo_inicio == WorkflowStartMode.TAREA_ACTIVA:
            if payload.primer_paso is None or not payload.primer_paso.nombre.strip():
                raise BusinessRuleError("La tarea inicial es obligatoria para iniciar el flow")
            self._ensure_reminder_not_past(payload.primer_paso.fecha_vencimiento)
        else:
            if payload.espera_inicial is None:
                raise BusinessRuleError("Debes indicar la informacion de espera inicial")
            self._ensure_reminder_not_past(payload.espera_inicial.fecha_recordatorio)

        template = (
            self.repository.get_workflow_template(payload.workflow_template_id)
            if payload.workflow_template_id
            else self.repository.get_default_workflow_template()
        )
        if template is None:
            raise EntityNotFoundError("Workflow template not found")

        workflow = self.repository.create_workflow(trigger_id, template, payload.model_copy(update={"ambito": trigger.ambito}))
        self._reconcile_trigger_status(trigger_id, utc_now(), preferred_workflow_id=workflow.id)
        return workflow

    def quick_capture_flow(self, payload: QuickCaptureRequest) -> WorkflowDetail:
        if payload.modo_inicio == WorkflowStartMode.TAREA_ACTIVA:
            self._ensure_reminder_not_past(payload.fecha_vencimiento)
        else:
            if payload.espera_inicial is None:
                raise BusinessRuleError("Debes indicar la informacion de espera inicial")
            self._ensure_reminder_not_past(payload.espera_inicial.fecha_recordatorio)
        template = self.repository.get_default_workflow_template()
        workflow = self.repository.create_workflow(
            None,
            template,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                objetivo_final=payload.titulo.strip(),
                resolucion_esperada=None,
                ambito=payload.ambito,
                modo_inicio=payload.modo_inicio,
                primer_paso=(
                    {
                        "nombre": payload.titulo.strip(),
                        "descripcion": payload.detalle,
                        "asignado_a": payload.asignado_a,
                        "fecha_vencimiento": payload.fecha_vencimiento,
                        "fecha_ejecucion_estimada": payload.fecha_ejecucion_estimada,
                    }
                    if payload.modo_inicio == WorkflowStartMode.TAREA_ACTIVA
                    else None
                ),
                espera_inicial=payload.espera_inicial.model_dump() if payload.espera_inicial else None,
            ),
        )
        return workflow

    def list_workflows(self) -> list[WorkflowSummary]:
        return self.repository.list_workflows()

    def list_active_workflows(self) -> list[WorkflowSummary]:
        return self.repository.list_active_workflows()

    def get_workflow(self, workflow_id: str) -> WorkflowDetail:
        workflow = self.repository.get_workflow(workflow_id)
        if workflow is None:
            raise EntityNotFoundError("Workflow not found")
        return workflow

    def update_workflow(self, workflow_id: str, payload: WorkflowUpdate) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        patch_data = payload.model_dump(exclude_unset=True)
        update_data: dict[str, object] = {}
        ambito_changed = "ambito" in patch_data and patch_data["ambito"] != workflow.ambito
        next_ambito = patch_data.get("ambito", workflow.ambito)

        if "objetivo_final" in patch_data:
            next_title = (patch_data["objetivo_final"] or "").strip()
            if not next_title:
                raise BusinessRuleError("El nombre del flow es obligatorio")
            update_data["objetivo_final"] = next_title
        if ambito_changed:
            self._ensure_workflow_links_allow_ambito(workflow, next_ambito)
            update_data["ambito"] = next_ambito

        if not update_data:
            raise BusinessRuleError("No hay cambios para guardar")

        updated_workflow = workflow.model_copy(update=update_data)
        self.repository.save_workflow(updated_workflow)
        if ambito_changed and payload.propagate_ambito:
            self._propagate_workflow_ambito_to_steps(workflow_id, next_ambito)
        return self.get_workflow(workflow_id)

    def cancel_workflow(self, workflow_id: str) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado == WorkflowStatus.FINALIZADO:
            raise BusinessRuleError("No se puede cancelar un flow finalizado")
        if workflow.estado == WorkflowStatus.CANCELADO:
            raise BusinessRuleError("El flow ya está cancelado")

        now = utc_now()
        updated_workflow = workflow.model_copy(
            update={
                "estado": WorkflowStatus.CANCELADO,
                "fecha_fin": now,
            }
        )
        self.repository.save_workflow(updated_workflow)

        for requirement_id in self._collect_requirement_ids(workflow):
            self._reconcile_trigger_status(requirement_id, now, preferred_workflow_id=workflow.id)

        return self.get_workflow(workflow_id)

    def reactivate_workflow(self, workflow_id: str) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado == WorkflowStatus.FINALIZADO:
            raise BusinessRuleError("No se puede reactivar un flow finalizado")
        if workflow.estado != WorkflowStatus.CANCELADO:
            raise BusinessRuleError("Solo se puede reactivar un flow cancelado")

        now = utc_now()
        active_steps = [step for step in workflow.steps if step.estado == StepStatus.ACTIVO]
        waiting_external_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERANDO_RESPUESTA]
        paused_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERA]
        problem_steps = [step for step in workflow.steps if step.estado == StepStatus.PROBLEMA]
        open_steps = [step for step in workflow.steps if step.estado in OPEN_STEP_STATUSES]
        active_orders = sorted(step.orden for step in open_steps)
        waiting_since = min(
            (step.fecha_estado_actual for step in waiting_external_steps if step.fecha_estado_actual is not None),
            default=None,
        )
        fallback_order = min((step.orden for step in workflow.steps), default=None)

        if active_steps:
            next_status = WorkflowStatus.EN_PROCESO
            next_step_order = active_orders[0] if active_orders else fallback_order
        elif waiting_external_steps:
            next_status = WorkflowStatus.ESPERANDO_RESPUESTA
            next_step_order = active_orders[0] if active_orders else fallback_order
        elif paused_steps:
            next_status = WorkflowStatus.EN_ESPERA
            next_step_order = active_orders[0] if active_orders else fallback_order
        elif problem_steps:
            next_status = WorkflowStatus.CON_PROBLEMA
            next_step_order = active_orders[0] if active_orders else fallback_order
        elif workflow.steps and any(step.estado != StepStatus.COMPLETADO for step in workflow.steps):
            next_status = WorkflowStatus.PENDIENTE
            next_step_order = min((step.orden for step in workflow.steps if step.estado != StepStatus.COMPLETADO), default=fallback_order)
        else:
            # If the workflow is inconsistent (all completed or no steps), keep it operable after reactivation.
            next_status = WorkflowStatus.EN_PROCESO
            next_step_order = fallback_order

        updated_workflow = workflow.model_copy(
            update={
                "estado": next_status,
                "fecha_fin": None,
                "fecha_espera_desde": waiting_since if next_status == WorkflowStatus.ESPERANDO_RESPUESTA else None,
                "pasos_activos": active_orders,
                "paso_actual": next_step_order,
                "total_pasos": len(workflow.steps),
            }
        )
        self.repository.save_workflow(updated_workflow)

        for requirement_id in self._collect_requirement_ids(workflow):
            self._reconcile_trigger_status(requirement_id, now, preferred_workflow_id=workflow.id)

        return self.get_workflow(workflow_id)

    def get_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        workflow = self.get_workflow(workflow_id)
        return workflow.steps

    def link_workflow_to_requirement(self, workflow_id: str, requirement_id: str) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        requirement = self.get_trigger(requirement_id)
        self._ensure_matching_ambito(workflow.ambito, requirement.ambito)
        self.repository.link_requirement_to_workflow(requirement.id, workflow.id)
        self._reconcile_trigger_status(requirement.id, utc_now(), preferred_workflow_id=workflow.id)
        refreshed = self.repository.get_workflow(workflow.id)
        if refreshed is None:
            raise EntityNotFoundError("Workflow not found")
        return refreshed

    def unlink_workflow_from_requirement(self, workflow_id: str, requirement_id: str) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        self.get_trigger(requirement_id)
        self.repository.unlink_requirement_from_workflow(requirement_id, workflow.id)
        self._reconcile_trigger_status(requirement_id, utc_now(), preferred_workflow_id=workflow.id)
        refreshed = self.repository.get_workflow(workflow.id)
        if refreshed is None:
            raise EntityNotFoundError("Workflow not found")
        return refreshed

    def create_requirement_from_flow(self, workflow_id: str, payload: RequirementCreateFromFlowPayload) -> TriggerDetail:
        workflow = self.get_workflow(workflow_id)
        if workflow.ambito is None:
            raise BusinessRuleError("Debes definir el ámbito del flow antes de crear un proyecto.")
        requirement = self.create_trigger(
            TriggerCreate(
                solicitante=payload.solicitante,
                descripcion=payload.descripcion,
                tipo="requerimiento",
                creado_por=payload.creado_por,
                metadata=None,
                ambito=workflow.ambito,
            )
        )
        self.repository.link_requirement_to_workflow(requirement.id, workflow.id)
        self._reconcile_trigger_status(requirement.id, utc_now(), preferred_workflow_id=workflow.id)
        return self.get_trigger(requirement.id)

    def create_workflow_step(self, workflow_id: str, payload: StepCreate) -> StepInstancePublic:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado == WorkflowStatus.FINALIZADO:
            raise BusinessRuleError("No se pueden agregar tareas a un flow finalizado")
        self._ensure_workflow_operable(workflow)
        self._ensure_reminder_not_past(payload.fecha_vencimiento)

        steps = workflow.steps
        next_order = max((step.orden for step in steps), default=0) + 1
        created_step = self.repository.create_step(
            workflow_id,
            payload,
            next_order,
            StepStatus.ACTIVO,
            codigo=None,
            depends_on=[],
        )
        updated_workflow = workflow.model_copy(
            update={
                "estado": WorkflowStatus.EN_PROCESO,
                "pasos_activos": sorted([*workflow.pasos_activos, created_step.orden]),
                "paso_actual": min([*workflow.pasos_activos, created_step.orden], default=created_step.orden),
                "total_pasos": len(steps) + 1,
            }
        )
        self.repository.save_workflow(updated_workflow)
        self._record_history(created_step.id, "estado", None, StepStatus.ACTIVO, "sistema")
        requirement_ids = self._collect_requirement_ids(workflow)
        for requirement_id in requirement_ids:
            self._reconcile_trigger_status(requirement_id, utc_now(), preferred_workflow_id=workflow.id)
        return created_step

    def get_step(self, step_id: str) -> StepInstancePublic:
        step = self.repository.get_step(step_id)
        if step is None:
            raise EntityNotFoundError("Step not found")
        return step

    def update_step(self, step_id: str, payload: StepUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        patch_data = payload.model_dump(exclude_unset=True)
        update_data: dict[str, object] = {}
        waiting_field_names = {
            "expected_external_event",
            "esperando_de",
            "external_wait_reason",
            "external_reference",
        }

        if step.estado != StepStatus.ESPERANDO_RESPUESTA and any(field in patch_data for field in waiting_field_names):
            raise BusinessRuleError("Solo puedes editar metadata de espera en tareas esperando respuesta")

        if "nombre" in patch_data:
            next_name = (patch_data["nombre"] or "").strip()
            if not next_name:
                raise BusinessRuleError("El nombre de la tarea es obligatorio")
            update_data["nombre"] = next_name

        if "descripcion" in patch_data:
            next_description = patch_data["descripcion"]
            update_data["descripcion"] = next_description.strip() if isinstance(next_description, str) else None
        if "fecha_ejecucion_estimada" in patch_data:
            update_data["fecha_ejecucion_estimada"] = patch_data["fecha_ejecucion_estimada"]
        if "expected_external_event" in patch_data:
            update_data["expected_external_event"] = patch_data["expected_external_event"]
        if "esperando_de" in patch_data:
            next_waiting_from = patch_data["esperando_de"]
            update_data["esperando_de"] = next_waiting_from.strip() if isinstance(next_waiting_from, str) else None
        if "external_wait_reason" in patch_data:
            next_wait_reason = patch_data["external_wait_reason"]
            update_data["external_wait_reason"] = next_wait_reason.strip() if isinstance(next_wait_reason, str) else None
        if "external_reference" in patch_data:
            next_reference = patch_data["external_reference"]
            update_data["external_reference"] = next_reference.strip() if isinstance(next_reference, str) else None
        if not update_data:
            raise BusinessRuleError("No hay cambios para guardar")

        updated_step = step.model_copy(update=update_data)
        self.repository.save_step(updated_step)

        if step.nombre != updated_step.nombre:
            self._record_history(updated_step.id, "nombre", step.nombre, updated_step.nombre, "sistema")
        if step.descripcion != updated_step.descripcion:
            self._record_history(updated_step.id, "descripcion", step.descripcion, updated_step.descripcion, "sistema")
        if step.expected_external_event != updated_step.expected_external_event:
            self._record_history(
                updated_step.id,
                "que_se_espera",
                step.expected_external_event,
                updated_step.expected_external_event,
                "sistema",
            )
        if step.esperando_de != updated_step.esperando_de:
            self._record_history(updated_step.id, "esperando_de", step.esperando_de, updated_step.esperando_de, "sistema")
        if step.external_wait_reason != updated_step.external_wait_reason:
            self._record_history(
                updated_step.id,
                "detalle_espera",
                step.external_wait_reason,
                updated_step.external_wait_reason,
                "sistema",
            )
        if step.external_reference != updated_step.external_reference:
            self._record_history(
                updated_step.id,
                "referencia_externa",
                step.external_reference,
                updated_step.external_reference,
                "sistema",
            )
        if step.fecha_estado_actual != updated_step.fecha_estado_actual and step.estado == StepStatus.ESPERANDO_RESPUESTA:
            self._record_history(
                updated_step.id,
                "fecha_espera_desde",
                step.fecha_estado_actual,
                updated_step.fecha_estado_actual,
                "sistema",
            )
            self._sync_workflow_and_trigger_status(step.workflow_id, utc_now())

        return self.get_step(step_id)

    def update_step_date(self, step_id: str, payload: StepDateUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        self._ensure_reminder_not_past(payload.fecha_vencimiento)
        updated = step.model_copy(update={"fecha_vencimiento": payload.fecha_vencimiento})
        return self.repository.save_step(updated)

    def update_step_status(self, step_id: str, payload: StepStatusUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        previous_status = step.estado

        if payload.estado == StepStatus.COMPLETADO:
            raise BusinessRuleError("Usa el cierre dinamico para completar la tarea")

        if payload.estado == StepStatus.ACTIVO:
            raise BusinessRuleError("El estado en proceso no se modifica manualmente")

        if payload.estado not in {StepStatus.ESPERA, StepStatus.PROBLEMA}:
            raise BusinessRuleError("Solo se puede cambiar manualmente a espera o problema")

        if step.estado not in {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}:
            raise BusinessRuleError("Solo una tarea abierta puede cambiar de estado")

        if not payload.nota or len(payload.nota.strip()) < 3:
            raise BusinessRuleError("Todo cambio de estado debe incluir un comentario justificando el motivo")

        updated_step = step.model_copy(
            update={
                "estado": payload.estado,
                "fecha_estado_actual": utc_now(),
            }
        )
        self.repository.save_step(updated_step)
        self._record_history(
            updated_step.id,
            "estado",
            previous_status,
            payload.estado,
            payload.usuario,
            note=payload.nota,
            attachments=payload.attachments,
        )

        self._sync_workflow_and_trigger_status(step.workflow_id, utc_now())
        return self.get_step(step_id)

    def complete_step(self, step_id: str, payload: StepCompletePayload) -> StepInstancePublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        if step.estado not in OPEN_STEP_STATUSES:
            raise BusinessRuleError("Solo se puede completar una tarea abierta")

        now = utc_now()
        closing_note = self._resolve_closing_note(payload.resultado_cierre, payload.comentario)
        effective_transition = payload.transition_type
        effective_external_wait = payload.external_wait

        if (
            effective_transition == StepTransitionType.NEXT_TASK
            and payload.next_task is None
            and step.waits_for_external_response
        ):
            effective_transition = StepTransitionType.WAIT_EXTERNAL
            effective_external_wait = ExternalWaitInput(
                que_se_espera=step.expected_external_event or step.nombre,
                esperando_de=step.esperando_de,
                detalle=step.external_wait_reason,
                referencia_externa=step.external_reference,
                fecha_recordatorio=step.fecha_vencimiento,
            )

        if step.estado == StepStatus.ESPERANDO_RESPUESTA and effective_transition == StepTransitionType.WAIT_EXTERNAL:
            raise BusinessRuleError("La tarea ya esta esperando respuesta externa")

        if step.estado == StepStatus.ESPERANDO_RESPUESTA and effective_transition in {
            StepTransitionType.NEXT_TASK,
            StepTransitionType.FINISH_FLOW,
        }:
            events = self.repository.list_step_external_events(step.id)
            if not events:
                raise BusinessRuleError("Primero debes registrar una respuesta externa para continuar o finalizar")

        if effective_transition == StepTransitionType.WAIT_EXTERNAL:
            if effective_external_wait is None:
                raise BusinessRuleError("Debes indicar la informacion de espera externa")
            wait = effective_external_wait
            self._ensure_reminder_not_past(wait.fecha_recordatorio)
            wait_source = (wait.origen or "").strip() or "externo"
            wait_note = wait.detalle or f"Esperando respuesta de {wait_source}"
            updated_step = step.model_copy(
                update={
                    "estado": StepStatus.ESPERANDO_RESPUESTA,
                    "fecha_estado_actual": now,
                    "resultado": closing_note,
                    "observaciones": payload.observaciones,
                    "fecha_cierre": None,
                    "action_type": "wait_external",
                    "action_label": "Esperar respuesta externa",
                    "waits_for_external_response": True,
                    "expected_external_event": wait.que_se_espera,
                    "esperando_de": wait.esperando_de.strip() if isinstance(wait.esperando_de, str) else None,
                    "external_wait_reason": wait_note,
                    "external_reference": wait.referencia_externa,
                    "fecha_vencimiento": wait.fecha_recordatorio,
                }
            )
            self.repository.save_step(updated_step)
            self._record_history(
                updated_step.id,
                "estado",
                step.estado,
                StepStatus.ESPERANDO_RESPUESTA,
                payload.usuario,
                note=closing_note,
                attachments=payload.attachments,
            )
            self._record_history(
                updated_step.id,
                "espera_externa",
                None,
                wait.que_se_espera,
                payload.usuario,
                note=f"Esperando respuesta externa de {wait_source}. {wait_note}".strip(),
                attachments=wait.attachments,
            )
            self._sync_workflow_and_trigger_status(workflow.id, now)
            return updated_step

        if effective_transition == StepTransitionType.FINISH_FLOW:
            open_other_steps = [
                workflow_step
                for workflow_step in workflow.steps
                if workflow_step.id != step.id and workflow_step.estado in OPEN_STEP_STATUSES
            ]
            if open_other_steps:
                raise BusinessRuleError("No puedes finalizar el flow con otras tareas abiertas")

        updated_step = step.model_copy(
            update={
                "estado": StepStatus.COMPLETADO,
                "fecha_estado_actual": now,
                "resultado": closing_note,
                "observaciones": payload.observaciones,
                "fecha_cierre": now,
            }
        )
        self.repository.save_step(updated_step)
        self._record_history(
            updated_step.id,
            "estado",
            step.estado,
            StepStatus.COMPLETADO,
            payload.usuario,
            note=closing_note,
            attachments=payload.attachments,
        )
        if step.resultado != closing_note:
            self._record_history(updated_step.id, "resultado", step.resultado, closing_note, payload.usuario)
        if step.observaciones != payload.observaciones:
            self._record_history(updated_step.id, "observaciones", step.observaciones, payload.observaciones, payload.usuario)

        if effective_transition == StepTransitionType.NEXT_TASK:
            if payload.next_task is not None:
                self._ensure_reminder_not_past(payload.next_task.fecha_vencimiento)
                next_order = max((item.orden for item in workflow.steps), default=0) + 1
                next_step = self.repository.create_step(
                    workflow.id,
                    StepCreate(
                        nombre=payload.next_task.nombre,
                        descripcion=payload.next_task.descripcion,
                        tipo="manual",
                        requiere_aprobacion=False,
                        puede_tener_comentarios=True,
                        asignado_a=payload.next_task.asignado_a,
                        fecha_vencimiento=payload.next_task.fecha_vencimiento,
                        fecha_ejecucion_estimada=payload.next_task.fecha_ejecucion_estimada,
                        action_type="continue",
                        action_config=None,
                        action_label="Continuar flow",
                        waits_for_external_response=False,
                        expected_external_event=None,
                        external_wait_reason=None,
                        external_reference=None,
                    ),
                    next_order,
                    StepStatus.ACTIVO,
                    codigo=None,
                    depends_on=[],
                )
                self._record_history(
                    next_step.id,
                    "estado",
                    None,
                    StepStatus.ACTIVO,
                    payload.usuario,
                    note="Tarea creada desde cierre dinamico",
                )
                self._record_history(
                    updated_step.id,
                    "siguiente_tarea",
                    None,
                    next_step.nombre,
                    payload.usuario,
                    note=f"Se creo la proxima tarea: {next_step.nombre}",
                )
            else:
                self._activate_template_successors(workflow, updated_step, payload.usuario)

        if effective_transition == StepTransitionType.FINISH_FLOW:
            finish_note = payload.finish_data.resultado_final if payload.finish_data else None
            self._record_history(
                updated_step.id,
                "flow_cierre",
                None,
                workflow.id,
                payload.usuario,
                note=finish_note or "Flow finalizado desde cierre de tarea",
                attachments=payload.finish_data.attachments if payload.finish_data else [],
            )

        self._sync_workflow_and_trigger_status(workflow.id, now, force_finish=effective_transition == StepTransitionType.FINISH_FLOW)
        return updated_step

    def resolve_external_response(self, step_id: str, payload: ExternalResponseDecisionPayload) -> StepInstancePublic:
        complete_payload = StepCompletePayload(
            usuario=payload.usuario,
            resultado_cierre=payload.resultado_cierre,
            comentario=payload.comentario,
            observaciones=None,
            transition_type=payload.transition_type,
            next_task=payload.next_task,
            external_wait=None,
            finish_data=payload.finish_data,
            attachments=payload.attachments,
        )
        return self.complete_step(step_id, complete_payload)

    def add_comment(self, step_id: str, payload: CommentCreate) -> CommentPublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        if not step.puede_tener_comentarios:
            raise BusinessRuleError("Esta tarea no admite registros")
        return self.repository.add_comment(step_id, payload)

    def update_comment(self, step_id: str, comment_id: str, payload: CommentUpdate) -> CommentPublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        if not step.puede_tener_comentarios:
            raise BusinessRuleError("Esta tarea no admite registros")
        if step.estado in {StepStatus.COMPLETADO, StepStatus.CANCELADA}:
            raise BusinessRuleError("No se pueden editar registros en tareas completadas o canceladas")
        updated_comment = self.repository.update_comment(step_id, comment_id, payload)
        if updated_comment is None:
            raise EntityNotFoundError("Comment not found")
        return updated_comment

    def list_comments(self, step_id: str) -> list[CommentPublic]:
        self.get_step(step_id)
        return self.repository.list_comments(step_id)

    def list_history(self, step_id: str) -> list[StepHistoryPublic]:
        self.get_step(step_id)
        return self.repository.list_history(step_id)

    def list_pending_steps(self) -> list[StepInstancePublic]:
        return self.repository.list_pending_steps()

    def get_daily_board(self) -> DailyBoardResponse:
        pending = self.repository.list_pending_steps()
        workflows = self.repository.list_workflows()
        return DailyBoardResponse(
            tareas_activas=[step for step in pending if step.estado == StepStatus.ACTIVO],
            tareas_esperando_respuesta=[step for step in pending if step.estado == StepStatus.ESPERANDO_RESPUESTA],
            tareas_en_pausa=[step for step in pending if step.estado == StepStatus.ESPERA],
            tareas_con_problema=[step for step in pending if step.estado == StepStatus.PROBLEMA],
            flows_recientes=workflows[:8],
            flows_cerrados_recientes=[
                workflow
                for workflow in workflows
                if workflow.estado in {WorkflowStatus.FINALIZADO, WorkflowStatus.CANCELADO}
            ][:8],
        )

    def list_work_log_entries(self) -> list[WorkLogEntry]:
        return self.repository.list_work_log_entries()

    def list_step_external_events(self, step_id: str) -> list[ExternalEventPublic]:
        self.get_step(step_id)
        return self.repository.list_step_external_events(step_id)

    def list_workflow_external_events(self, workflow_id: str) -> list[ExternalEventPublic]:
        self.get_workflow(workflow_id)
        return self.repository.list_workflow_external_events(workflow_id)

    def register_external_event(self, step_id: str, payload: ExternalEventCreate) -> ExternalEventPublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        self._ensure_workflow_operable(workflow)
        if step.estado != StepStatus.ESPERANDO_RESPUESTA:
            raise BusinessRuleError("Solo puedes registrar respuesta externa en tareas esperando respuesta")

        now = utc_now()
        event = self.repository.add_external_event(step_id, payload)
        self._record_history(
            step.id,
            "evento_externo",
            None,
            payload.event_type,
            payload.registrado_por,
            note=payload.comentario or f"Evento externo recibido: {payload.event_type}",
            attachments=payload.attachments,
        )
        expected_event = (step.expected_external_event or "").strip()
        matches_expected_event = bool(expected_event) and payload.event_type.strip() == expected_event
        if matches_expected_event:
            completed_step = step.model_copy(
                update={
                    "estado": StepStatus.COMPLETADO,
                    "fecha_estado_actual": now,
                    "fecha_cierre": now,
                    "resultado": payload.comentario or step.resultado or expected_event,
                }
            )
            self.repository.save_step(completed_step)
            self._record_history(
                completed_step.id,
                "estado",
                step.estado,
                StepStatus.COMPLETADO,
                payload.registrado_por,
                note=payload.comentario or f"Respuesta externa esperada recibida: {payload.event_type}",
                attachments=payload.attachments,
            )
            self._activate_template_successors(workflow, completed_step, payload.registrado_por)

        self._sync_workflow_and_trigger_status(step.workflow_id, now)
        return event

    def _ensure_workflow_operable(self, workflow: WorkflowDetail | WorkflowSummary) -> None:
        if workflow.estado == WorkflowStatus.CANCELADO:
            raise BusinessRuleError("El flow está cancelado. Reactívalo para continuar operando tareas.")

    def _normalize_template_steps(self, template: WorkflowTemplatePublic) -> list[StepTemplatePublic]:
        ordered = sorted(template.steps, key=lambda item: (item.orden, item.codigo, item.id))
        if len(ordered) <= 1:
            return ordered

        all_empty_dependencies = all(len(step.depends_on) == 0 for step in ordered)
        order_values = [step.orden for step in ordered]
        strictly_increasing_orders = all(curr > prev for prev, curr in zip(order_values, order_values[1:]))
        unique_orders = len(set(order_values)) == len(order_values)

        if not (all_empty_dependencies and strictly_increasing_orders and unique_orders):
            return ordered

        normalized: list[StepTemplatePublic] = []
        previous_code: str | None = None
        for step in ordered:
            normalized_step = step.model_copy(update={"depends_on": [previous_code] if previous_code else []})
            normalized.append(normalized_step)
            previous_code = normalized_step.codigo
        return normalized

    def _activate_template_successors(
        self,
        workflow: WorkflowDetail,
        completed_step: StepInstancePublic,
        usuario: str,
    ) -> list[StepInstancePublic]:
        if not workflow.workflow_template_id or completed_step.codigo is None:
            return []

        template = self.repository.get_workflow_template(workflow.workflow_template_id)
        if template is None:
            return []

        template_steps = self._normalize_template_steps(template)
        existing_codes = {step.codigo for step in workflow.steps if step.codigo is not None}
        completed_codes = {
            step.codigo
            for step in workflow.steps
            if step.codigo is not None and (step.id == completed_step.id or step.estado == StepStatus.COMPLETADO)
        }

        created_steps: list[StepInstancePublic] = []
        for template_step in template_steps:
            if template_step.codigo in existing_codes:
                continue
            if not all(dependency in completed_codes for dependency in template_step.depends_on):
                continue

            created_step = self.repository.create_step(
                workflow.id,
                StepCreate(
                    nombre=template_step.nombre,
                    descripcion=template_step.descripcion,
                    tipo=template_step.tipo,
                    requiere_aprobacion=template_step.requiere_aprobacion,
                    puede_tener_comentarios=template_step.puede_tener_comentarios,
                    asignado_a=None,
                    fecha_vencimiento=None,
                    fecha_ejecucion_estimada=None,
                    action_type=template_step.action_type,
                    action_config=template_step.action_config,
                    action_label=template_step.action_label,
                    waits_for_external_response=template_step.waits_for_external_response,
                    expected_external_event=template_step.expected_external_event,
                    esperando_de=None,
                    external_wait_reason=template_step.external_wait_reason,
                    external_reference=template_step.external_reference,
                ),
                template_step.orden,
                StepStatus.ACTIVO,
                codigo=template_step.codigo,
                depends_on=template_step.depends_on,
            )
            self._record_history(
                created_step.id,
                "estado",
                None,
                StepStatus.ACTIVO,
                usuario,
                note="Tarea activada por la plantilla del flow",
            )
            created_steps.append(created_step)
            existing_codes.add(template_step.codigo)

        return created_steps

    def _sync_workflow_and_trigger_status(self, workflow_id: str, now: datetime, *, force_finish: bool = False) -> None:
        workflow = self.get_workflow(workflow_id)
        active_steps = [step for step in workflow.steps if step.estado == StepStatus.ACTIVO]
        waiting_external_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERANDO_RESPUESTA]
        paused_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERA]
        problem_steps = [step for step in workflow.steps if step.estado == StepStatus.PROBLEMA]
        open_steps = [step for step in workflow.steps if step.estado in OPEN_STEP_STATUSES]
        active_orders = sorted(step.orden for step in open_steps)
        waiting_since = min(
            (step.fecha_estado_actual for step in waiting_external_steps if step.fecha_estado_actual is not None),
            default=None,
        )

        if force_finish:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.FINALIZADO,
                    "pasos_activos": [],
                    "paso_actual": None,
                    "fecha_fin": now,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )
        elif active_steps:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.EN_PROCESO,
                    "pasos_activos": active_orders,
                    "paso_actual": active_orders[0] if active_orders else None,
                    "fecha_fin": None,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )
        elif waiting_external_steps:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.ESPERANDO_RESPUESTA,
                    "pasos_activos": active_orders,
                    "paso_actual": active_orders[0] if active_orders else None,
                    "fecha_fin": None,
                    "fecha_espera_desde": waiting_since,
                    "total_pasos": len(workflow.steps),
                }
            )
        elif paused_steps:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.EN_ESPERA,
                    "pasos_activos": active_orders,
                    "paso_actual": active_orders[0] if active_orders else None,
                    "fecha_fin": None,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )
        elif problem_steps:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.CON_PROBLEMA,
                    "pasos_activos": active_orders,
                    "paso_actual": active_orders[0] if active_orders else None,
                    "fecha_fin": None,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )
        elif workflow.steps and all(step.estado == StepStatus.COMPLETADO for step in workflow.steps):
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.FINALIZADO,
                    "pasos_activos": [],
                    "paso_actual": None,
                    "fecha_fin": now,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )
        else:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.PENDIENTE,
                    "pasos_activos": [],
                    "paso_actual": None,
                    "fecha_fin": None,
                    "fecha_espera_desde": None,
                    "total_pasos": len(workflow.steps),
                }
            )

        self.repository.save_workflow(workflow_update)
        requirement_ids = self._collect_requirement_ids(workflow)
        for requirement_id in requirement_ids:
            self._reconcile_trigger_status(requirement_id, now, preferred_workflow_id=workflow.id)

    def _reconcile_trigger_status(
        self,
        trigger_id: str,
        now: datetime,
        *,
        preferred_workflow_id: str | None = None,
    ) -> None:
        trigger = self.get_trigger(trigger_id)
        if trigger.estado_general == TriggerStatus.CANCELADO:
            return

        workflows: list[WorkflowDetail] = []
        for workflow_id in trigger.workflow_ids:
            workflow = self.repository.get_workflow(workflow_id)
            if workflow is None:
                continue
            workflows.append(workflow)

        if not workflows:
            trigger_update = trigger.model_copy(
                update={"estado_general": TriggerStatus.SIN_FLOWS, "fecha_actualizacion": now, "workflow_activo_id": None}
            )
        else:
            selected_workflow_id = preferred_workflow_id
            if not selected_workflow_id or all(item.id != selected_workflow_id for item in workflows):
                selected_workflow_id = max(workflows, key=lambda item: item.fecha_inicio).id

            if any(workflow.estado == WorkflowStatus.CON_PROBLEMA for workflow in workflows):
                next_status = TriggerStatus.CON_PROBLEMA
            elif any(workflow.estado == WorkflowStatus.EN_PROCESO for workflow in workflows):
                next_status = TriggerStatus.EN_PROCESO
            elif any(workflow.estado == WorkflowStatus.EN_ESPERA for workflow in workflows):
                next_status = TriggerStatus.EN_PROCESO
            else:
                open_workflows = [workflow for workflow in workflows if workflow.estado in WORKFLOW_OPEN_STATUSES]
                if open_workflows and all(
                    workflow.estado == WorkflowStatus.ESPERANDO_RESPUESTA for workflow in open_workflows
                ):
                    next_status = TriggerStatus.ESPERANDO_RESPUESTA
                elif all(workflow.estado in {WorkflowStatus.FINALIZADO, WorkflowStatus.CANCELADO} for workflow in workflows):
                    next_status = TriggerStatus.RESUELTO
                else:
                    next_status = TriggerStatus.EN_PROCESO

            trigger_update = trigger.model_copy(
                update={
                    "estado_general": next_status,
                    "fecha_actualizacion": now,
                    "workflow_activo_id": selected_workflow_id if next_status != TriggerStatus.RESUELTO else None,
                }
            )
        self.repository.save_trigger(trigger_update)

    def _resolve_closing_note(self, resultado_cierre: str | None, comentario: str | None) -> str:
        note = (resultado_cierre or comentario or "").strip()
        if len(note) < 3:
            raise BusinessRuleError("Debes registrar el resultado de cierre de la tarea")
        return note

    def _record_history(
        self,
        step_id: str,
        campo: str,
        valor_anterior: object,
        valor_nuevo: object,
        usuario: str,
        note: str | None = None,
        attachments: list[AttachmentBase] | None = None,
    ) -> None:
        history = StepHistoryPublic(
            id=str(uuid4()),
            step_instance_id=step_id,
            campo=campo,
            valor_anterior=self._serialize_history_value(valor_anterior),
            valor_nuevo=self._serialize_history_value(valor_nuevo),
            usuario=usuario,
            fecha=utc_now(),
            nota=note,
            attachments=[
                {
                    "id": str(uuid4()),
                    "nombre": item.nombre,
                    "content_type": item.content_type,
                    "size_bytes": item.size_bytes,
                    "content_base64": item.content_base64,
                }
                for item in (attachments or [])
            ],
        )
        self.repository.add_history(history)

    def _serialize_history_value(self, value: object) -> str | None:
        if value is None:
            return None
        if hasattr(value, "value"):
            return str(getattr(value, "value"))
        if hasattr(value, "astimezone"):
            return value.astimezone(timezone.utc).isoformat()  # type: ignore[union-attr]
        return str(value)

    def _collect_requirement_ids(self, workflow: WorkflowDetail | WorkflowSummary) -> list[str]:
        ids: list[str] = []
        if workflow.trigger_id:
            ids.append(workflow.trigger_id)
        ids.extend(workflow.requirement_ids)
        return list(dict.fromkeys(ids))
