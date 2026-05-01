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

        if not payload.primer_paso.nombre.strip():
            raise BusinessRuleError("El primer paso es obligatorio para iniciar el workflow")

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

        current_open_step = next(
            (step for step in workflow.steps if step.estado in {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}),
            None,
        )
        if current_open_step is not None:
            raise BusinessRuleError("No se puede crear un nuevo paso mientras el actual no este completado")

        steps = workflow.steps
        next_order = max((step.orden for step in steps), default=0) + 1
        created_step = self.repository.create_step(workflow_id, payload, next_order, StepStatus.ACTIVO)
        updated_workflow = workflow.model_copy(
            update={
                "estado": WorkflowStatus.EN_PROCESO,
                "paso_actual": created_step.orden,
                "total_pasos": max(workflow.total_pasos, created_step.orden),
            }
        )
        self.repository.save_workflow(updated_workflow)
        self._record_history(created_step.id, "estado", None, StepStatus.ACTIVO, "sistema")
        return created_step

    def get_step(self, step_id: str) -> StepInstancePublic:
        step = self.repository.get_step(step_id)
        if step is None:
            raise EntityNotFoundError("Step not found")
        return step

    def update_step_status(self, step_id: str, payload: StepStatusUpdate) -> StepInstancePublic:
        step = self.get_step(step_id)
        previous_status = step.estado

        if payload.estado == StepStatus.COMPLETADO:
            raise BusinessRuleError("Usa el endpoint de completar paso para cerrar un step")

        if payload.estado == StepStatus.ACTIVO:
            raise BusinessRuleError("El estado en proceso no se modifica manualmente")

        if payload.estado not in {StepStatus.ESPERA, StepStatus.PROBLEMA}:
            raise BusinessRuleError("Solo se puede cambiar manualmente a espera o problema")

        if step.estado not in {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}:
            raise BusinessRuleError("Solo un step abierto puede cambiar de estado")

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
        )

        return updated_step

    def complete_step(self, step_id: str, payload: StepCompletePayload) -> StepInstancePublic:
        step = self.get_step(step_id)
        if step.estado not in {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}:
            raise BusinessRuleError("Solo se puede completar un step abierto")

        if len(payload.comentario.strip()) < 3:
            raise BusinessRuleError("Completar un paso requiere un comentario justificando el cierre")

        has_next_step = payload.siguiente_paso is not None
        if payload.finalizar_workflow == has_next_step:
            raise BusinessRuleError("Debes definir el siguiente paso o indicar que el workflow finaliza")

        workflow = self.get_workflow(step.workflow_id)
        trigger = self.get_trigger(workflow.trigger_id)
        now = utc_now()

        completed_step = step.model_copy(
            update={
                "estado": StepStatus.COMPLETADO,
                "fecha_estado_actual": now,
                "resultado": payload.resultado,
                "observaciones": payload.observaciones,
                "fecha_cierre": now,
            }
        )
        self.repository.save_step(completed_step)
        self._record_history(
            completed_step.id,
            "estado",
            step.estado,
            StepStatus.COMPLETADO,
            payload.usuario,
            note=payload.comentario.strip(),
        )

        if step.resultado != payload.resultado:
            self._record_history(completed_step.id, "resultado", step.resultado, payload.resultado, payload.usuario)
        if step.observaciones != payload.observaciones:
            self._record_history(completed_step.id, "observaciones", step.observaciones, payload.observaciones, payload.usuario)

        if payload.siguiente_paso is not None:
            next_order = max((item.orden for item in workflow.steps), default=0) + 1
            next_step = self.repository.create_step(
                workflow.id,
                payload.siguiente_paso,
                next_order,
                StepStatus.ACTIVO,
            )
            self._record_history(next_step.id, "estado", None, StepStatus.ACTIVO, payload.usuario)
            updated_workflow = workflow.model_copy(
                update={
                    "estado": WorkflowStatus.EN_PROCESO,
                    "paso_actual": next_step.orden,
                    "total_pasos": len(workflow.steps) + 1,
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
                    "total_pasos": len(workflow.steps),
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
                if step.id != step_to_activate.id and step.estado in {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}
            ),
            None,
        )
        if concurrent_step is not None:
            raise BusinessRuleError("Solo puede haber un step abierto al mismo tiempo")

    def _record_history(
        self,
        step_id: str,
        campo: str,
        valor_anterior: object,
        valor_nuevo: object,
        usuario: str,
        note: str | None = None,
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
