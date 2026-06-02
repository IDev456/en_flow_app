import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import {
  formatElapsedTime,
  getAmbitoLabel,
  getCalendarDayDiff,
  getTodayLocalDateInput,
  getVisibleTriggerStatus,
  getVisibleWorkflowStatus,
  isNoisyAutomaticJournalText,
  toCalendarDateInputValue,
  toCalendarDayValue,
} from "../utils";

export type FlowFilter = "all" | "operational" | "non_operational" | "active" | "waiting" | "cancelled" | "finalized";
export type FlowQuickFilter = "none" | "today" | "this_week" | "past" | "future" | "without_project" | "without_reminder";

export type LinkedRequirementRow = {
  id: string;
  label: string;
};

export type FlowTableItem = {
  workflow: WorkflowDetail;
  linkedRequirements?: TriggerDetail[];
  displayStatus?: string;
  relevantStep?: Step | null;
  latestMovementAt?: string | null;
};

export type FlowGridRow = {
  id: string;
  stepId: string | null;
  ambito: WorkflowDetail["ambito"];
  status: string;
  taskName: string;
  stepLabel: string;
  executionDateInput: string;
  executionAt: number;
  operationalSortValue: number;
  lastRecord: string;
  movementLabel: string;
  movementAt: number;
  movementDays: number | null;
  isDueToday: boolean;
  requirementsLabel: string;
  primaryRequirementLabel: string;
  extraRequirementCount: number;
  requirementsCount: number;
  linkedRequirements: LinkedRequirementRow[];
};

export type FlowCountSummary = Record<"active" | "waiting" | "cancelled" | "finalized", number>;

export type FlowDateGroupSection = {
  key: string;
  dateInput: string | null;
  label: string;
  sortKey: number;
  rows: FlowGridRow[];
};

export const flowQuickFilterOptions = [
  { value: "none", label: "Sin filtro" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "past", label: "Pasados" },
  { value: "future", label: "Futuros" },
  { value: "without_project", label: "Sin proyecto" },
  { value: "without_reminder", label: "Sin recordatorio" },
] as const satisfies ReadonlyArray<{ value: FlowQuickFilter; label: string }>;

export const selectableFlowQuickFilterOptions = flowQuickFilterOptions.filter((option) => option.value !== "none");

function getDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateSortValue(dateInput: string) {
  const dayValue = toCalendarDayValue(dateInput);
  return dayValue ?? Number.MAX_SAFE_INTEGER;
}

export function pickRelevantStep(workflow: WorkflowDetail): Step | null {
  const byOrder = [...workflow.steps].sort((a, b) => a.orden - b.orden);

  const active = byOrder.find((step) => step.estado === "activo");
  if (active) return active;

  const waitingExternal = byOrder.find((step) => step.estado === "esperando_respuesta");
  if (waitingExternal) return waitingExternal;

  const blocked = byOrder.find((step) => step.estado === "problema" || step.estado === "espera");
  if (blocked) return blocked;

  if (byOrder.length === 0) return null;

  const byRecentState = [...workflow.steps].sort(
    (a, b) => new Date(b.fecha_estado_actual).getTime() - new Date(a.fecha_estado_actual).getTime()
  );
  return byRecentState[0] ?? byOrder[0] ?? null;
}

export function getLatestMovementAt(workflow: WorkflowDetail) {
  return workflow.steps.reduce<string | null>((latest, step) => {
    const commentAt = step.ultimo_comentario_fecha;
    const stateAt = step.fecha_estado_actual;
    const candidate =
      commentAt && stateAt
        ? (new Date(commentAt).getTime() > new Date(stateAt).getTime() ? commentAt : stateAt)
        : (commentAt ?? stateAt);
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, null);
}

function getLatestMeaningfulWorkflowRecord(workflow: WorkflowDetail) {
  const latestByStep = workflow.steps
    .map((step) => {
      const text = step.ultimo_comentario?.trim() ?? "";
      const timestamp = step.ultimo_comentario_fecha;
      if (!text || !timestamp || isNoisyAutomaticJournalText(text)) {
        return null;
      }
      const parsed = new Date(timestamp).getTime();
      if (!Number.isFinite(parsed)) return null;
      return { text, timestampMs: parsed };
    })
    .filter((item): item is { text: string; timestampMs: number } => Boolean(item));

  if (latestByStep.length === 0) {
    return "Sin registros todavía";
  }

  const latest = latestByStep.reduce((current, candidate) => (candidate.timestampMs > current.timestampMs ? candidate : current));
  return latest.text;
}

export function getFlowFilterFromStatus(statusValue: string): "active" | "waiting" | "cancelled" | "finalized" | null {
  const visibleStatus = getVisibleTriggerStatus(statusValue);
  if (visibleStatus === "cancelado") {
    return "cancelled";
  }
  if (visibleStatus === "finalizado" || visibleStatus === "resuelto") {
    return "finalized";
  }
  if (visibleStatus === "esperando_respuesta" || visibleStatus === "en_espera") {
    return "waiting";
  }
  if (
    visibleStatus === "sin_flows" ||
    visibleStatus === "con_problema" ||
    visibleStatus === "problema" ||
    visibleStatus === "pendiente" ||
    visibleStatus === "activo" ||
    visibleStatus === "en_proceso"
  ) {
    return "active";
  }
  return "active";
}

export function matchesFlowStateFilter(statusValue: string, filter: FlowFilter): boolean {
  if (filter === "all") return true;
  const resolved = getFlowFilterFromStatus(statusValue);
  if (filter === "operational") return resolved === "active" || resolved === "waiting";
  if (filter === "non_operational") return resolved === "cancelled" || resolved === "finalized";
  return resolved === filter;
}

export function getFlowStateFilterLabel(filter: FlowFilter) {
  switch (filter) {
    case "all":
      return "Todos";
    case "operational":
      return "Operativos";
    case "non_operational":
      return "No operativos";
    case "active":
      return "Activos";
    case "waiting":
      return "En espera";
    case "cancelled":
      return "Cancelados";
    case "finalized":
      return "Finalizados";
    default:
      return "Todos";
  }
}

export function getFlowQuickFilterDescription(filter: FlowQuickFilter) {
  switch (filter) {
    case "today":
      return "hoy";
    case "this_week":
      return "esta semana";
    case "past":
      return "pasados";
    case "future":
      return "futuros";
    case "without_project":
      return "sin proyecto";
    case "without_reminder":
      return "sin recordatorio";
    case "none":
    default:
      return "";
  }
}

export function buildActiveFlowFilterDescription(stateFilter: FlowFilter, flowQuickFilter: FlowQuickFilter) {
  const stateLabel = getFlowStateFilterLabel(stateFilter);
  const quickFilterLabel = getFlowQuickFilterDescription(flowQuickFilter);
  return quickFilterLabel ? `${stateLabel} ${quickFilterLabel}` : stateLabel;
}

export function isDateGroupedQuickFilter(filter: FlowQuickFilter) {
  return filter === "today" || filter === "this_week" || filter === "past" || filter === "future";
}

export function matchesFlowQuickFilter(row: FlowGridRow, filter: FlowQuickFilter, today: string) {
  if (filter === "none") {
    return true;
  }

  if (filter === "without_project") {
    return row.requirementsCount === 0;
  }

  if (filter === "without_reminder") {
    return !row.executionDateInput;
  }

  const rowDay = toCalendarDayValue(row.executionDateInput || null);
  const todayDay = toCalendarDayValue(today);

  if (rowDay === null || todayDay === null) {
    return false;
  }

  if (filter === "today") {
    return rowDay === todayDay;
  }

  if (filter === "past") {
    return rowDay < todayDay;
  }

  if (filter === "future") {
    return rowDay > todayDay;
  }

  if (filter === "this_week") {
    const todayDate = new Date(`${today}T00:00:00`);
    const dayOfWeek = todayDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeekDay = todayDay + daysUntilSunday;
    return rowDay >= todayDay && rowDay <= endOfWeekDay;
  }

  return true;
}

export function buildFlowRows(items: FlowTableItem[], today: string = getTodayLocalDateInput()): FlowGridRow[] {
  const todaySortValue = toDateSortValue(today);

  return items.map((item) => {
    const workflow = item.workflow;
    const linkedRequirements = item.linkedRequirements ?? [];
    const step = item.relevantStep ?? pickRelevantStep(workflow);
    const displayStatus = item.displayStatus ?? getVisibleWorkflowStatus(workflow);
    const latestMovementAt = item.latestMovementAt ?? getLatestMovementAt(workflow);
    const executionDateInput = toCalendarDateInputValue(step?.fecha_vencimiento);
    const stepLabel =
      step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
        ? "Disparador"
        : "Última tarea";
    const movementAtValue = getDateValue(latestMovementAt);
    const movementAt = movementAtValue ?? Number.MAX_SAFE_INTEGER;
    const movementDateInput = movementAtValue === null ? null : new Date(movementAtValue).toISOString();
    const movementDayDiff = getCalendarDayDiff(toCalendarDateInputValue(movementDateInput), today);
    const movementDays = movementDayDiff === null ? null : Math.max(0, -movementDayDiff);
    const requirementLabels = linkedRequirements.map(
      (requirement) => requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`
    );
    const executionDayValue = executionDateInput ? toDateSortValue(executionDateInput) : null;
    const operationalSortValue =
      executionDayValue === null
        ? 3_000_000_000
        : executionDateInput === today
          ? executionDayValue
          : executionDateInput < today
            ? 1_000_000_000 + Math.max(0, todaySortValue - executionDayValue)
            : 2_000_000_000 + executionDayValue;

    return {
      id: workflow.id,
      stepId: step?.id ?? null,
      ambito: workflow.ambito,
      status: displayStatus,
      taskName: step?.nombre ?? "Sin tarea registrada",
      stepLabel,
      executionDateInput,
      executionAt: executionDateInput ? toDateSortValue(executionDateInput) : Number.MAX_SAFE_INTEGER,
      operationalSortValue,
      lastRecord: getLatestMeaningfulWorkflowRecord(workflow),
      movementLabel: formatElapsedTime(latestMovementAt) ?? "Sin movimiento reciente",
      movementAt,
      movementDays,
      isDueToday: executionDateInput === today,
      requirementsLabel:
        linkedRequirements.length === 0
          ? "Sin proyectos"
          : linkedRequirements
              .map((requirement) => requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`)
              .join(" · "),
      requirementsCount: linkedRequirements.length,
      primaryRequirementLabel: requirementLabels[0] ?? "Sin proyectos",
      extraRequirementCount: Math.max(0, requirementLabels.length - 1),
      linkedRequirements: linkedRequirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`,
      })),
    };
  });
}

export function getFlowCounts(items: FlowTableItem[]): FlowCountSummary {
  return items
    .map((item) => item.displayStatus ?? getVisibleWorkflowStatus(item.workflow))
    .reduce<FlowCountSummary>(
      (acc, status) => {
        const filter = getFlowFilterFromStatus(status);
        if (!filter) return acc;
        acc[filter] += 1;
        return acc;
      },
      { active: 0, waiting: 0, cancelled: 0, finalized: 0 }
    );
}

export function buildFlowDateGroupLabel(dateInput: string | null, todayInput: string) {
  if (!dateInput) {
    return "Sin fecha";
  }

  const diffDays = getCalendarDayDiff(dateInput, todayInput) ?? 0;
  const formattedDate = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateInput}T00:00:00Z`));

  if (diffDays === 0) return `Hoy · ${formattedDate}`;
  if (diffDays === 1) return `Mañana · ${formattedDate}`;
  if (diffDays === 2) return `Pasado mañana · ${formattedDate}`;
  if (diffDays > 2) return `En ${diffDays} días · ${formattedDate}`;
  if (diffDays === -1) return `Ayer · ${formattedDate}`;
  return `Hace ${Math.abs(diffDays)} días · ${formattedDate}`;
}

export function getFlowDateGroupSortKey(dateInput: string | null, todayInput: string) {
  if (!dateInput) {
    return 3_000_000_000;
  }

  const diffDays = getCalendarDayDiff(dateInput, todayInput) ?? 0;
  if (diffDays === 0) return 0;
  if (diffDays < 0) return 1_000_000 + Math.abs(diffDays);
  return 2_000_000 + diffDays;
}

export function groupFlowRowsByDate(rows: FlowGridRow[], todayInput: string): FlowDateGroupSection[] {
  const groups = new Map<string, FlowDateGroupSection>();

  for (const row of rows) {
    const dateInput = row.executionDateInput || null;
    const key = dateInput ?? "__without-date__";
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      key,
      dateInput,
      label: buildFlowDateGroupLabel(dateInput, todayInput),
      sortKey: getFlowDateGroupSortKey(dateInput, todayInput),
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((left, right) => left.sortKey - right.sortKey);
}

export function getFlowSearchableContent(row: FlowGridRow) {
  return [
    row.taskName,
    row.stepLabel,
    row.status,
    row.requirementsLabel,
    row.lastRecord,
    row.ambito ?? "",
    getAmbitoLabel(row.ambito),
  ].join(" ");
}
