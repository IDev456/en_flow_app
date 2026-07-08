import test from "node:test";
import assert from "node:assert/strict";

import { buildFlowRows, countFlowQuickFilters, type FlowGridRow } from "../src/features/flow/utils/flowTable";
import type { WorkflowListItem } from "../src/features/flow/types";

function buildListItem(overrides: Partial<WorkflowListItem> = {}): WorkflowListItem {
  return {
    id: overrides.id ?? "workflow-1",
    ambito: overrides.ambito ?? "laboral",
    estado_visible: overrides.estado_visible ?? "en_proceso",
    objetivo_final: overrides.objetivo_final ?? "Flow principal",
    nombre_tarea: overrides.nombre_tarea ?? "Llamar proveedor",
    etiqueta_paso: overrides.etiqueta_paso ?? "Disparador",
    step_id_relevante: overrides.step_id_relevante ?? "step-1",
    fecha_inicio: overrides.fecha_inicio ?? "2026-06-20T10:00:00Z",
    contexto_fecha_actual: overrides.contexto_fecha_actual ?? "activa",
    fecha_ejecucion_actual: overrides.fecha_ejecucion_actual ?? "2026-06-24T12:00:00Z",
    fecha_espera_desde: overrides.fecha_espera_desde ?? null,
    fecha_fin: overrides.fecha_fin ?? null,
    fecha_recordatorio_actual: overrides.fecha_recordatorio_actual ?? null,
    latest_movement_at: overrides.latest_movement_at ?? "2026-06-23T09:30:00Z",
    latest_meaningful_record: overrides.latest_meaningful_record ?? "Seguimiento manual",
    linked_requirements:
      overrides.linked_requirements ??
      [
        {
          id: "project-1",
          label: "Proyecto Uno",
        },
      ],
    requirements_count: overrides.requirements_count ?? (overrides.linked_requirements?.length ?? 1),
    primary_requirement_label: overrides.primary_requirement_label ?? "Proyecto Uno",
    can_cancel: overrides.can_cancel ?? true,
    can_reactivate: overrides.can_reactivate ?? false,
    can_delete: overrides.can_delete ?? false,
  };
}

function buildRow(overrides: Partial<FlowGridRow> = {}): FlowGridRow {
  return {
    id: overrides.id ?? "row-1",
    stepId: overrides.stepId ?? "step-1",
    ambito: overrides.ambito ?? "laboral",
    status: overrides.status ?? "en_proceso",
    taskName: overrides.taskName ?? "Tarea",
    stepLabel: overrides.stepLabel ?? "Disparador",
    dateContext: overrides.dateContext ?? "activa",
    primaryDateInput: overrides.primaryDateInput ?? "",
    executionDateInput: overrides.executionDateInput ?? "",
    waitingSinceInput: overrides.waitingSinceInput ?? "",
    completedAtInput: overrides.completedAtInput ?? "",
    executionAt: overrides.executionAt ?? 0,
    contextualDateInput: overrides.contextualDateInput ?? "",
    contextualDateAt: overrides.contextualDateAt ?? 0,
    operationalSortValue: overrides.operationalSortValue ?? 0,
    lastRecord: overrides.lastRecord ?? "",
    movementLabel: overrides.movementLabel ?? "",
    movementAt: overrides.movementAt ?? 0,
    movementDays: overrides.movementDays ?? null,
    isDueToday: overrides.isDueToday ?? false,
    requirementsLabel: overrides.requirementsLabel ?? "",
    primaryRequirementLabel: overrides.primaryRequirementLabel ?? "Sin proyectos",
    extraRequirementCount: overrides.extraRequirementCount ?? 0,
    requirementsCount: overrides.requirementsCount ?? 0,
    linkedRequirements: overrides.linkedRequirements ?? [],
    canCancel: overrides.canCancel,
    canReactivate: overrides.canReactivate,
    canDelete: overrides.canDelete,
  };
}

test("buildFlowRows mapea WorkflowListItem a filas listas para la grilla", () => {
  const [row] = buildFlowRows(
    [
      buildListItem({
        id: "workflow-42",
        nombre_tarea: "Enviar contrato",
        linked_requirements: [
          { id: "project-a", label: "Proyecto A" },
          { id: "project-b", label: "Proyecto B" },
        ],
        requirements_count: 2,
        primary_requirement_label: "Proyecto A",
      }),
    ],
    "2026-06-24"
  );

  assert.equal(row.id, "workflow-42");
  assert.equal(row.stepId, "step-1");
  assert.equal(row.taskName, "Enviar contrato");
  assert.equal(row.status, "en_proceso");
  assert.equal(row.executionDateInput, "2026-06-24");
  assert.equal(row.primaryRequirementLabel, "Proyecto A");
  assert.equal(row.extraRequirementCount, 1);
  assert.equal(row.requirementsLabel, "Proyecto A · Proyecto B");
  assert.equal(row.canCancel, true);
  assert.equal(row.canDelete, false);
});

test("countFlowQuickFilters preserva filtros de espera, sin proyecto y sin fecha", () => {
  const activeRows = [
    buildRow({
      id: "workflow-without-project",
      status: "en_proceso",
      executionDateInput: "2026-06-24",
      primaryDateInput: "2026-06-24",
      contextualDateInput: "2026-06-24",
      requirementsCount: 0,
    }),
    buildRow({
      id: "workflow-without-date",
      status: "en_proceso",
      requirementsCount: 0,
    }),
  ];
  const waitingRows = [
    buildRow({
      id: "workflow-waiting",
      status: "esperando_respuesta",
      dateContext: "espera",
      waitingSinceInput: "2026-06-20",
      primaryDateInput: "2026-06-20",
      contextualDateInput: "2026-06-20",
      requirementsCount: 1,
    }),
  ];

  const activeCounts = countFlowQuickFilters(activeRows, "2026-06-24");
  const waitingCounts = countFlowQuickFilters(waitingRows, "2026-06-24");

  assert.equal(activeCounts.without_project, 2);
  assert.equal(activeCounts.without_date, 1);
  assert.equal(waitingCounts.waiting_days, 1);
  assert.equal(waitingCounts.waiting_today, 0);
});
