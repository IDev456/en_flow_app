import unittest
from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker

import app.repositories.workflow_repository as repo_mod
from app.core.errors import BusinessRuleError
from app.db.base import Base
from app.db.models import (
    CommentModel,
    ExternalEventModel,
    RequirementFlowLinkModel,
    StepHistoryModel,
    StepModel,
    TriggerModel,
    WorkflowModel,
    WorkflowTemplateModel,
    WorkflowTemplateStepModel,
)
from app.repositories.workflow_repository import InMemoryWorkflowRepository
from app.schemas.workflow import (
    CommentCreate,
    ExternalEventCreate,
    ExternalWaitInput,
    FinishFlowInput,
    InitialStepOverride,
    StepCompletePayload,
    StepHistoryPublic,
    StepStatus,
    StepStatusUpdate,
    StepTemplatePublic,
    StepTransitionType,
    TriggerCreate,
    TriggerStatus,
    WorkflowStartRequest,
    WorkflowStatus,
    WorkflowTemplatePublic,
)
from app.services.workflow_service import WorkflowService


OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA, StepStatus.ESPERANDO_RESPUESTA}


def build_linear_template() -> WorkflowTemplatePublic:
    return WorkflowTemplatePublic(
        id=str(uuid4()),
        nombre="Lineal A-B-C",
        descripcion="Plantilla lineal",
        steps=[
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="A",
                depends_on=[],
                nombre="Paso A",
                descripcion="Inicio",
                orden=1,
                tipo="analisis",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="B",
                depends_on=["A"],
                nombre="Paso B",
                descripcion="Continuacion",
                orden=2,
                tipo="ejecucion",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="C",
                depends_on=["B"],
                nombre="Paso C",
                descripcion="Cierre",
                orden=3,
                tipo="verificacion",
            ),
        ],
    )


def build_branch_join_template() -> WorkflowTemplatePublic:
    return WorkflowTemplatePublic(
        id=str(uuid4()),
        nombre="Branch+Join",
        descripcion="A -> (B,C) -> D",
        steps=[
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="A",
                depends_on=[],
                nombre="Paso A",
                descripcion="Inicio",
                orden=1,
                tipo="analisis",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="B",
                depends_on=["A"],
                nombre="Paso B",
                descripcion="Rama 1",
                orden=2,
                tipo="ejecucion",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="C",
                depends_on=["A"],
                nombre="Paso C",
                descripcion="Rama 2",
                orden=2,
                tipo="ejecucion",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="D",
                depends_on=["B", "C"],
                nombre="Paso D",
                descripcion="Join",
                orden=3,
                tipo="verificacion",
            ),
        ],
    )


def build_legacy_linear_template_without_dependencies() -> WorkflowTemplatePublic:
    return WorkflowTemplatePublic(
        id=str(uuid4()),
        nombre="Legacy lineal sin depends_on",
        descripcion="A, B y C sin dependencias explicitas",
        steps=[
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="A",
                depends_on=[],
                nombre="Paso A",
                descripcion="Inicio",
                orden=1,
                tipo="analisis",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="B",
                depends_on=[],
                nombre="Paso B",
                descripcion="Continuacion",
                orden=2,
                tipo="ejecucion",
            ),
            StepTemplatePublic(
                id=str(uuid4()),
                codigo="C",
                depends_on=[],
                nombre="Paso C",
                descripcion="Cierre",
                orden=3,
                tipo="verificacion",
            ),
        ],
    )


class WorkflowDagTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = InMemoryWorkflowRepository()
        self.service = WorkflowService(self.repository)

    def _start_workflow(self, template: WorkflowTemplatePublic) -> str:
        self.repository._workflow_templates = {template.id: template}  # type: ignore[attr-defined]
        trigger = self.service.create_trigger(
            TriggerCreate(
                solicitante="QA",
                descripcion="Caso de prueba DAG",
                tipo="requerimiento",
                creado_por="tester",
                metadata=None,
            )
        )
        workflow = self.service.start_workflow(
            trigger.id,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                primer_paso=InitialStepOverride(nombre="Paso inicial"),
            ),
        )
        return workflow.id

    def _open_codes(self, workflow_id: str) -> set[str]:
        workflow = self.service.get_workflow(workflow_id)
        return {
            step.codigo
            for step in workflow.steps
            if step.codigo is not None and step.estado in OPEN_STEP_STATUSES
        }

    def _step_by_code(self, workflow_id: str, code: str):
        workflow = self.service.get_workflow(workflow_id)
        for step in workflow.steps:
            if step.codigo == code:
                return step
        self.fail(f"No se encontro el paso con codigo {code}")

    def _complete(self, workflow_id: str, code: str) -> None:
        step = self._step_by_code(workflow_id, code)
        self.service.complete_step(
            step.id,
            StepCompletePayload(
                usuario="tester",
                comentario=f"Completo {code}",
                resultado=None,
                observaciones=None,
            ),
        )

    def test_linear_template_a_b_c(self) -> None:
        workflow_id = self._start_workflow(build_linear_template())

        self.assertEqual(self._open_codes(workflow_id), {"A"})

        self._complete(workflow_id, "A")
        self.assertEqual(self._open_codes(workflow_id), {"B"})

        self._complete(workflow_id, "B")
        self.assertEqual(self._open_codes(workflow_id), {"C"})

        self._complete(workflow_id, "C")
        workflow = self.service.get_workflow(workflow_id)
        self.assertEqual(workflow.estado, WorkflowStatus.FINALIZADO)
        self.assertEqual(workflow.pasos_activos, [])

    def test_branch_parallel_activation_a_to_b_and_c(self) -> None:
        workflow_id = self._start_workflow(build_branch_join_template())

        self.assertEqual(self._open_codes(workflow_id), {"A"})

        self._complete(workflow_id, "A")
        self.assertEqual(self._open_codes(workflow_id), {"B", "C"})

        workflow = self.service.get_workflow(workflow_id)
        template_codes = [step.codigo for step in workflow.steps if step.codigo]
        self.assertEqual(len(template_codes), len(set(template_codes)))

    def test_join_waits_and_then_activates_d(self) -> None:
        workflow_id = self._start_workflow(build_branch_join_template())
        self._complete(workflow_id, "A")

        self._complete(workflow_id, "B")
        self.assertEqual(self._open_codes(workflow_id), {"C"})

        self._complete(workflow_id, "C")
        self.assertEqual(self._open_codes(workflow_id), {"D"})

        self._complete(workflow_id, "D")
        workflow = self.service.get_workflow(workflow_id)
        self.assertEqual(workflow.estado, WorkflowStatus.FINALIZADO)
        self.assertEqual(workflow.pasos_activos, [])

        trigger = self.service.get_trigger(workflow.trigger_id)
        self.assertEqual(trigger.estado_general, TriggerStatus.RESUELTO)
        self.assertIsNone(trigger.workflow_activo_id)

    def test_legacy_linear_template_without_dependencies_is_normalized(self) -> None:
        workflow_id = self._start_workflow(build_legacy_linear_template_without_dependencies())

        self.assertEqual(self._open_codes(workflow_id), {"A"})

        self._complete(workflow_id, "A")
        self.assertEqual(self._open_codes(workflow_id), {"B"})

        self._complete(workflow_id, "B")
        self.assertEqual(self._open_codes(workflow_id), {"C"})

        self._complete(workflow_id, "C")
        workflow = self.service.get_workflow(workflow_id)
        self.assertEqual(workflow.estado, WorkflowStatus.FINALIZADO)

    def test_trigger_allows_parallel_workflows(self) -> None:
        template = build_linear_template()
        self.repository._workflow_templates = {template.id: template}  # type: ignore[attr-defined]
        trigger = self.service.create_trigger(
            TriggerCreate(
                solicitante="QA",
                descripcion="Caso workflows paralelos",
                tipo="requerimiento",
                creado_por="tester",
                metadata=None,
            )
        )

        workflow_1 = self.service.start_workflow(
            trigger.id,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                primer_paso=InitialStepOverride(nombre="Paso inicial"),
            ),
        )
        workflow_2 = self.service.start_workflow(
            trigger.id,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                primer_paso=InitialStepOverride(nombre="Paso inicial"),
            ),
        )

        trigger_after = self.service.get_trigger(trigger.id)
        self.assertEqual(len(trigger_after.workflow_ids), 2)
        self.assertEqual(trigger_after.estado_general, TriggerStatus.EN_PROCESO)
        self.assertEqual(trigger_after.workflow_activo_id, workflow_2.id)

        self._complete(workflow_1.id, "A")
        self._complete(workflow_1.id, "B")
        self._complete(workflow_1.id, "C")
        trigger_still_open = self.service.get_trigger(trigger.id)
        self.assertEqual(trigger_still_open.estado_general, TriggerStatus.EN_PROCESO)

        self._complete(workflow_2.id, "A")
        self._complete(workflow_2.id, "B")
        self._complete(workflow_2.id, "C")
        trigger_closed = self.service.get_trigger(trigger.id)
        self.assertEqual(trigger_closed.estado_general, TriggerStatus.RESUELTO)
        self.assertIsNone(trigger_closed.workflow_activo_id)

    def test_cannot_delete_open_workflow(self) -> None:
        workflow_id = self._start_workflow(build_linear_template())
        with self.assertRaises(BusinessRuleError):
            self.service.delete_workflow(workflow_id)

    def test_cannot_delete_waiting_or_paused_or_problem_workflows(self) -> None:
        template = build_linear_template()
        self.repository._workflow_templates = {template.id: template}  # type: ignore[attr-defined]

        trigger_waiting = self.service.create_trigger(
            TriggerCreate(
                solicitante="QA",
                descripcion="Flujo esperando respuesta",
                tipo="requerimiento",
                creado_por="tester",
                metadata=None,
            )
        )
        workflow_waiting = self.service.start_workflow(
            trigger_waiting.id,
            WorkflowStartRequest(
                workflow_template_id=template.id,
                primer_paso=InitialStepOverride(nombre="Paso inicial"),
            ),
        )
        step_waiting = self.service.get_workflow(workflow_waiting.id).steps[0]
        self.service.complete_step(
            step_waiting.id,
            StepCompletePayload(
                usuario="tester",
                comentario="Esperando respuesta externa",
                resultado_cierre="En espera",
                observaciones=None,
                transition_type=StepTransitionType.WAIT_EXTERNAL,
                external_wait=ExternalWaitInput(que_se_espera="respuesta", origen="sistema"),
            ),
        )
        workflow_waiting = self.service.get_workflow(workflow_waiting.id)
        self.assertEqual(workflow_waiting.estado, WorkflowStatus.ESPERANDO_RESPUESTA)
        with self.assertRaises(BusinessRuleError):
            self.service.delete_workflow(workflow_waiting.id)

        workflow_paused_id = self._start_workflow(template)
        step_paused = self.service.get_workflow(workflow_paused_id).steps[0]
        self.service.update_step_status(
            step_paused.id,
            StepStatusUpdate(
                estado=StepStatus.ESPERA,
                usuario="tester",
                nota="Pausado temporal",
            ),
        )
        workflow_paused = self.service.get_workflow(workflow_paused_id)
        self.assertEqual(workflow_paused.estado, WorkflowStatus.EN_ESPERA)
        with self.assertRaises(BusinessRuleError):
            self.service.delete_workflow(workflow_paused_id)

        workflow_problem_id = self._start_workflow(template)
        step_problem = self.service.get_workflow(workflow_problem_id).steps[0]
        self.service.update_step_status(
            step_problem.id,
            StepStatusUpdate(
                estado=StepStatus.PROBLEMA,
                usuario="tester",
                nota="Problema detectado",
            ),
        )
        workflow_problem = self.service.get_workflow(workflow_problem_id)
        self.assertEqual(workflow_problem.estado, WorkflowStatus.CON_PROBLEMA)
        with self.assertRaises(BusinessRuleError):
            self.service.delete_workflow(workflow_problem_id)

    def test_can_delete_cancelled_workflow(self) -> None:
        workflow_id = self._start_workflow(build_linear_template())
        cancel_result = self.service.cancel_workflow(workflow_id)
        self.assertEqual(cancel_result.estado, WorkflowStatus.CANCELADO)

        trigger_id = cancel_result.trigger_id
        self.service.delete_workflow(workflow_id)
        self.assertIsNone(self.repository.get_workflow(workflow_id))

        if trigger_id is not None:
            trigger = self.service.get_trigger(trigger_id)
            self.assertEqual(trigger.workflow_ids, [])
            self.assertEqual(trigger.estado_general, TriggerStatus.SIN_FLOWS)

    def test_can_delete_finalized_workflow_and_reconcile_requirement(self) -> None:
        workflow_id = self._start_workflow(build_linear_template())
        first_step = self.service.get_workflow(workflow_id).steps[0]
        self.service.complete_step(
            first_step.id,
            StepCompletePayload(
                usuario="tester",
                comentario="Finalizar flow",
                resultado_cierre="Completo",
                observaciones=None,
                transition_type=StepTransitionType.FINISH_FLOW,
                finish_data=FinishFlowInput(resultado_final="Ok", motivo_cierre="Cierra"),
            ),
        )

        workflow = self.service.get_workflow(workflow_id)
        self.assertEqual(workflow.estado, WorkflowStatus.FINALIZADO)
        trigger_id = workflow.trigger_id

        self.service.delete_workflow(workflow_id)
        self.assertIsNone(self.repository.get_workflow(workflow_id))

        if trigger_id is not None:
            trigger = self.service.get_trigger(trigger_id)
            self.assertEqual(trigger.workflow_ids, [])
            self.assertEqual(trigger.estado_general, TriggerStatus.SIN_FLOWS)

    def test_postgres_delete_workflow_cascades(self) -> None:
        engine = create_engine("sqlite+pysqlite:///:memory:", future=True)

        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=Session)

        @contextmanager
        def sqlite_session_scope():
            session = SessionLocal()
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

        original_session_scope = repo_mod.session_scope
        repo_mod.session_scope = sqlite_session_scope
        try:
            repo = repo_mod.PostgresWorkflowRepository()
            service = WorkflowService(repo)

            trigger = repo.create_trigger(
                TriggerCreate(
                    solicitante="QA",
                    descripcion="Trigger SQL delete test",
                    tipo="requerimiento",
                    creado_por="tester",
                    metadata=None,
                )
            )
            template = build_linear_template()
            with sqlite_session_scope() as session:
                session.add(
                    WorkflowTemplateModel(
                        id=template.id,
                        nombre=template.nombre,
                        descripcion=template.descripcion,
                        steps=[
                            WorkflowTemplateStepModel(
                                id=step.id,
                                workflow_template_id=template.id,
                                codigo=step.codigo,
                                depends_on=step.depends_on,
                                nombre=step.nombre,
                                descripcion=step.descripcion,
                                orden=step.orden,
                                tipo=step.tipo,
                                requiere_aprobacion=step.requiere_aprobacion,
                                puede_tener_comentarios=step.puede_tener_comentarios,
                                condicion_para_activarse=step.condicion_para_activarse,
                                condicion_para_cerrarse=step.condicion_para_cerrarse,
                                action_type=step.action_type,
                                action_config=step.action_config,
                                action_label=step.action_label,
                                waits_for_external_response=step.waits_for_external_response,
                                expected_external_event=step.expected_external_event,
                                external_wait_reason=step.external_wait_reason,
                                external_reference=step.external_reference,
                            )
                            for step in template.steps
                        ],
                    )
                )

            workflow = repo.create_workflow(
                trigger.id,
                template,
                WorkflowStartRequest(
                    workflow_template_id=template.id,
                    primer_paso=InitialStepOverride(nombre="Paso inicial"),
                ),
            )
            with sqlite_session_scope() as session:
                workflow_model = session.get(WorkflowModel, workflow.id)
                workflow_model.estado = WorkflowStatus.FINALIZADO
                workflow_model.fecha_fin = datetime.now(timezone.utc)
            step = repo.list_workflow_steps(workflow.id)[0]
            repo.add_comment(
                step.id,
                CommentCreate(
                    autor="tester",
                    comentario="Comentario prueba",
                    attachments=[],
                ),
            )
            repo.add_history(
                StepHistoryPublic(
                    id=str(uuid4()),
                    step_instance_id=step.id,
                    campo="test",
                    valor_anterior=None,
                    valor_nuevo="ok",
                    usuario="tester",
                    fecha=datetime.now(timezone.utc),
                    nota="nota",
                    attachments=[],
                )
            )
            repo.add_external_event(
                step.id,
                ExternalEventCreate(
                    event_type="test_event",
                    source="tester",
                    payload=None,
                    comentario="evento prueba",
                    attachments=[],
                    registrado_por="tester",
                ),
            )

            self.assertIsNotNone(repo.get_trigger(trigger.id))
            self.assertIsNotNone(repo.get_workflow(workflow.id))

            service.delete_workflow(workflow.id)
            self.assertIsNone(repo.get_workflow(workflow.id))

            trigger_after = repo.get_trigger(trigger.id)
            self.assertIsNotNone(trigger_after)
            self.assertEqual(trigger_after.workflow_ids, [])
            self.assertEqual(trigger_after.estado_general, TriggerStatus.SIN_FLOWS)
            self.assertIsNone(trigger_after.workflow_activo_id)

            with sqlite_session_scope() as session:
                self.assertEqual(
                    session.scalars(
                        select(RequirementFlowLinkModel).where(RequirementFlowLinkModel.workflow_id == workflow.id)
                    ).all(),
                    [],
                )
                self.assertEqual(
                    session.scalars(select(StepModel).where(StepModel.workflow_id == workflow.id)).all(),
                    [],
                )
                self.assertEqual(
                    session.scalars(select(CommentModel).where(CommentModel.step_instance_id == step.id)).all(),
                    [],
                )
                self.assertEqual(
                    session.scalars(select(StepHistoryModel).where(StepHistoryModel.step_instance_id == step.id)).all(),
                    [],
                )
                self.assertEqual(
                    session.scalars(select(ExternalEventModel).where(ExternalEventModel.step_id == step.id)).all(),
                    [],
                )
        finally:
            repo_mod.session_scope = original_session_scope

    def test_cannot_delete_requirement_with_linked_workflow(self) -> None:
        workflow_id = self._start_workflow(build_linear_template())
        workflow = self.service.get_workflow(workflow_id)
        self.assertIsNotNone(workflow.trigger_id)
        with self.assertRaises(BusinessRuleError):
            self.service.delete_trigger(workflow.trigger_id)

    def test_wait_external_blocks_activation_until_matching_event(self) -> None:
        template = WorkflowTemplatePublic(
            id=str(uuid4()),
            nombre="A espera externo y luego B",
            descripcion="A(wait external) -> B",
            steps=[
                StepTemplatePublic(
                    id=str(uuid4()),
                    codigo="A",
                    depends_on=[],
                    nombre="Solicitar layout",
                    descripcion="Envio y espera respuesta externa",
                    orden=1,
                    tipo="gestion",
                    action_type="wait_external",
                    waits_for_external_response=True,
                    expected_external_event="layout_recibido",
                    external_wait_reason="Esperando layout del proveedor",
                ),
                StepTemplatePublic(
                    id=str(uuid4()),
                    codigo="B",
                    depends_on=["A"],
                    nombre="Continuar",
                    descripcion="Continuar con el flujo",
                    orden=2,
                    tipo="ejecucion",
                ),
            ],
        )
        workflow_id = self._start_workflow(template)
        self.assertEqual(self._open_codes(workflow_id), {"A"})

        self._complete(workflow_id, "A")
        step_a_wait = self._step_by_code(workflow_id, "A")
        self.assertEqual(step_a_wait.estado, StepStatus.ESPERANDO_RESPUESTA)
        self.assertEqual(self._open_codes(workflow_id), {"A"})
        self.assertNotIn("B", self._open_codes(workflow_id))

        self.service.register_external_event(
            step_a_wait.id,
            ExternalEventCreate(
                event_type="otro_evento",
                comentario="No cumple la condicion",
                source="manual",
                registrado_por="tester",
            ),
        )
        step_a_still_wait = self._step_by_code(workflow_id, "A")
        self.assertEqual(step_a_still_wait.estado, StepStatus.ESPERANDO_RESPUESTA)
        self.assertNotIn("B", self._open_codes(workflow_id))

        self.service.register_external_event(
            step_a_wait.id,
            ExternalEventCreate(
                event_type="layout_recibido",
                comentario="Llego la respuesta esperada",
                source="manual",
                registrado_por="tester",
            ),
        )
        step_a_done = self._step_by_code(workflow_id, "A")
        self.assertEqual(step_a_done.estado, StepStatus.COMPLETADO)
        self.assertEqual(self._open_codes(workflow_id), {"B"})
        self.assertEqual(len(self.service.list_step_external_events(step_a_wait.id)), 2)


if __name__ == "__main__":
    unittest.main()
