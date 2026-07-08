import test from "node:test";
import assert from "node:assert/strict";

import { formatCalendarDayInput } from "../src/features/flow/utils";
import { buildFlowAgendaModel, type FlowAgendaModel } from "../src/features/flow/utils/flowAgenda";
import type { FlowGridRow } from "../src/features/flow/utils/flowTable";

function buildRow(overrides: Partial<FlowGridRow> = {}): FlowGridRow {
  return {
    id: overrides.id ?? "workflow-1",
    stepId: null,
    ambito: "laboral",
    status: overrides.status ?? "en_proceso",
    taskName: overrides.taskName ?? "Tarea",
    stepLabel: "Disparador",
    dateContext: "activa",
    primaryDateInput: overrides.primaryDateInput ?? overrides.executionDateInput ?? "",
    executionDateInput: overrides.executionDateInput ?? "",
    waitingReminderInput: overrides.waitingReminderInput ?? "",
    waitingSinceInput: overrides.waitingSinceInput ?? "",
    completedAtInput: "",
    executionAt: 0,
    contextualDateInput: overrides.contextualDateInput ?? overrides.executionDateInput ?? "",
    contextualDateAt: 0,
    operationalSortValue: 0,
    lastRecord: "",
    movementLabel: "",
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

function getSingleScheduledItem(model: FlowAgendaModel) {
  assert.equal(model.scheduledItems.length, 1);
  return model.scheduledItems[0];
}

test("flow activo con fecha futura genera barra de 1 día", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "2026-07-08" })], "2026-07-06");
  const item = getSingleScheduledItem(model);

  assert.equal(item.startDateInput, "2026-07-08");
  assert.equal(item.endDateInput, "2026-07-08");
  assert.equal(item.spanDays, 1);
  assert.equal(item.isOverdue, false);
});

test("flow activo con fecha de hoy genera barra de 1 día", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "2026-07-06" })], "2026-07-06");
  const item = getSingleScheduledItem(model);

  assert.equal(item.startDateInput, "2026-07-06");
  assert.equal(item.endDateInput, "2026-07-06");
  assert.equal(item.spanDays, 1);
  assert.equal(item.isOverdue, false);
});

test("flow activo con fecha pasada extiende la barra hasta hoy", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "2026-07-03" })], "2026-07-06");
  const item = getSingleScheduledItem(model);

  assert.equal(item.startDateInput, "2026-07-03");
  assert.equal(item.endDateInput, "2026-07-06");
  assert.equal(item.spanDays, 4);
  assert.equal(item.isOverdue, true);
});

test("flow activo sin fecha queda en la sección sin fecha de ejecución", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "", primaryDateInput: "", contextualDateInput: "" })], "2026-07-06");

  assert.equal(model.scheduledItems.length, 0);
  assert.equal(model.unscheduledItems.length, 1);
  assert.equal(model.groups[0]?.unscheduledItems[0]?.row.id, "workflow-1");
});

test("flow en espera con recordatorio genera marcador puntual de un día", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-waiting",
        status: "esperando_respuesta",
        executionDateInput: "",
        waitingReminderInput: "2026-07-08",
        waitingSinceInput: "2026-07-05",
        primaryDateInput: "2026-07-05",
        contextualDateInput: "2026-07-05",
      }),
    ],
    "2026-07-06"
  );

  const item = getSingleScheduledItem(model);
  assert.equal(item.kind, "waiting_reminder");
  assert.equal(item.startDateInput, "2026-07-08");
  assert.equal(item.endDateInput, "2026-07-08");
  assert.equal(item.spanDays, 1);
  assert.equal(item.isOverdue, false);
});

test("flow en espera con recordatorio vencido marca atraso", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-waiting-overdue",
        status: "esperando_respuesta",
        executionDateInput: "",
        waitingReminderInput: "2026-07-03",
        waitingSinceInput: "2026-07-01",
        primaryDateInput: "2026-07-01",
        contextualDateInput: "2026-07-01",
      }),
    ],
    "2026-07-06"
  );

  const item = getSingleScheduledItem(model);
  assert.equal(item.kind, "waiting_reminder");
  assert.equal(item.isOverdue, true);
});

test("flow en espera sin recordatorio va al bucket dedicado", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-waiting-no-reminder",
        status: "esperando_respuesta",
        executionDateInput: "",
        waitingReminderInput: "",
        waitingSinceInput: "2026-07-04",
        primaryDateInput: "2026-07-04",
        contextualDateInput: "2026-07-04",
      }),
    ],
    "2026-07-06"
  );

  assert.equal(model.scheduledItems.length, 0);
  assert.equal(model.unscheduledItems.length, 0);
  assert.equal(model.waitingWithoutReminderItems.length, 1);
  assert.equal(model.groups[0]?.waitingWithoutReminderItems[0]?.row.id, "workflow-waiting-no-reminder");
});

test("la agenda default incluye activos y waiting, pero no cancelados ni finalizados", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({ id: "workflow-active", status: "en_proceso", executionDateInput: "2026-07-06" }),
      buildRow({
        id: "workflow-waiting",
        status: "esperando_respuesta",
        executionDateInput: "",
        waitingReminderInput: "2026-07-07",
        primaryDateInput: "2026-07-05",
        contextualDateInput: "2026-07-05",
      }),
      buildRow({ id: "workflow-cancelled", status: "cancelado", executionDateInput: "2026-07-08" }),
      buildRow({ id: "workflow-finalized", status: "finalizado", executionDateInput: "2026-07-09" }),
    ],
    "2026-07-06"
  );

  assert.equal(model.filter, "all");
  assert.deepEqual(
    model.items.map((item) => item.row.id),
    ["workflow-active", "workflow-waiting"]
  );
});

test("agrupa por proyecto principal y preserva el indicador de proyectos extra", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-2",
        executionDateInput: "2026-07-06",
        primaryRequirementLabel: "Proyecto Principal",
        extraRequirementCount: 2,
        requirementsCount: 3,
        linkedRequirements: [
          { id: "project-main", label: "Proyecto Principal" },
          { id: "project-2", label: "Proyecto Secundario" },
          { id: "project-3", label: "Proyecto Extra" },
        ],
      }),
    ],
    "2026-07-06"
  );

  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0]?.label, "Proyecto Principal");
  assert.equal(model.groups[0]?.scheduledItems[0]?.row.extraRequirementCount, 2);
});

test("el rango visible usa la fecha más antigua y al menos hoy más siete días", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({ id: "workflow-3", executionDateInput: "2026-07-01" }),
      buildRow({ id: "workflow-4", executionDateInput: "2026-07-10" }),
    ],
    "2026-07-06"
  );

  assert.equal(model.rangeStartDateInput, "2026-07-01");
  assert.equal(model.rangeEndDateInput, "2026-07-13");
  assert.equal(model.columns[0]?.dateInput, "2026-07-01");
  assert.equal(model.columns[model.columns.length - 1]?.dateInput, "2026-07-13");
});

test("marca fines de semana en las columnas del timeline", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "2026-07-03" })], "2026-07-03");

  const friday = model.columns.find((column) => column.dateInput === "2026-07-03");
  const saturday = model.columns.find((column) => column.dateInput === "2026-07-04");
  const sunday = model.columns.find((column) => column.dateInput === "2026-07-05");

  assert.equal(friday?.isWeekend, false);
  assert.equal(saturday?.isWeekend, true);
  assert.equal(sunday?.isWeekend, true);
});

test("expone labels de mes y marca el corte cuando el rango cruza de mes", () => {
  const model = buildFlowAgendaModel([buildRow({ executionDateInput: "2026-06-29" })], "2026-07-01");

  const juneStart = model.columns.find((column) => column.dateInput === "2026-06-29");
  const julyStart = model.columns.find((column) => column.dateInput === "2026-07-01");
  const julyContinuation = model.columns.find((column) => column.dateInput === "2026-07-02");

  assert.equal(juneStart?.showMonthLabel, true);
  assert.equal(julyStart?.showMonthLabel, true);
  assert.equal(julyContinuation?.showMonthLabel, false);
  assert.equal(juneStart?.monthKey, "2026-06");
  assert.equal(julyStart?.monthKey, "2026-07");
  assert.equal(typeof julyStart?.monthLabel, "string");
  assert.equal((julyStart?.monthLabel ?? "").length > 0, true);
});

test("ordena los grupos dejando Sin proyecto al final", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-5",
        executionDateInput: "2026-07-02",
        primaryRequirementLabel: "Proyecto B",
        linkedRequirements: [{ id: "project-b", label: "Proyecto B" }],
      }),
      buildRow({
        id: "workflow-6",
        executionDateInput: "2026-07-01",
        primaryRequirementLabel: "Proyecto A",
        linkedRequirements: [{ id: "project-a", label: "Proyecto A" }],
      }),
      buildRow({
        id: "workflow-7",
        executionDateInput: "",
        primaryRequirementLabel: "Sin proyectos",
        requirementsCount: 0,
        linkedRequirements: [],
      }),
    ],
    "2026-07-06"
  );

  assert.deepEqual(
    model.groups.map((group) => group.label),
    ["Proyecto A", "Proyecto B", "Sin proyecto"]
  );
});

test("respeta una ventana visible custom basada en visibleStartDateInput y visibleDays", () => {
  const model = buildFlowAgendaModel(
    [buildRow({ executionDateInput: "2026-07-01" })],
    "2026-07-06",
    {
      visibleStartDateInput: "2026-07-04",
      visibleDays: 5,
    }
  );

  assert.equal(model.visibleStartDateInput, "2026-07-04");
  assert.equal(model.visibleEndDateInput, "2026-07-08");
  assert.equal(model.columns.length, 5);
  assert.equal(model.columns[0]?.dateInput, "2026-07-04");
  assert.equal(model.columns[4]?.dateInput, "2026-07-08");
});

test("marca cuando hoy queda fuera del rango visible", () => {
  const model = buildFlowAgendaModel(
    [buildRow({ executionDateInput: "2026-07-01" })],
    "2026-07-06",
    {
      visibleStartDateInput: "2026-07-10",
      visibleDays: 7,
    }
  );

  assert.equal(model.isTodayVisible, false);
  assert.equal(model.todayColumnIndex, null);
});

test("marca cuando hoy cae dentro del rango visible y expone su índice", () => {
  const model = buildFlowAgendaModel(
    [buildRow({ executionDateInput: "2026-07-01" })],
    "2026-07-06",
    {
      visibleStartDateInput: "2026-07-02",
      visibleDays: 10,
    }
  );

  assert.equal(model.isTodayVisible, true);
  assert.equal(model.todayColumnIndex, 4);
  assert.equal(model.columns[model.todayColumnIndex ?? 0]?.dateInput, "2026-07-06");
});

test("mantiene los items sin fecha agrupados por proyecto sin alterar el orden interno", () => {
  const model = buildFlowAgendaModel(
    [
      buildRow({
        id: "workflow-8",
        executionDateInput: "",
        taskName: "Sin fecha B",
        primaryRequirementLabel: "Proyecto A",
        linkedRequirements: [{ id: "project-a", label: "Proyecto A" }],
      }),
      buildRow({
        id: "workflow-9",
        executionDateInput: "",
        taskName: "Sin fecha A",
        primaryRequirementLabel: "Proyecto A",
        linkedRequirements: [{ id: "project-a", label: "Proyecto A" }],
      }),
    ],
    "2026-07-06",
    {
      visibleStartDateInput: formatCalendarDayInput(0),
      visibleDays: 3,
    }
  );

  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0]?.unscheduledItems.length, 2);
  assert.deepEqual(
    model.groups[0]?.unscheduledItems.map((item) => item.row.taskName),
    ["Sin fecha A", "Sin fecha B"]
  );
});
