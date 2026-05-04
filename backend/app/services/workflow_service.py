from datetime import datetime, timezone
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

OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}


class WorkflowService:
    def __init__(self, repository: WorkflowRepository) -> None:
        self.repository = repository

    def list_triggers(self) -> list[TriggerDetail]:
        return self.repository.list_triggers()

    def get_trigger(self, trigger_id: str) -> TriggerDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")
        return trigger

    def create_trigger(self, payload: TriggerCreate) -> TriggerPublic:
        return self.repository.create_trigger(payload)

    def delete_trigger(self, trigger_id: str) -> None:
        deleted = self.repository.delete_trigger(trigger_id)
        if not deleted:
            raise EntityNotFoundError("Trigger not found")

    def list_workflow_templates(self) -> list[WorkflowTemplatePublic]:
        return self.repository.list_workflow_templates()

    def start_workflow(self, trigger_id: str, payload: WorkflowStartRequest) -> WorkflowDetail:
        trigger = self.repository.get_trigger(trigger_id)
        if trigger is None:
            raise EntityNotFoundError("Trigger not found")

        if not payload.primer_paso.nombre.strip():
            raise BusinessRuleError("El primer paso es obligatorio para iniciar el workflow")

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
        created_step = self.repository.create_step(
            workflow_id,
            payload,
            next_order,
            StepStatus.ACTIVO,
            codigo=f"manual_{created_step_id_suffix()}",
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
        self._reconcile_trigger_status(workflow.trigger_id, utc_now(), preferred_workflow_id=workflow.id)
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
            attachments=payload.attachments,
        )

        return updated_step

    def complete_step(self, step_id: str, payload: StepCompletePayload) -> StepInstancePublic:
        step = self.get_step(step_id)
        if step.estado not in OPEN_STEP_STATUSES:
            raise BusinessRuleError("Solo se puede completar un step abierto")

        if len(payload.comentario.strip()) < 3:
            raise BusinessRuleError("Completar un paso requiere un comentario justificando el cierre")

        workflow = self.get_workflow(step.workflow_id)
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
            attachments=payload.attachments,
        )

        if step.resultado != payload.resultado:
            self._record_history(completed_step.id, "resultado", step.resultado, payload.resultado, payload.usuario)
        if step.observaciones != payload.observaciones:
            self._record_history(completed_step.id, "observaciones", step.observaciones, payload.observaciones, payload.usuario)

        self._activate_available_steps(workflow.id, payload.usuario)
        self._sync_workflow_and_trigger_status(workflow.id, now)

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

    def _activate_available_steps(self, workflow_id: str, actor: str) -> list[StepInstancePublic]:
        workflow = self.get_workflow(workflow_id)
        template = self.repository.get_workflow_template(workflow.workflow_template_id)
        if template is None:
            raise EntityNotFoundError("Workflow template not found")

        existing_steps = workflow.steps
        existing_by_code = {
            step.codigo: step
            for step in existing_steps
            if step.codigo is not None
        }
        completed_codes = {
            step.codigo
            for step in existing_steps
            if step.codigo is not None and step.estado == StepStatus.COMPLETADO
        }
        created_steps: list[StepInstancePublic] = []

        for template_step in sorted(template.steps, key=lambda item: (item.orden, item.codigo, item.id)):
            if template_step.codigo in existing_by_code:
                continue
            if not set(template_step.depends_on).issubset(completed_codes):
                continue

            step_payload = StepCreate(
                nombre=template_step.nombre,
                descripcion=template_step.descripcion,
                tipo=template_step.tipo,
                requiere_aprobacion=template_step.requiere_aprobacion,
                puede_tener_comentarios=template_step.puede_tener_comentarios,
                asignado_a=None,
                fecha_vencimiento=None,
            )
            created_step = self.repository.create_step(
                workflow_id,
                step_payload,
                template_step.orden,
                StepStatus.ACTIVO,
                step_template_id=template_step.id,
                codigo=template_step.codigo,
                depends_on=template_step.depends_on,
            )
            self._record_history(created_step.id, "estado", None, StepStatus.ACTIVO, actor)
            created_steps.append(created_step)
            existing_by_code[template_step.codigo] = created_step
            completed_codes = {
                step.codigo
                for step in [*existing_steps, *created_steps]
                if step.codigo is not None and step.estado == StepStatus.COMPLETADO
            }

        return created_steps

    def _sync_workflow_and_trigger_status(self, workflow_id: str, now: datetime) -> None:
        workflow = self.get_workflow(workflow_id)
        template = self.repository.get_workflow_template(workflow.workflow_template_id)
        if template is None:
            raise EntityNotFoundError("Workflow template not found")

        open_steps = [step for step in workflow.steps if step.estado in OPEN_STEP_STATUSES]
        active_orders = sorted(step.orden for step in open_steps)
        template_codes = {step.codigo for step in template.steps}
        completed_template_codes = {
            step.codigo
            for step in workflow.steps
            if step.codigo in template_codes and step.estado == StepStatus.COMPLETADO
        }
        all_template_steps_completed = template_codes.issubset(completed_template_codes)

        if all_template_steps_completed and not open_steps:
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
                    "estado": WorkflowStatus.EN_PROCESO if open_steps else WorkflowStatus.PENDIENTE,
                    "pasos_activos": active_orders,
                    "paso_actual": active_orders[0] if active_orders else None,
                    "fecha_fin": None,
                    "total_pasos": len(workflow.steps),
                }
            )

        self.repository.save_workflow(workflow_update)
        self._reconcile_trigger_status(workflow.trigger_id, now, preferred_workflow_id=workflow.id)

    def _reconcile_trigger_status(
        self,
        trigger_id: str,
        now: datetime,
        *,
        preferred_workflow_id: str | None = None,
    ) -> None:
        trigger = self.get_trigger(trigger_id)
        open_workflows: list[WorkflowDetail] = []
        for workflow_id in trigger.workflow_ids:
            workflow = self.repository.get_workflow(workflow_id)
            if workflow is None:
                continue
            if workflow.estado in {WorkflowStatus.PENDIENTE, WorkflowStatus.EN_PROCESO}:
                open_workflows.append(workflow)

        if open_workflows:
            selected_workflow_id = preferred_workflow_id
            if not selected_workflow_id or all(item.id != selected_workflow_id for item in open_workflows):
                selected_workflow_id = max(open_workflows, key=lambda item: item.fecha_inicio).id
            trigger_update = trigger.model_copy(
                update={
                    "estado_general": TriggerStatus.EN_PROCESO,
                    "fecha_actualizacion": now,
                    "workflow_activo_id": selected_workflow_id,
                }
            )
        else:
            trigger_update = trigger.model_copy(
                update={
                    "estado_general": TriggerStatus.RESUELTO,
                    "fecha_actualizacion": now,
                    "workflow_activo_id": None,
                }
            )
        self.repository.save_trigger(trigger_update)

    def _record_history(
        self,
        step_id: str,
        campo: str,
        valor_anterior: object,
        valor_nuevo: object,
        usuario: str,
        note: str | None = None,
        attachments: list | None = None,
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


def created_step_id_suffix() -> str:
    return str(uuid4()).split("-", maxsplit=1)[0]
