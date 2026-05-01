from datetime import timezone
from uuid import uuid4

from app.core.errors import BusinessRuleError, EntityNotFoundError
from app.repositories.workflow_repository import WorkflowRepository, utc_now
from app.schemas.workflow import (
    CommentCreate,
    CommentPublic,
    StepCompletePayload,
    StepCreate,
    StepHistoryPublic,
    StepInstancePublic,
    StepStatus,
    StepStatusUpdate,
    TriggerCreate,
    TriggerDetail,
    TriggerPublic,
    TriggerStatus,
    WorkflowDetail,
    WorkflowStartRequest,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowTemplatePublic,
)


class WorkflowService:
    def __init__(self, repository: WorkflowRepository) -> None:
        self.repository = repository

    def list_triggers(self) -> list[TriggerPublic]:
        return self.repository.list_triggers()

    def get_trigger(self, trigger_id: str) -> TriggerDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")
        return trigger

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        return self.repository.create_trigger(payload)

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        return self.repository.list_workflow_templates()

    def start_workflow(self, trigger_id: str, payload: WorkflowStartRequest) -> WorkflowDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")

        active_workflow = self._find_open_workflow(trigger.workflow_ids)
        if active_workflow is not None:
            raise BusinessRuleError("El trigger ya tiene un workflow activo")

        template = (
            self.repository.get_workflow_template(payload.workflow_template_id)
            if payload.workflow_template_id
            else self.repository.get_default_workflow_template()
        )
        if template is None:
            raise EntityNotFoundError("Workflow template not found")

        workflow = self.repository.create_workflow(trigger_id, template, payload)
        updated_trigger = trigger.model_copy(
            update={
                "estado_general": TriggerStatus.EN_PROCESO,
                "fecha_actualizacion": utc_now(),
                "workflow_activo_id": workflow.id,
            }
        )
        self.repository.save_trigger(updated_trigger)
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

    def get_workflow_steps(self, workflow_id: str) -> list[StepInstancePublic]:
        workflow = self.get_workflow(workflow_id)
        return workflow.steps

    def create_workflow_step(self, workflow_id: str, payload: StepCreate) -> StepInstancePublic:
        workflow = self.get_workflow(workflow_id)
        if workflow.estado == WorkflowStatus.FINALIZADO:
            raise BusinessRuleError("No se pueden agregar pasos a un workflow finalizado")

        steps = workflow.steps
        next_order = max((step.orden for step in steps), default=0) + 1
        return self.repository.create_step(workflow_id, payload, next_order)

    def get_step(self, step_id: str) -> StepInstancePublic:
        step = self.repository.get_step(step_id)
        if step is None:
            raise EntityNotFoundError("Step not found")
        return step

    def update_step_status(self, step_id: str, payload: StepStatusUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
        workflow = self.get_workflow(step.workflow_id)
        previous_status = step.estado

        if payload.estado == StepStatus.COMPLETADO:
            raise BusinessRuleError("Usa el endpoint de completar paso para cerrar un step")

        if payload.estado == StepStatus.ACTIVO:
            self._ensure_can_activate(workflow.steps, step)
        elif payload.estado == StepStatus.EN_REVISION:
            if step.estado != StepStatus.ACTIVO:
                raise BusinessRuleError("Solo un step activo puede pasar a revision")
        elif payload.estado == StepStatus.PENDIENTE:
            raise BusinessRuleError("No se puede volver manualmente a pendiente")

        now = utc_now()
        updated_step = step.model_copy(
            update={
                "estado": payload.estado,
                "fecha_inicio": now if payload.estado == StepStatus.ACTIVO and step.fecha_inicio is None else step.fecha_inicio,
            }
        )
        self.repository.save_step(updated_step)
        self._record_history(updated_step.id, "estado", previous_status, payload.estado, payload.usuario)

        if payload.estado == StepStatus.ACTIVO:
            updated_workflow = workflow.model_copy(update={"paso_actual": updated_step.orden, "estado": WorkflowStatus.EN_PROCESO})
            self.repository.save_workflow(updated_workflow)

        return updated_step

    def complete_step(self, step_id: str, payload: StepCompletePayload) -> StepInstancePublic:
        step = self.get_step(step_id)
        if step.estado not in {StepStatus.ACTIVO, StepStatus.EN_REVISION}:
            raise BusinessRuleError("Solo se puede completar un step activo o en revision")

        workflow = self.get_workflow(step.workflow_id)
        trigger = self.get_trigger(workflow.trigger_id)
        now = utc_now()

        completed_step = step.model_copy(
            update={
                "estado": StepStatus.COMPLETADO,
                "resultado": payload.resultado,
                "observaciones": payload.observaciones,
                "fecha_cierre": now,
            }
        )
        self.repository.save_step(completed_step)
        self._record_history(completed_step.id, "estado", step.estado, StepStatus.COMPLETADO, payload.usuario)

        if step.resultado != payload.resultado:
            self._record_history(completed_step.id, "resultado", step.resultado, payload.resultado, payload.usuario)
        if step.observaciones != payload.observaciones:
            self._record_history(completed_step.id, "observaciones", step.observaciones, payload.observaciones, payload.usuario)

        if payload.comentario_final:
            self.add_comment(
                step_id,
                CommentCreate(autor=payload.usuario, comentario=payload.comentario_final),
            )

        ordered_steps = sorted(
            [completed_step if item.id == completed_step.id else item for item in workflow.steps],
            key=lambda item: item.orden,
        )
        next_step = next((item for item in ordered_steps if item.orden > step.orden), None)

        if next_step is not None:
            self._ensure_previous_step_completed(ordered_steps, next_step)
            activated_step = next_step.model_copy(
                update={
                    "estado": StepStatus.ACTIVO,
                    "fecha_inicio": next_step.fecha_inicio or now,
                }
            )
            self.repository.save_step(activated_step)
            self._record_history(activated_step.id, "estado", next_step.estado, StepStatus.ACTIVO, payload.usuario)

            updated_workflow = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.EN_PROCESO,
                    "paso_actual": activated_step.orden,
                }
            )
            self.repository.save_workflow(updated_workflow)

            updated_trigger = trigger.model_copy(
                update={
                    "estado_general": TriggerStatus.EN_PROCESO,
                    "fecha_actualizacion": now,
                    "workflow_activo_id": workflow.id,
                }
            )
            self.repository.save_trigger(updated_trigger)
        else:
            updated_workflow = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.FINALIZADO,
                    "paso_actual": None,
                    "fecha_fin": now,
                }
            )
            self.repository.save_workflow(updated_workflow)
            updated_trigger = trigger.model_copy(
                update={
                    "estado_general": TriggerStatus.RESUELTO,
                    "fecha_actualizacion": now,
                    "workflow_activo_id": None,
                }
            )
            self.repository.save_trigger(updated_trigger)

        return completed_step

    def add_comment(self, step_id: str, payload: CommentCreate) -> CommentPublic:
        step = self.get_step(step_id)
        if not step.puede_tener_comentarios:
            raise BusinessRuleError("Este step no admite comentarios")
        return self.repository.add_comment(step_id, payload)

    def list_comments(self, step_id: str) -> list[CommentPublic]:
        self.get_step(step_id)
        return self.repository.list_comments(step_id)

    def list_history(self, step_id: str) -> list[StepHistoryPublic]:
        self.get_step(step_id)
        return self.repository.list_history(step_id)

    def list_pending_steps(self) -> list[StepInstancePublic]:
        return self.repository.list_pending_steps()

    def _find_open_workflow(self, workflow_ids: list[str]) -> WorkflowSummary | None:
        for workflow_id in workflow_ids:
            workflow = self.repository.get_workflow(workflow_id)
            if workflow and workflow.estado in {WorkflowStatus.PENDIENTE, WorkflowStatus.EN_PROCESO}:
                return workflow
        return None

    def _ensure_previous_step_completed(self, steps: list[StepInstancePublic], step_to_activate: StepInstancePublic) -> None:
        previous_step = next((step for step in steps if step.orden == step_to_activate.orden - 1), None)
        if previous_step and previous_step.estado != StepStatus.COMPLETADO:
            raise BusinessRuleError("No se puede activar un step si el anterior no fue completado")

    def _ensure_can_activate(self, steps: list[StepInstancePublic], step_to_activate: StepInstancePublic) -> None:
        self._ensure_previous_step_completed(steps, step_to_activate)
        concurrent_step = next(
            (
                step
                for step in steps
                if step.id != step_to_activate.id and step.estado in {StepStatus.ACTIVO, StepStatus.EN_REVISION}
            ),
            None,
        )
        if concurrent_step is not None:
            raise BusinessRuleError("Solo puede haber un step activo o en revision al mismo tiempo")

    def _record_history(
        self,
        step_id: str,
        campo: str,
        valor_anterior: object,
        valor_nuevo: object,
        usuario: str,
    ) -> None:
        history = StepHistoryPublic(
            id=str(uuid4()),
            step_instance_id=step_id,
            campo=campo,
            valor_anterior=self._serialize_history_value(valor_anterior),
            valor_nuevo=self._serialize_history_value(valor_nuevo),
            usuario=usuario,
            fecha=utc_now(),
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
