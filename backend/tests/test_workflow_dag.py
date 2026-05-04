import unittest
from uuid import uuid4

from app.repositories.workflow_repository import InMemoryWorkflowRepository
from app.schemas.workflow import (
    InitialStepOverride,
    StepCompletePayload,
    StepStatus,
    StepTemplatePublic,
    TriggerCreate,
    TriggerStatus,
    WorkflowStartRequest,
    WorkflowStatus,
    WorkflowTemplatePublic,
)
from app.services.workflow_service import WorkflowService


OPEN_STEP_STATUSES = {StepStatus.ACTIVO, StepStatus.ESPERA, StepStatus.PROBLEMA}


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


if __name__ == "__main__":
    unittest.main()
