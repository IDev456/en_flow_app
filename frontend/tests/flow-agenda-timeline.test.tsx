import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";

import { createAppTheme } from "../src/theme";
import { FlowAgendaTimeline } from "../src/features/flow/components/FlowAgendaTimeline";
import { buildFlowAgendaModel } from "../src/features/flow/utils/flowAgenda";
import type { FlowGridRow } from "../src/features/flow/utils/flowTable";

function buildRow(overrides: Partial<FlowGridRow> = {}): FlowGridRow {
  return {
    id: overrides.id ?? "workflow-1",
    stepId: overrides.stepId ?? "step-1",
    ambito: "laboral",
    status: overrides.status ?? "en_proceso",
    taskName: overrides.taskName ?? "Tarea",
    stepLabel: overrides.stepLabel ?? "Disparador",
    dateContext: "activa",
    primaryDateInput: overrides.primaryDateInput ?? overrides.executionDateInput ?? "",
    executionDateInput: overrides.executionDateInput ?? "",
    waitingSinceInput: "",
    completedAtInput: "",
    executionAt: 0,
    contextualDateInput: overrides.contextualDateInput ?? overrides.executionDateInput ?? "",
    contextualDateAt: 0,
    operationalSortValue: 0,
    lastRecord: "",
    movementLabel: overrides.movementLabel ?? "",
    movementAt: 0,
    movementDays: null,
    isDueToday: false,
    requirementsLabel: overrides.requirementsLabel ?? "",
    primaryRequirementLabel: overrides.primaryRequirementLabel ?? "Proyecto A",
    extraRequirementCount: overrides.extraRequirementCount ?? 0,
    requirementsCount: overrides.requirementsCount ?? 1,
    linkedRequirements:
      overrides.linkedRequirements ??
      [
        {
          id: "project-a",
          label: overrides.primaryRequirementLabel ?? "Proyecto A",
        },
      ],
  };
}

test("renderiza un único bloque por proyecto y alinea los flows con fecha como hijos del proyecto", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-1",
        taskName: "Flow con fecha",
        executionDateInput: "2026-07-08",
      }),
      buildRow({
        id: "workflow-2",
        taskName: "Flow sin fecha oculto",
        executionDateInput: "",
        primaryDateInput: "",
        contextualDateInput: "",
      }),
    ],
    "2026-07-06",
    {
      visibleStartDateInput: "2026-07-01",
      visibleDays: 10,
    }
  );

  const html = renderToStaticMarkup(
    <ThemeProvider theme={createAppTheme("warmLight")}>
      <FlowAgendaTimeline
        model={model}
        onWorkflowOpen={() => {}}
        onExecutionDateChange={async () => {}}
      />
    </ThemeProvider>
  );

  assert.equal((html.match(/data-testid="agenda-project-group-/g) ?? []).length, 1);
  assert.match(html, /data-testid="agenda-row-workflow-1:active_execution"/);
  assert.match(html, /data-content-inset="34"/);
  assert.match(html, /data-testid="agenda-body-scroll"/);
  assert.match(html, /data-testid="agenda-gantt-scroll"/);
  assert.match(html, /data-project-header-style="flat"/);
  assert.match(html, /data-project-header-width="full"/);
  assert.match(html, /data-scroll-axis="x"/);
  assert.match(html, /data-scroll-axis="y"/);
  assert.equal((html.match(/data-testid="agenda-today-guide-overlay"/g) ?? []).length, 1);
  assert.match(html, /data-testid="agenda-today-chip"/);
  assert.match(html, /data-today-chip-style="custom"/);
  assert.match(html, />Sin fecha de ejecución</);
  assert.doesNotMatch(html, /data-row-divider="line"/);
  assert.doesNotMatch(html, /Flow sin fecha oculto/);
});
