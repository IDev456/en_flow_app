import type { FlowGridRow } from "./flowTable";
import { formatCalendarDayInput, getRelativeCalendarDateInput, toCalendarDayValue } from "../utils";
import { matchesFlowStateFilter } from "./flowTable";

export type FlowAgendaFilter = "active" | "waiting" | "all";
export type FlowAgendaItemKind = "active_execution" | "waiting_reminder" | "waiting_since";

export type FlowAgendaItem = {
  id: string;
  kind: FlowAgendaItemKind;
  row: FlowGridRow;
  groupKey: string;
  groupLabel: string;
  startDateInput: string | null;
  startDay: number | null;
  plannedEndDateInput: string | null;
  plannedEndDay: number | null;
  endDateInput: string | null;
  endDay: number | null;
  spanDays: number;
  isWithoutDate: boolean;
  isOverdue: boolean;
};

export type FlowAgendaGroup = {
  key: string;
  label: string;
  items: FlowAgendaItem[];
  scheduledItems: FlowAgendaItem[];
  unscheduledItems: FlowAgendaItem[];
};

export type FlowAgendaColumn = {
  day: number;
  dateInput: string;
  isToday: boolean;
  isWeekend: boolean;
  monthKey: string;
  monthLabel: string;
  showMonthLabel: boolean;
};

export type FlowAgendaModel = {
  filter: FlowAgendaFilter;
  groups: FlowAgendaGroup[];
  columns: FlowAgendaColumn[];
  items: FlowAgendaItem[];
  scheduledItems: FlowAgendaItem[];
  unscheduledItems: FlowAgendaItem[];
  todayInput: string;
  todayDay: number;
  rangeStartDay: number;
  rangeEndDay: number;
  rangeStartDateInput: string;
  rangeEndDateInput: string;
  visibleStartDay: number;
  visibleEndDay: number;
  visibleStartDateInput: string;
  visibleEndDateInput: string;
  visibleDays: number;
  isTodayVisible: boolean;
  todayColumnIndex: number | null;
};

export type BuildFlowAgendaModelOptions = {
  filter?: FlowAgendaFilter;
  horizonDays?: number;
  visibleStartDateInput?: string;
  visibleDays?: number;
};

const DEFAULT_HORIZON_DAYS = 7;
const WITHOUT_PROJECT_KEY = "__without-project__";
const WITHOUT_PROJECT_LABEL = "Sin proyecto";

function compareAgendaItemOrder(left: FlowAgendaItem, right: FlowAgendaItem) {
  if (left.startDay !== null && right.startDay !== null && left.startDay !== right.startDay) {
    return left.startDay - right.startDay;
  }

  if (left.startDay !== null && right.startDay === null) {
    return -1;
  }

  if (left.startDay === null && right.startDay !== null) {
    return 1;
  }

  return left.row.taskName.localeCompare(right.row.taskName, "es");
}

function compareAgendaGroupOrder(left: FlowAgendaGroup, right: FlowAgendaGroup) {
  if (left.label === WITHOUT_PROJECT_LABEL && right.label !== WITHOUT_PROJECT_LABEL) {
    return 1;
  }

  if (left.label !== WITHOUT_PROJECT_LABEL && right.label === WITHOUT_PROJECT_LABEL) {
    return -1;
  }

  return left.label.localeCompare(right.label, "es");
}

function resolveAgendaGroup(row: FlowGridRow) {
  if (row.linkedRequirements.length === 0) {
    return { key: WITHOUT_PROJECT_KEY, label: WITHOUT_PROJECT_LABEL };
  }

  const primaryRequirement = row.linkedRequirements[0];
  return {
    key: primaryRequirement?.id ?? row.primaryRequirementLabel,
    label: row.primaryRequirementLabel || WITHOUT_PROJECT_LABEL,
  };
}

function buildAgendaItem(row: FlowGridRow, todayDay: number): FlowAgendaItem {
  const group = resolveAgendaGroup(row);
  const startDay = toCalendarDayValue(row.executionDateInput || null);
  const isWithoutDate = startDay === null;

  if (isWithoutDate) {
    return {
      id: `${row.id}:active_execution`,
      kind: "active_execution",
      row,
      groupKey: group.key,
      groupLabel: group.label,
      startDateInput: null,
      startDay: null,
      plannedEndDateInput: null,
      plannedEndDay: null,
      endDateInput: null,
      endDay: null,
      spanDays: 0,
      isWithoutDate: true,
      isOverdue: false,
    };
  }

  const plannedEndDay = startDay + 1;
  const endDay = Math.max(startDay, todayDay);
  const spanDays = Math.max(1, endDay - startDay + 1);

  return {
    id: `${row.id}:active_execution`,
    kind: "active_execution",
    row,
    groupKey: group.key,
    groupLabel: group.label,
    startDateInput: formatCalendarDayInput(startDay),
    startDay,
    plannedEndDateInput: formatCalendarDayInput(plannedEndDay),
    plannedEndDay,
    endDateInput: formatCalendarDayInput(endDay),
    endDay,
    spanDays,
    isWithoutDate: false,
    isOverdue: startDay < todayDay,
  };
}

export function buildFlowAgendaModel(
  rows: FlowGridRow[],
  todayInput: string,
  options: BuildFlowAgendaModelOptions = {}
): FlowAgendaModel {
  const filter = options.filter ?? "active";
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const requestedVisibleDays = options.visibleDays ?? 0;
  const todayDay = toCalendarDayValue(todayInput);

  if (todayDay === null) {
    throw new Error(`Fecha actual inválida para Agenda: ${todayInput}`);
  }

  const filteredRows =
    filter === "all" ? rows : rows.filter((row) => matchesFlowStateFilter(row.status, filter === "waiting" ? "waiting" : "active"));
  const items = filteredRows.map((row) => buildAgendaItem(row, todayDay));
  const scheduledItems = items.filter((item) => !item.isWithoutDate).sort(compareAgendaItemOrder);
  const unscheduledItems = items.filter((item) => item.isWithoutDate).sort(compareAgendaItemOrder);

  const scheduledStartDays = scheduledItems.map((item) => item.startDay).filter((day): day is number => day !== null);
  const scheduledEndDays = scheduledItems.map((item) => item.endDay).filter((day): day is number => day !== null);
  const rangeStartDay = scheduledStartDays.length > 0 ? Math.min(todayDay, ...scheduledStartDays) : todayDay;
  const fallbackRangeEndDay = toCalendarDayValue(getRelativeCalendarDateInput(horizonDays, todayInput)) ?? todayDay + horizonDays;
  const rangeEndDay = Math.max(fallbackRangeEndDay, ...(scheduledEndDays.length > 0 ? scheduledEndDays : [fallbackRangeEndDay]));
  const visibleStartDay = toCalendarDayValue(options.visibleStartDateInput ?? null) ?? rangeStartDay;
  const visibleDays =
    requestedVisibleDays > 0
      ? requestedVisibleDays
      : Math.max(1, rangeEndDay - visibleStartDay + 1);
  const visibleEndDay = visibleStartDay + visibleDays - 1;
  const isTodayVisible = todayDay >= visibleStartDay && todayDay <= visibleEndDay;
  const todayColumnIndex = isTodayVisible ? todayDay - visibleStartDay : null;

  const columns: FlowAgendaColumn[] = [];
  for (let day = visibleStartDay; day <= visibleEndDay; day += 1) {
    const dateInput = formatCalendarDayInput(day);
    const date = new Date(`${dateInput}T00:00:00Z`);
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthLabel = new Intl.DateTimeFormat("es-AR", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    const previousMonthKey = columns[columns.length - 1]?.monthKey ?? null;

    columns.push({
      day,
      dateInput,
      isToday: day === todayDay,
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
      monthKey,
      monthLabel,
      showMonthLabel: previousMonthKey !== monthKey,
    });
  }

  const groupsByKey = new Map<string, FlowAgendaGroup>();
  for (const item of [...scheduledItems, ...unscheduledItems]) {
    const existing = groupsByKey.get(item.groupKey);
    if (existing) {
      existing.items.push(item);
      if (item.isWithoutDate) {
        existing.unscheduledItems.push(item);
      } else {
        existing.scheduledItems.push(item);
      }
      continue;
    }

    groupsByKey.set(item.groupKey, {
      key: item.groupKey,
      label: item.groupLabel,
      items: [item],
      scheduledItems: item.isWithoutDate ? [] : [item],
      unscheduledItems: item.isWithoutDate ? [item] : [],
    });
  }

  const groups = [...groupsByKey.values()]
    .map((group) => ({
      ...group,
      scheduledItems: [...group.scheduledItems].sort(compareAgendaItemOrder),
      unscheduledItems: [...group.unscheduledItems].sort(compareAgendaItemOrder),
      items: [...group.items].sort(compareAgendaItemOrder),
    }))
    .sort(compareAgendaGroupOrder);

  return {
    filter,
    groups,
    columns,
    items,
    scheduledItems,
    unscheduledItems,
    todayInput,
    todayDay,
    rangeStartDay,
    rangeEndDay,
    rangeStartDateInput: formatCalendarDayInput(rangeStartDay),
    rangeEndDateInput: formatCalendarDayInput(rangeEndDay),
    visibleStartDay,
    visibleEndDay,
    visibleStartDateInput: formatCalendarDayInput(visibleStartDay),
    visibleEndDateInput: formatCalendarDayInput(visibleEndDay),
    visibleDays,
    isTodayVisible,
    todayColumnIndex,
  };
}
