import test from "node:test";
import assert from "node:assert/strict";

import { isDayInCurrentWeek } from "../src/features/flow/utils";
import { matchesFlowQuickFilter, type FlowGridRow } from "../src/features/flow/utils/flowTable";

function buildRow(dateInput: string): FlowGridRow {
  return {
    id: `row-${dateInput || "empty"}`,
    stepId: null,
    ambito: "laboral",
    status: "en_proceso",
    taskName: "Tarea",
    stepLabel: "Paso",
    dateContext: "activa",
    primaryDateInput: dateInput,
    executionDateInput: dateInput,
    waitingReminderInput: "",
    waitingSinceInput: "",
    completedAtInput: "",
    executionAt: 0,
    contextualDateInput: dateInput,
    contextualDateAt: 0,
    operationalSortValue: 0,
    lastRecord: "",
    movementLabel: "",
    movementAt: 0,
    movementDays: null,
    isDueToday: false,
    requirementsLabel: "",
    primaryRequirementLabel: "",
    extraRequirementCount: 0,
    requirementsCount: 1,
    linkedRequirements: [],
  };
}

test("this_week incluye toda la semana calendario de lunes a domingo", () => {
  const today = "2026-06-24";
  assert.equal(isDayInCurrentWeek("2026-06-22", today), true);
  assert.equal(isDayInCurrentWeek("2026-06-23", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-22"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-23"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-24"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-25"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-28"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-29"), "this_week", today), false);
});

test("this_week en lunes incluye desde el mismo lunes hasta el domingo", () => {
  const today = "2026-06-22";
  assert.equal(isDayInCurrentWeek("2026-06-22", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-22"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-28"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-21"), "this_week", today), false);
});

test("this_week en domingo incluye lunes a domingo y excluye la semana siguiente", () => {
  const today = "2026-06-28";
  assert.equal(isDayInCurrentWeek("2026-06-22", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-27"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-28"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-29"), "this_week", today), false);
});

test("this_week contempla cruces de mes dentro de la misma semana calendario", () => {
  const today = "2026-07-01";
  assert.equal(isDayInCurrentWeek("2026-06-29", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-06-30"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-07-05"), "this_week", today), true);
  assert.equal(matchesFlowQuickFilter(buildRow("2026-07-06"), "this_week", today), false);
});

test("this_week devuelve false para fechas vacias o invalidas", () => {
  const today = "2026-06-24";
  assert.equal(isDayInCurrentWeek("", today), false);
  assert.equal(isDayInCurrentWeek("fecha-invalida", today), false);
  assert.equal(matchesFlowQuickFilter(buildRow(""), "this_week", today), false);
  assert.equal(matchesFlowQuickFilter(buildRow("fecha-invalida"), "this_week", today), false);
});

test("el conteo y el listado filtrado comparten la misma logica de this_week", () => {
  const today = "2026-06-24";
  const rows = [
    buildRow("2026-06-22"),
    buildRow("2026-06-23"),
    buildRow("2026-06-24"),
    buildRow("2026-06-25"),
    buildRow("2026-06-28"),
    buildRow("2026-06-29"),
  ];

  const filteredRows = rows.filter((row) => matchesFlowQuickFilter(row, "this_week", today));
  const count = rows.filter((row) => matchesFlowQuickFilter(row, "this_week", today)).length;

  assert.equal(filteredRows.length, 5);
  assert.equal(count, 5);
});
