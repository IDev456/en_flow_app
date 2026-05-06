from datetime import datetime, timezone
from uuid import uuid4

from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.repositories.workflow_repository import WorkflowRepository, utc_now
from app.schemas.workflow import (
    AttachmentBase,
    CommentCreate,
    CommentPublic,
    DailyBoardResponse,
    ExternalResponseDecisionPayload,
    ExternalEventCreate,
    ExternalEventPublic,
    QuickCaptureRequest,
    RequirementCreateFromFlowPayload,
    StepCompletePayload,
    StepCreate,
    StepHistoryPublic,
    StepInstancePublic,
    StepUpdate,
    StepStatus,
    StepTransitionType,
    StepStatusUpdate,
    TriggerCreate,
    TriggerDetail,
    TriggerPublic,
    TriggerUpdate,
    TriggerStatus,
    WorkflowDetail,
    WorkflowStartRequest,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowTemplatePublic,
    WorkflowUpdate,
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
        if "solicitante" in patch_data:
            update_data["solicitante"] = patch_data["solicitante"]
        if "descripcion" in patch_data:
            update_data["descripcion"] = patch_data["descripcion"]
        if "tipo" in patch_data:
            update_data["tipo"] = patch_data["tipo"]
        if "metadata" in patch_data:
            update_data["metadata"] = patch_data["metadata"]

        updated_trigger = trigger.model_copy(
            update=update_data
        )
        self.repository.save_trigger(updated_trigger)
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

        if not payload.primer_paso.nombre.strip():
            raise BusinessRuleError("La tarea inicial es obligatoria para iniciar el flow")

        template = (
            self.repository.get_workflow_template(payload.workflow_template_id)
            if payload.workflow_template_id
            else self.repository.get_default_workflow_template()
        )
        if template is None:
            raise EntityNotFoundError("Workflow template not found")

        workflow = self.repository.create_workflow(trigger_id, template, payload)
        self._reconcile_trigger_status(trigger_id, utc_now(), preferred_workflow_id=workflow.id)
        return workflow

    def quick_capture_flow(self, payload: QuickCaptureRequest) -> WorkflowDetail:
        template = self.repository.get_default_workflow_template()
        workflow = self.repository.create_workflow(
            None,
            template,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                objetivo_final=payload.titulo.strip(),
                resolucion_esperada=None,
                primer_paso={
                    "nombre": payload.titulo.strip(),
                    "descripcion": payload.detalle,
                    "asignado_a": payload.asignado_a,
                    "fecha_vencimiento": payload.fecha_vencimiento,
                },
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

        if "objetivo_final" in patch_data:
            next_title = (patch_data["objetivo_final"] or "").strip()
            if not next_title:
                raise BusinessRuleError("El nombre del flow es obligatorio")
            update_data["objetivo_final"] = next_title

        if not update_data:
            raise BusinessRuleError("No hay cambios para guardar")

        updated_workflow = workflow.model_copy(update=update_data)
        self.repository.save_workflow(updated_workflow)
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

    def get_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        workflow = self.get_workflow(workflow_id)
        return workflow.steps

    def link_workflow_to_requirement(self, workflow_id: str, requirement_id: str) -> WorkflowDetail:
        workflow = self.get_workflow(workflow_id)
        requirement = self.get_trigger(requirement_id)
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
        requirement = self.create_trigger(
            TriggerCreate(
                solicitante=payload.solicitante,
                descripcion=payload.descripcion,
                tipo="requerimiento",
                creado_por=payload.creado_por,
                metadata=None,
            )
        )
        self.repository.link_requirement_to_workflow(requirement.id, workflow.id)
        self._reconcile_trigger_status(requirement.id, utc_now(), preferred_workflow_id=workflow.id)
        return self.get_trigger(requirement.id)

    def create_workflow_step(self, workflow_id: str, payload: StepCreate) -> StepInstancePublic:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado == WorkflowStatus.FINALIZADO:
            raise BusinessRuleError("No se pueden agregar tareas a un flow finalizado")

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
        patch_data = payload.model_dump(exclude_unset=True)
        update_data: dict[str, object] = {}

        if "nombre" in patch_data:
            next_name = (patch_data["nombre"] or "").strip()
            if not next_name:
                raise BusinessRuleError("El nombre de la tarea es obligatorio")
            update_data["nombre"] = next_name

        if "descripcion" in patch_data:
            next_description = patch_data["descripcion"]
            update_data["descripcion"] = next_description.strip() if isinstance(next_description, str) else None

        if not update_data:
            raise BusinessRuleError("No hay cambios para guardar")

        updated_step = step.model_copy(update=update_data)
        self.repository.save_step(updated_step)

        if step.nombre != updated_step.nombre:
            self._record_history(updated_step.id, "nombre", step.nombre, updated_step.nombre, "sistema")
        if step.descripcion != updated_step.descripcion:
            self._record_history(updated_step.id, "descripcion", step.descripcion, updated_step.descripcion, "sistema")

        return self.get_step(step_id)

    def update_step_status(self, step_id: str, payload: StepStatusUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
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
        if step.estado not in OPEN_STEP_STATUSES:
            raise BusinessRuleError("Solo se puede completar una tarea abierta")

        workflow = self.get_workflow(step.workflow_id)
        now = utc_now()
        closing_note = self._resolve_closing_note(payload.resultado_cierre, payload.comentario)

        if step.estado == StepStatus.ESPERANDO_RESPUESTA and payload.transition_type == StepTransitionType.WAIT_EXTERNAL:
            raise BusinessRuleError("La tarea ya esta esperando respuesta externa")

        if step.estado == StepStatus.ESPERANDO_RESPUESTA and payload.transition_type in {
            StepTransitionType.NEXT_TASK,
            StepTransitionType.FINISH_FLOW,
        }:
            events = self.repository.list_step_external_events(step.id)
            if not events:
                raise BusinessRuleError("Primero debes registrar una respuesta externa para continuar o finalizar")

        if payload.transition_type == StepTransitionType.WAIT_EXTERNAL:
            if payload.external_wait is None:
                raise BusinessRuleError("Debes indicar la informacion de espera externa")
            wait = payload.external_wait
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
                    "external_wait_reason": wait_note,
                    "external_reference": wait.referencia_externa,
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

        if payload.transition_type == StepTransitionType.FINISH_FLOW:
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

        if payload.transition_type == StepTransitionType.NEXT_TASK:
            if payload.next_task is None:
                raise BusinessRuleError("Debes indicar la proxima tarea")
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
            self._record_history(next_step.id, "estado", None, StepStatus.ACTIVO, payload.usuario, note="Tarea creada desde cierre dinamico")
            self._record_history(
                updated_step.id,
                "siguiente_tarea",
                None,
                next_step.nombre,
                payload.usuario,
                note=f"Se creo la proxima tarea: {next_step.nombre}",
            )

        if payload.transition_type == StepTransitionType.FINISH_FLOW:
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

        self._sync_workflow_and_trigger_status(workflow.id, now, force_finish=payload.transition_type == StepTransitionType.FINISH_FLOW)
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
        if not step.puede_tener_comentarios:
            raise BusinessRuleError("Esta tarea no admite registros")
        return self.repository.add_comment(step_id, payload)

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

    def list_step_external_events(self, step_id: str) -> list[ExternalEventPublic]:
        self.get_step(step_id)
        return self.repository.list_step_external_events(step_id)

    def list_workflow_external_events(self, workflow_id: str) -> list[ExternalEventPublic]:
        self.get_workflow(workflow_id)
        return self.repository.list_workflow_external_events(workflow_id)

    def register_external_event(self, step_id: str, payload: ExternalEventCreate) -> ExternalEventPublic:
        step = self.get_step(step_id)
        if step.estado != StepStatus.ESPERANDO_RESPUESTA:
            raise BusinessRuleError("Solo puedes registrar respuesta externa en tareas esperando respuesta")

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
        self._sync_workflow_and_trigger_status(step.workflow_id, utc_now())
        return event

    def _sync_workflow_and_trigger_status(self, workflow_id: str, now: datetime, *, force_finish: bool = False) -> None:
        workflow = self.get_workflow(workflow_id)
        active_steps = [step for step in workflow.steps if step.estado == StepStatus.ACTIVO]
        waiting_external_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERANDO_RESPUESTA]
        paused_steps = [step for step in workflow.steps if step.estado == StepStatus.ESPERA]
        problem_steps = [step for step in workflow.steps if step.estado == StepStatus.PROBLEMA]
        open_steps = [step for step in workflow.steps if step.estado in OPEN_STEP_STATUSES]
        active_orders = sorted(step.orden for step in open_steps)

        if force_finish:
            workflow_update = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.FINALIZADO,
                    "pasos_activos": [],
                    "paso_actual": None,
                    "fecha_fin": now,
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
