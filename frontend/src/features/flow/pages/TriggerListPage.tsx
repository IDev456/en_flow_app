import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import type { DragEvent as ReactDragEvent } from "react";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { alpha, type Theme, useTheme } from "@mui/material/styles";
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItemButton,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ColumnsPanelTrigger,
  DataGrid,
  ExportCsv,
  FilterPanelTrigger,
  GridActionsCellItem,
  type GridColDef,
  type GridFilterModel,
  type GridRenderCellParams,
  type GridRowParams,
  type GridSortModel,
  Toolbar,
  ToolbarButton,
} from "@mui/x-data-grid";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import { DataGridEmptyState } from "../../../components/feedback/DataGridEmptyState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { useToastContext } from "../../../components/Toast";
import { getStatusSemanticKey } from "../../../theme";
import { cancelWorkflow, createTrigger, deleteTrigger, deleteWorkflow, getWorkflow, linkWorkflowRequirement, listTriggers, listWorkflows, reactivateWorkflow, updateStep, updateTrigger, updateWorkflow } from "../api";
import {
  getNavigationLocationState,
  mergeNavigationState,
  navigateWithOrigin,
  omitNavigationStateKeys,
} from "../navigation";
import { AmbitoChip } from "../components/AmbitoChip";
import { StatusBadge } from "../components/StatusBadge";
import type { Ambito, Step, TriggerDetail, WorkflowDetail } from "../types";
import {
  activeAmbitoOptions,
  getStoredActiveAmbito,
  formatCalendarDate,
  formatElapsedTime,
  formatCalendarDayInput,
  formatLocalDateInput,
  formatRelativeCalendarDay,
  getCalendarDayDiff,
  getAmbitoLabel,
  humanizeStatus,
  getVisibleTriggerStatus,
  getVisibleWorkflowStatus,
  isPastCalendarDateInput,
  isNoisyAutomaticJournalText,
  matchesActiveAmbito,
  openNativeDateInputPicker,
  getStatusTone,
  setStoredActiveAmbito,
  getTodayLocalDateInput,
  toCalendarDateInputValue,
  toCalendarDayValue,
  toCalendarDateUtcIso,
  type ActiveAmbitoMode,
} from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "operational" | "non_operational" | "active" | "waiting" | "cancelled" | "finalized";
type FlowQuickFilter =
  | "none"
  | "today"
  | "this_week"
  | "past"
  | "future"
  | "without_project"
  | "without_date"
  | "waiting_today"
  | "waiting_days"
  | "waiting_week"
  | "waiting_15_plus"
  | "waiting_month_plus";

type TriggerListPageProps = {
  defaultView?: ViewMode;
  lockView?: boolean;
  title?: string;
};

type TriggerListRestoreState = {
  viewMode: ViewMode;
  stateFilter: FlowFilter;
  flowQuickFilter: FlowQuickFilter;
  flowSearchOpen: boolean;
  flowSearchValue: string;
  flowSortModel: GridSortModel;
  requirementSearchOpen: boolean;
  requirementSearchValue: string;
};

type FlowCardData = {
  workflow: WorkflowDetail;
  displayStatus: string;
  relevantStep: Step | null;
  latestMovementAt: string | null;
  linkedRequirements: TriggerDetail[];
};

type LinkedRequirementRow = {
  id: string;
  label: string;
};

type FlowGridRow = {
  id: string;
  stepId: string | null;
  ambito: Ambito;
  status: string;
  taskName: string;
  stepLabel: string;
  dateContext: WorkflowDetail["contexto_fecha_actual"];
  primaryDateInput: string;
  executionDateInput: string;
  waitingSinceInput: string;
  completedAtInput: string;
  executionAt: number;
  contextualDateInput: string;
  contextualDateAt: number;
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
  canCancel: boolean;
  canReactivate: boolean;
  canDelete: boolean;
};

type RequirementGridRow = {
  id: string;
  ambito: Ambito;
  description: string;
  requester: string;
  status: string;
  flowsLabel: string;
  waitingLabel: string;
  flowCount: number;
  openCount: number;
  waitingCount: number;
  canDelete: boolean;
};

type FlowDateGroupSection = {
  key: string;
  dateInput: string | null;
  label: string;
  sortKey: number;
  rows: FlowGridRow[];
};

const flowQuickFilterOptions = [
  { value: "none", label: "Sin filtro" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "past", label: "Pasados" },
  { value: "future", label: "Futuros" },
  { value: "waiting_today", label: "Hoy" },
  { value: "waiting_days", label: "Hace 1-6 dias" },
  { value: "waiting_week", label: "Hace 1 semana" },
  { value: "waiting_15_plus", label: "Mas de 15 dias" },
  { value: "waiting_month_plus", label: "Mas de 1 mes" },
  { value: "without_project", label: "Sin proyecto" },
  { value: "without_date", label: "Sin fecha de ejecución" },
] as const satisfies ReadonlyArray<{ value: FlowQuickFilter; label: string }>;
const selectableFlowQuickFilterOptions = flowQuickFilterOptions.filter((option) => option.value !== "none");
const FLOW_PRIMARY_COLUMN_FIELD = "taskName";
const FLOW_COLUMN_ORDER_STORAGE_KEY = "en-flow.trigger-list.flow-column-order";
const attentionFlowQuickFilters = new Set<FlowQuickFilter>([
  "past",
  "without_project",
  "without_date",
  "waiting_15_plus",
  "waiting_month_plus",
]);

function getStoredFlowColumnOrder() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(FLOW_COLUMN_ORDER_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function storeFlowColumnOrder(order: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FLOW_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areSortModelsEqual(left: GridSortModel, right: GridSortModel) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item.field === right[index]?.field && item.sort === right[index]?.sort);
}

function sanitizeFlowColumnOrder(availableFields: string[], candidateOrder: string[]) {
  const uniqueAvailableFields = Array.from(new Set(availableFields));
  const sanitizedOrder = uniqueAvailableFields.includes(FLOW_PRIMARY_COLUMN_FIELD) ? [FLOW_PRIMARY_COLUMN_FIELD] : [];

  for (const field of candidateOrder) {
    if (field === FLOW_PRIMARY_COLUMN_FIELD || !uniqueAvailableFields.includes(field) || sanitizedOrder.includes(field)) {
      continue;
    }
    sanitizedOrder.push(field);
  }

  for (const field of uniqueAvailableFields) {
    if (field === FLOW_PRIMARY_COLUMN_FIELD || sanitizedOrder.includes(field)) {
      continue;
    }
    sanitizedOrder.push(field);
  }

  return sanitizedOrder;
}

function swapFlowColumnsInOrder(order: string[], draggedField: string, targetField: string) {
  if (
    draggedField === FLOW_PRIMARY_COLUMN_FIELD ||
    targetField === FLOW_PRIMARY_COLUMN_FIELD ||
    draggedField === targetField
  ) {
    return order;
  }

  const draggedIndex = order.indexOf(draggedField);
  const targetIndex = order.indexOf(targetField);
  if (draggedIndex === -1 || targetIndex === -1) {
    return order;
  }

  const nextOrder = [...order];
  [nextOrder[draggedIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[draggedIndex]];
  return nextOrder;
}

function getGroupedColumnTrack(column: GridColDef<FlowGridRow>) {
  if (typeof column.width === "number") {
    return `${column.width}px`;
  }

  const minWidth = column.minWidth ?? 180;
  const flex = typeof column.flex === "number" ? column.flex : 1;
  return `minmax(${minWidth}px, ${flex}fr)`;
}

function getGroupedColumnMinWidth(column: GridColDef<FlowGridRow>) {
  if (typeof column.width === "number") {
    return column.width;
  }

  return column.minWidth ?? 180;
}

function buildGroupedHeaderTemplateColumns(columns: GridColDef<FlowGridRow>[]) {
  return columns.map((column) => getGroupedColumnTrack(column)).join(" ");
}

function getGroupedHeaderMinWidth(columns: GridColDef<FlowGridRow>[]) {
  return columns.reduce((total, column) => total + getGroupedColumnMinWidth(column), 0);
}

function isOperationalFlowQuickFilter(filter: FlowQuickFilter) {
  return filter === "today" || filter === "this_week" || filter === "waiting_today" || filter === "waiting_days" || filter === "waiting_week";
}

function getAllowedFlowQuickFiltersForStateFilter(stateFilter: FlowFilter): FlowQuickFilter[] {
  switch (stateFilter) {
    case "active":
      return ["today", "this_week", "past", "future", "without_project", "without_date"];
    case "waiting":
      return ["waiting_today", "waiting_days", "waiting_week", "waiting_15_plus", "waiting_month_plus", "without_project"];
    case "finalized":
    case "cancelled":
    case "non_operational":
      return ["today", "this_week", "past", "without_project"];
    case "all":
    case "operational":
    default:
      return ["today", "this_week", "past", "future", "without_project", "without_date"];
  }
}

function normalizeVisibleFlowFilter(filter: FlowFilter | null | undefined): FlowFilter {
  if (!filter || filter === "all" || filter === "operational") {
    return "active";
  }
  return filter;
}

function renderFlowQuickFilterOptionLabel(
  option: { value: FlowQuickFilter; label: string },
  count: number,
  selected = false
) {
  const isAttention = attentionFlowQuickFilters.has(option.value);
  const isOperational = isOperationalFlowQuickFilter(option.value);

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <Typography
        variant="body2"
        sx={{
          color: "text.primary",
          fontWeight: 400,
        }}
      >
        {option.label}
      </Typography>
      <Typography
        variant="body2"
        sx={(theme) => ({
          color:
            isAttention && count > 0
              ? theme.palette.error.main
              : isOperational && count > 0
                ? theme.palette.status.active.accent
                : theme.palette.text.secondary,
          fontWeight: (isAttention && count > 0) || (isOperational && count > 0) ? 700 : 500,
        })}
      >
        ({count})
      </Typography>
    </Stack>
  );
}


function getAmbitoModeIcon(ambito: ActiveAmbitoMode) {
  if (ambito === "laboral") return <WorkOutlineRoundedIcon sx={{ fontSize: 14 }} />;
  return <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />;
}

function getFlowFilterFromStatus(statusValue: string): "active" | "waiting" | "cancelled" | "finalized" | null {
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

function matchesFlowStateFilter(statusValue: string, filter: FlowFilter): boolean {
  if (filter === "all") return true;
  const resolved = getFlowFilterFromStatus(statusValue);
  if (filter === "operational") return resolved === "active" || resolved === "waiting";
  if (filter === "non_operational") return resolved === "cancelled" || resolved === "finalized";
  return resolved === filter;
}

function getDefaultFilterForView(_view: ViewMode): FlowFilter {
  return "active";
}

function pickRelevantStep(workflow: WorkflowDetail): Step | null {
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

function getLatestMovementAt(workflow: WorkflowDetail) {
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
    return "Sin registros todavÃ­a";
  }

  const latest = latestByStep.reduce((current, candidate) => (candidate.timestampMs > current.timestampMs ? candidate : current));
  return latest.text;
}

function canCancelWorkflow(workflow: WorkflowDetail) {
  const hasOperationalStep = workflow.steps.some((step) =>
    ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
  );

  if (!workflow.steps.length) return false;
  if (["en_proceso", "esperando_respuesta", "en_espera", "con_problema"].includes(workflow.estado)) return true;
  if (workflow.estado === "pendiente") return hasOperationalStep;
  return false;
}

function canReactivateWorkflow(workflow: WorkflowDetail) {
  return workflow.estado === "cancelado";
}

function canDeleteWorkflow(workflow: WorkflowDetail) {
  return ["cancelado", "finalizado"].includes(workflow.estado);
}

function getDateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateInputValue(value: string | null | undefined) {
  return toCalendarDateInputValue(value);
}

function toDateSortValue(dateInput: string) {
  const dayValue = toCalendarDayValue(dateInput);
  return dayValue ?? Number.MAX_SAFE_INTEGER;
}

function resolvePrimaryDateInput(workflow: WorkflowDetail, step: Step | null) {
  if (workflow.contexto_fecha_actual === "espera") {
    return toDateInputValue(workflow.fecha_espera_desde ?? step?.fecha_estado_actual);
  }
  if (workflow.contexto_fecha_actual === "activa") {
    return toDateInputValue(workflow.fecha_ejecucion_actual ?? step?.fecha_ejecucion_estimada);
  }
  if (workflow.contexto_fecha_actual === "cerrado") {
    return toDateInputValue(workflow.fecha_fin);
  }
  return "";
}

function getMovementHeatVisual(days: number | null) {
  if (days === null) {
    return null;
  }
  if (days <= 1) {
    return { color: "warning.light", opacity: 0.45 };
  }
  if (days <= 3) {
    return { color: "warning.main", opacity: 0.62 };
  }
  if (days <= 6) {
    return { color: "warning.dark", opacity: 0.78 };
  }
  return { color: "error.main", opacity: 0.94 };
}

function getFlowDateColumnVisibility(stateFilter: FlowFilter) {
  if (stateFilter === "active") {
    return { execution: true, waiting: false, completed: false };
  }
  if (stateFilter === "waiting") {
    return { execution: false, waiting: true, completed: false };
  }
  if (stateFilter === "finalized" || stateFilter === "cancelled" || stateFilter === "non_operational") {
    return { execution: false, waiting: false, completed: true };
  }
  return { execution: true, waiting: true, completed: false };
}

function shouldShowStatusColumn(stateFilter: FlowFilter) {
  return stateFilter === "all" || stateFilter === "operational";
}

function renderNotApplicableDateCell(message: string) {
  return (
    <Tooltip title={message}>
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.2 }}>
        No aplica
      </Typography>
    </Tooltip>
  );
}

function buildFlowDateGroupLabel(dateInput: string | null, todayInput: string) {
  if (!dateInput) {
    return "Sin fecha";
  }

  const diffDays = getCalendarDayDiff(dateInput, todayInput) ?? 0;
  const formattedDate = formatCalendarDate(dateInput);

  if (diffDays === 0) return `Hoy · ${formattedDate}`;
  if (diffDays === 1) return `Mañana · ${formattedDate}`;
  if (diffDays === 2) return `Pasado mañana · ${formattedDate}`;
  if (diffDays > 2) return `En ${diffDays} días · ${formattedDate}`;
  if (diffDays === -1) return `Ayer · ${formattedDate}`;
  return `Hace ${Math.abs(diffDays)} días · ${formattedDate}`;
}

function getFlowDateGroupSortKey(dateInput: string | null, todayInput: string) {
  if (!dateInput) {
    return 3_000_000_000;
  }

  const diffDays = getCalendarDayDiff(dateInput, todayInput) ?? 0;
  if (diffDays === 0) return 0;
  if (diffDays < 0) return 1_000_000 + Math.abs(diffDays);
  return 2_000_000 + diffDays;
}

function groupFlowRowsByDate(rows: FlowGridRow[], todayInput: string): FlowDateGroupSection[] {
  const groups = new Map<string, FlowDateGroupSection>();

  for (const row of rows) {
    const dateInput = getRowContextualDateInput(row) || null;
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

function isDateGroupedQuickFilter(filter: FlowQuickFilter) {
  return filter === "today" || filter === "this_week" || filter === "past" || filter === "future";
}

function getRowContextualDateInput(row: FlowGridRow) {
  return row.primaryDateInput || row.contextualDateInput || "";
}

function rowMatchesWithoutDateFilter(row: FlowGridRow) {
  return getFlowFilterFromStatus(row.status) === "active" && !row.executionDateInput;
}

function getWaitingAgeDays(row: FlowGridRow, today: string) {
  if (getFlowFilterFromStatus(row.status) !== "waiting" || !row.waitingSinceInput) {
    return null;
  }

  const diffDays = getCalendarDayDiff(row.waitingSinceInput, today);
  return diffDays === null ? null : Math.max(0, -diffDays);
}

function matchesWaitingAgeQuickFilter(row: FlowGridRow, filter: FlowQuickFilter, today: string) {
  const waitingAgeDays = getWaitingAgeDays(row, today);
  if (waitingAgeDays === null) {
    return false;
  }

  if (filter === "waiting_today") return waitingAgeDays === 0;
  if (filter === "waiting_days") return waitingAgeDays >= 1 && waitingAgeDays <= 6;
  if (filter === "waiting_week") return waitingAgeDays >= 7 && waitingAgeDays <= 14;
  if (filter === "waiting_15_plus") return waitingAgeDays >= 15 && waitingAgeDays <= 30;
  if (filter === "waiting_month_plus") return waitingAgeDays >= 31;
  return false;
}

function matchesFlowQuickFilter(row: FlowGridRow, filter: FlowQuickFilter, today: string) {
  if (filter === "none") {
    return true;
  }

  if (filter === "without_project") {
    return row.requirementsCount === 0;
  }

  if (filter === "without_date") {
    return rowMatchesWithoutDateFilter(row);
  }

  if (
    filter === "waiting_today" ||
    filter === "waiting_days" ||
    filter === "waiting_week" ||
    filter === "waiting_15_plus" ||
    filter === "waiting_month_plus"
  ) {
    return matchesWaitingAgeQuickFilter(row, filter, today);
  }

  const rowDay = toCalendarDayValue(getRowContextualDateInput(row) || null);
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

function getStatusHighlight(statusValue: string, theme: Theme) {
  const semantic = getStatusSemanticKey(getStatusTone(statusValue));
  return theme.palette.status[semantic];
}

function toQuickFilterValues(search: string) {
  const normalized = search.trim();
  if (!normalized) return [];
  return normalized.split(/\s+/);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type FlowGridToolbarProps = {
  quickFilterPlaceholder?: string;
  searchOpen?: boolean;
  searchValue?: string;
  onSearchToggle?: () => void;
  onSearchChange?: (value: string) => void;
  onSearchClearOrClose?: () => void;
  showGridActions?: boolean;
  showFlowQuickFilter?: boolean;
  activeFlowFilterDescription?: string;
  flowQuickFilter?: FlowQuickFilter;
  flowQuickFilterCounts?: Partial<Record<FlowQuickFilter, number>>;
  flowQuickFilterLabel?: string;
  allowedFlowQuickFilters?: FlowQuickFilter[];
  quickFilterAnchorEl?: HTMLElement | null;
  onQuickFilterOpen?: (event: MouseEvent<HTMLElement>) => void;
  onQuickFilterClose?: () => void;
  onFlowQuickFilterChange?: (value: FlowQuickFilter) => void;
};

function getFlowStateFilterLabel(filter: FlowFilter) {
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

function getFlowQuickFilterDescription(filter: FlowQuickFilter) {
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
    case "without_date":
      return "sin fecha de ejecución";
    case "waiting_today":
      return "hoy";
    case "waiting_days":
      return "hace 1-6 dias";
    case "waiting_week":
      return "hace 1 semana";
    case "waiting_15_plus":
      return "mas de 15 dias";
    case "waiting_month_plus":
      return "mas de 1 mes";
    case "none":
    default:
      return "";
  }
}

function buildActiveFlowFilterDescription(stateFilter: FlowFilter, flowQuickFilter: FlowQuickFilter) {
  const stateLabel = getFlowStateFilterLabel(stateFilter);
  const quickFilterLabel = getFlowQuickFilterDescription(flowQuickFilter);
  return quickFilterLabel ? `${stateLabel} ${quickFilterLabel}` : stateLabel;
}

function FlowGridToolbar(props: any) {
  const {
    quickFilterPlaceholder,
    searchOpen,
    searchValue,
    onSearchToggle,
    onSearchChange,
    onSearchClearOrClose,
    showGridActions = true,
    showFlowQuickFilter = false,
    activeFlowFilterDescription = "",
    flowQuickFilter = "none",
    flowQuickFilterCounts = {},
    flowQuickFilterLabel = "Filtro rápido",
    allowedFlowQuickFilters = selectableFlowQuickFilterOptions.map((option) => option.value),
    quickFilterAnchorEl = null,
    onQuickFilterOpen,
    onQuickFilterClose,
    onFlowQuickFilterChange,
  } = props as FlowGridToolbarProps;
  const resolvedPlaceholder = quickFilterPlaceholder ?? "";
  const resolvedSearchOpen = searchOpen ?? false;
  const resolvedSearchValue = searchValue ?? "";
  const searchIsEmpty = resolvedSearchValue.trim().length === 0;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickFilterMenuOpen = Boolean(quickFilterAnchorEl);

  useEffect(() => {
    if (!resolvedSearchOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      const cursorPosition = input.value.length;
      input.setSelectionRange?.(cursorPosition, cursorPosition);
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [resolvedSearchOpen]);

  const searchControls = (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
      <ToolbarButton aria-label={resolvedSearchOpen ? "Alternar búsqueda" : "Buscar"} onClick={onSearchToggle}>
        <SearchRoundedIcon fontSize="small" />
      </ToolbarButton>
      {resolvedSearchOpen ? (
        <>
          <TextField
            aria-label="Búsqueda rápida"
            placeholder={resolvedPlaceholder}
            size="small"
            fullWidth={false}
            autoFocus
            inputRef={searchInputRef}
            value={resolvedSearchValue}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              onSearchChange?.(event.target.value);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape" && searchIsEmpty) {
                onSearchClearOrClose?.();
              }
            }}
            sx={{ width: { xs: 180, sm: 280 } }}
          />
          <ToolbarButton
            aria-label={searchIsEmpty ? "Cerrar búsqueda" : "Limpiar búsqueda"}
            onClick={onSearchClearOrClose}
          >
            <CancelOutlinedIcon fontSize="small" />
          </ToolbarButton>
        </>
      ) : null}
    </Stack>
  );

  return (
    <Toolbar aria-label="Toolbar del listado" style={{ gap: "6px", justifyContent: "space-between" }}>
      {showFlowQuickFilter ? (
        <Typography
          variant="body1"
          color="text.primary"
          sx={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            alignSelf: "center",
            px: 0.5,
            fontWeight: 700,
          }}
        >
          {activeFlowFilterDescription}
        </Typography>
      ) : (
        searchControls
      )}

      <Box sx={{ flex: showFlowQuickFilter ? 0 : 1 }} />

      {showGridActions ? (
        <ColumnsPanelTrigger
          aria-label="Columnas"
          render={<ToolbarButton aria-label="Columnas">{<ViewColumnRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
      ) : null}
      {showFlowQuickFilter ? (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          {searchControls}
          <ToolbarButton aria-label={flowQuickFilterLabel} onClick={onQuickFilterOpen}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <ScheduleRoundedIcon fontSize="small" />
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {flowQuickFilterLabel}
              </Typography>
              <ExpandMoreIcon fontSize="small" />
            </Stack>
          </ToolbarButton>
          {flowQuickFilter !== "none" ? (
            <ToolbarButton
              aria-label="Restablecer filtro rápido"
              onClick={() => {
                onFlowQuickFilterChange?.("none");
                onQuickFilterClose?.();
              }}
            >
              <CancelOutlinedIcon fontSize="small" />
            </ToolbarButton>
          ) : null}
          <Menu anchorEl={quickFilterAnchorEl} open={quickFilterMenuOpen} onClose={onQuickFilterClose}>
            {selectableFlowQuickFilterOptions.filter((option) => allowedFlowQuickFilters.includes(option.value)).map((option) => (
              <MenuItem
                key={option.value}
                selected={option.value === flowQuickFilter}
                onClick={() => {
                  onFlowQuickFilterChange?.(option.value);
                  onQuickFilterClose?.();
                }}
              >
                {renderFlowQuickFilterOptionLabel(
                  option,
                  flowQuickFilterCounts[option.value] ?? 0,
                  option.value === flowQuickFilter
                )}
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      ) : null}
      {showGridActions ? (
        <FilterPanelTrigger
          aria-label="Filtros"
          render={<ToolbarButton aria-label="Filtros">{<FilterListRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
      ) : null}
      {showGridActions ? (
        <ExportCsv
          aria-label="Descargar"
          render={<ToolbarButton aria-label="Descargar CSV">{<DownloadRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
      ) : null}
    </Toolbar>
  );
}

function FlowListToolbar(props: FlowGridToolbarProps) {
  const {
    quickFilterPlaceholder,
    searchOpen,
    searchValue,
    onSearchToggle,
    onSearchChange,
    onSearchClearOrClose,
    activeFlowFilterDescription = "",
    flowQuickFilter = "none",
    flowQuickFilterCounts = {},
    flowQuickFilterLabel = "Filtro rápido",
    allowedFlowQuickFilters = selectableFlowQuickFilterOptions.map((option) => option.value),
    quickFilterAnchorEl = null,
    onQuickFilterOpen,
    onQuickFilterClose,
    onFlowQuickFilterChange,
  } = props;
  const resolvedPlaceholder = quickFilterPlaceholder ?? "";
  const resolvedSearchOpen = searchOpen ?? false;
  const resolvedSearchValue = searchValue ?? "";
  const searchIsEmpty = resolvedSearchValue.trim().length === 0;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickFilterMenuOpen = Boolean(quickFilterAnchorEl);

  useEffect(() => {
    if (!resolvedSearchOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      const cursorPosition = input.value.length;
      input.setSelectionRange?.(cursorPosition, cursorPosition);
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [resolvedSearchOpen]);

  const searchControls = (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
      <IconButton aria-label={resolvedSearchOpen ? "Alternar búsqueda" : "Buscar"} size="small" onClick={onSearchToggle}>
        <SearchRoundedIcon fontSize="small" />
      </IconButton>
      {resolvedSearchOpen ? (
        <>
          <TextField
            aria-label="Búsqueda rápida"
            placeholder={resolvedPlaceholder}
            size="small"
            fullWidth={false}
            autoFocus
            inputRef={searchInputRef}
            value={resolvedSearchValue}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              onSearchChange?.(event.target.value);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape" && searchIsEmpty) {
                onSearchClearOrClose?.();
              }
            }}
            sx={{ width: { xs: 180, sm: 280 } }}
          />
          <IconButton
            aria-label={searchIsEmpty ? "Cerrar búsqueda" : "Limpiar búsqueda"}
            size="small"
            onClick={onSearchClearOrClose}
          >
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        </>
      ) : null}
    </Stack>
  );

  return (
    <Box
      aria-label="Toolbar del listado de flows"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 0.75,
        px: 1,
        py: 0.75,
      }}
    >
      <Typography
        variant="body1"
        color="text.primary"
        sx={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: 700,
        }}
      >
        {activeFlowFilterDescription}
      </Typography>

      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
        {searchControls}
        <ButtonBase
          aria-label={flowQuickFilterLabel}
          onClick={onQuickFilterOpen}
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: (theme) => theme.appShape.sm,
            color: "text.secondary",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <ScheduleRoundedIcon fontSize="small" />
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {flowQuickFilterLabel}
            </Typography>
            <ExpandMoreIcon fontSize="small" />
          </Stack>
        </ButtonBase>
        {flowQuickFilter !== "none" ? (
          <IconButton
            aria-label="Restablecer filtro rápido"
            size="small"
            onClick={() => {
              onFlowQuickFilterChange?.("none");
              onQuickFilterClose?.();
            }}
          >
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Menu anchorEl={quickFilterAnchorEl} open={quickFilterMenuOpen} onClose={onQuickFilterClose}>
          {selectableFlowQuickFilterOptions.filter((option) => allowedFlowQuickFilters.includes(option.value)).map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === flowQuickFilter}
              onClick={() => {
                onFlowQuickFilterChange?.(option.value);
                onQuickFilterClose?.();
              }}
            >
              {renderFlowQuickFilterOptionLabel(
                option,
                flowQuickFilterCounts[option.value] ?? 0,
                option.value === flowQuickFilter
              )}
            </MenuItem>
          ))}
        </Menu>
      </Stack>
    </Box>
  );
}

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Proyectos" }: TriggerListPageProps) {
  const theme = useTheme();
  const { showToast } = useToastContext();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = getNavigationLocationState<TriggerListRestoreState>(location.state);
  const restoreState = navigationState.restore;
  const initialViewMode = lockView ? defaultView : (restoreState?.viewMode ?? defaultView);
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [stateFilter, setStateFilter] = useState<FlowFilter>(
    () => normalizeVisibleFlowFilter(restoreState?.stateFilter ?? getDefaultFilterForView(initialViewMode))
  );
  const [activeAmbito, setActiveAmbito] = useState<ActiveAmbitoMode>(() => getStoredActiveAmbito());
  const [loading, setLoading] = useState(true);
  const [deletingTriggerId, setDeletingTriggerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createRequirementOpen, setCreateRequirementOpen] = useState(false);
  const [newRequirementDescription, setNewRequirementDescription] = useState("");
  const [newRequirementContext, setNewRequirementContext] = useState("");
  const [creatingRequirement, setCreatingRequirement] = useState(false);
  const [createRequirementError, setCreateRequirementError] = useState<string | null>(null);
  const [requirementToastOpen, setRequirementToastOpen] = useState(false);
  const [requirementToastMessage, setRequirementToastMessage] = useState<string | null>(null);
  const [flowToastOpen, setFlowToastOpen] = useState(false);
  const [flowToastMessage, setFlowToastMessage] = useState<string | null>(null);
  const [cancellingFlowId, setCancellingFlowId] = useState<string | null>(null);
  const [reactivatingFlowId, setReactivatingFlowId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [flowActionsMenu, setFlowActionsMenu] = useState<{ rowId: string; anchorEl: HTMLElement } | null>(null);
  const [requirementsMenu, setRequirementsMenu] = useState<{ rowId: string; anchorEl: HTMLElement } | null>(null);
  const [linkProjectDialog, setLinkProjectDialog] = useState<{ workflowId: string; workflowName: string } | null>(null);
  const [linkProjectSearch, setLinkProjectSearch] = useState("");
  const [linkProjectLoading, setLinkProjectLoading] = useState(false);
  const [pendingDates, setPendingDates] = useState<Map<string, string>>(new Map());
  const [flowQuickFilter, setFlowQuickFilter] = useState<FlowQuickFilter>(
    () => (initialViewMode === "flows" ? restoreState?.flowQuickFilter ?? "none" : "none")
  );
  const [flowQuickFilterAnchorEl, setFlowQuickFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [flowColumnOrder, setFlowColumnOrder] = useState<string[]>(() => getStoredFlowColumnOrder());
  const [draggedFlowColumnField, setDraggedFlowColumnField] = useState<string | null>(null);
  const [flowColumnDropTargetField, setFlowColumnDropTargetField] = useState<string | null>(null);
  const [flowSearchOpen, setFlowSearchOpen] = useState(() => restoreState?.flowSearchOpen ?? false);
  const [flowSearchValue, setFlowSearchValue] = useState(() => restoreState?.flowSearchValue ?? "");
  const [requirementSearchOpen, setRequirementSearchOpen] = useState(() => restoreState?.requirementSearchOpen ?? false);
  const [requirementSearchValue, setRequirementSearchValue] = useState(() => restoreState?.requirementSearchValue ?? "");
  const [flowSortModel, setFlowSortModel] = useState<GridSortModel>(
    () => restoreState?.flowSortModel ?? [{ field: "movementAt", sort: "asc" }]
  );
  const [requirementFilterModel, setRequirementFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: restoreState?.requirementSearchValue ? toQuickFilterValues(restoreState.requirementSearchValue) : [],
  });
  const [classifyingItemId, setClassifyingItemId] = useState<string | null>(null);
  const pendingDateInputRefs = useRef(new Map<string, HTMLInputElement | null>());
  const searchParams = new URLSearchParams(location.search);
  const isAmbitoAdminView = defaultView === "requirements" && searchParams.get("admin") === "ambito";

  useEffect(() => {
    const normalizedFilter = normalizeVisibleFlowFilter(stateFilter);
    if (normalizedFilter !== stateFilter) {
      setStateFilter(normalizedFilter);
    }
  }, [stateFilter]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (lockView) {
      setViewMode(defaultView);
    }
    if (defaultView !== "flows") {
      setFlowQuickFilter("none");
      setFlowQuickFilterAnchorEl(null);
    }
  }, [defaultView, lockView]);

  useEffect(() => {
    setStoredActiveAmbito(activeAmbito);
  }, [activeAmbito]);

  useEffect(() => {
    const state = location.state as { openCreateRequirement?: boolean; toast?: string } | null;
    if (!state) return;
    if (!state.toast && !state.openCreateRequirement) {
      return;
    }

    if (state.toast) {
      setRequirementToastMessage(state.toast);
      setRequirementToastOpen(true);
    }

    if (state.openCreateRequirement && defaultView === "requirements") {
      setViewMode("requirements");
      setCreateRequirementOpen(true);
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: omitNavigationStateKeys(location.state, ["openCreateRequirement", "toast"]),
    });
  }, [defaultView, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const nextRestore = {
      viewMode,
      stateFilter,
      flowQuickFilter,
      flowSearchOpen,
      flowSearchValue,
      flowSortModel,
      requirementSearchOpen,
      requirementSearchValue,
    } satisfies TriggerListRestoreState;

    if (
      restoreState?.viewMode === nextRestore.viewMode &&
      restoreState?.stateFilter === nextRestore.stateFilter &&
      restoreState?.flowQuickFilter === nextRestore.flowQuickFilter &&
      restoreState?.flowSearchOpen === nextRestore.flowSearchOpen &&
      restoreState?.flowSearchValue === nextRestore.flowSearchValue &&
      areSortModelsEqual(restoreState?.flowSortModel ?? [], nextRestore.flowSortModel) &&
      restoreState?.requirementSearchOpen === nextRestore.requirementSearchOpen &&
      restoreState?.requirementSearchValue === nextRestore.requirementSearchValue
    ) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: mergeNavigationState(location.state, {
        restore: nextRestore,
      }),
    });
  }, [
    flowQuickFilter,
    flowSearchOpen,
    flowSearchValue,
    flowSortModel,
    location.pathname,
    location.search,
    location.state,
    navigate,
    requirementSearchOpen,
    requirementSearchValue,
    restoreState,
    stateFilter,
    viewMode,
  ]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [triggerData, workflowSummaries] = await Promise.all([listTriggers(), listWorkflows()]);
      setTriggers(triggerData);

      const workflowIds = [...new Set(workflowSummaries.map((workflow) => workflow.id))];
      const workflowDetails = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));
      setWorkflowsById(Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkProject(projectId: string) {
    if (!linkProjectDialog || linkProjectLoading) return;
    setLinkProjectLoading(true);
    try {
      await linkWorkflowRequirement(linkProjectDialog.workflowId, { requirement_id: projectId });
      handleCloseLinkProjectDialog();
      await loadData();
      setFlowToastMessage("Proyecto asociado.");
      setFlowToastOpen(true);
    } catch {
      setFlowToastMessage("No se pudo asociar el proyecto.");
      setFlowToastOpen(true);
    } finally {
      setLinkProjectLoading(false);
    }
  }

  function handleCloseLinkProjectDialog() {
    if (linkProjectLoading) return;
    setLinkProjectDialog(null);
    setLinkProjectSearch("");
  }

  const requirementByWorkflowId = useMemo(() => {
    const map: Record<string, TriggerDetail[]> = {};
    for (const trigger of triggers) {
      for (const workflowId of trigger.workflow_ids) {
        if (!map[workflowId]) {
          map[workflowId] = [];
        }
        map[workflowId].push(trigger);
      }
    }
    return map;
  }, [triggers]);

  const allFlowCards = useMemo<FlowCardData[]>(() => {
    return Object.values(workflowsById)
      .map((workflow) => {
        const linkedRequirements = requirementByWorkflowId[workflow.id] ?? [];
        return {
          workflow,
          ambito: workflow.ambito,
          displayStatus: getVisibleWorkflowStatus(workflow),
          relevantStep: pickRelevantStep(workflow),
          latestMovementAt: getLatestMovementAt(workflow),
          linkedRequirements,
        };
      })
      .filter((item) => matchesActiveAmbito(item.workflow.ambito, activeAmbito));
  }, [activeAmbito, requirementByWorkflowId, workflowsById]);

  const filteredFlowCards = useMemo(
    () => allFlowCards.filter((item) => matchesFlowStateFilter(item.displayStatus, stateFilter)),
    [allFlowCards, stateFilter]
  );

  const flowCounts = useMemo(() => {
    return Object.values(workflowsById)
      .filter((workflow) => matchesActiveAmbito(workflow.ambito, activeAmbito))
      .map((workflow) => getVisibleWorkflowStatus(workflow))
      .reduce<Record<"active" | "waiting" | "cancelled" | "finalized", number>>(
        (acc, status) => {
          const filter = getFlowFilterFromStatus(status);
          if (!filter) return acc;
          acc[filter] += 1;
          return acc;
        },
        { active: 0, waiting: 0, cancelled: 0, finalized: 0 }
      );
  }, [activeAmbito, workflowsById]);

  const filteredRequirements = useMemo(
    () =>
      triggers.filter((trigger) => {
        if (!matchesActiveAmbito(trigger.ambito, activeAmbito)) return false;
        return matchesFlowStateFilter(trigger.estado_general, stateFilter);
      }),
    [triggers, stateFilter, activeAmbito]
  );

  const requirementCounts = useMemo(() => {
    return triggers
      .filter((trigger) => matchesActiveAmbito(trigger.ambito, activeAmbito))
      .reduce<Record<"active" | "waiting" | "cancelled" | "finalized", number>>(
      (acc, trigger) => {
        const filter = getFlowFilterFromStatus(trigger.estado_general);
        if (!filter) return acc;
        acc[filter] += 1;
        return acc;
      },
      { active: 0, waiting: 0, cancelled: 0, finalized: 0 }
    );
  }, [activeAmbito, triggers]);

  const unclassifiedTriggers = useMemo(() => triggers.filter((trigger) => trigger.ambito === null), [triggers]);

  const linkableProjects = useMemo(() => {
    if (!linkProjectDialog) return [];
    const normalizedSearch = normalizeSearchText(linkProjectSearch.trim());
    const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
    const alreadyAssociatedIds = new Set(
      (requirementByWorkflowId[linkProjectDialog.workflowId] ?? []).map((requirement) => requirement.id)
    );
    return triggers.filter((t) => {
      if (alreadyAssociatedIds.has(t.id)) return false;
      if (!matchesActiveAmbito(t.ambito, activeAmbito)) return false;
      if (searchTerms.length > 0) {
        const searchableContent = normalizeSearchText([t.descripcion ?? "", t.solicitante ?? ""].join(" "));
        if (!searchTerms.every((term) => searchableContent.includes(term))) return false;
      }
      return true;
    });
  }, [triggers, linkProjectSearch, linkProjectDialog, activeAmbito, requirementByWorkflowId]);
  const unclassifiedWorkflowCards = useMemo(
    () =>
      Object.values(workflowsById)
        .filter((workflow) => workflow.ambito === null)
        .map((workflow) => ({
          workflow,
          linkedRequirements: requirementByWorkflowId[workflow.id] ?? [],
        })),
    [requirementByWorkflowId, workflowsById]
  );

  const today = getTodayLocalDateInput();
  const todaySortValue = toDateSortValue(today);
  const flowSearchActive = flowSearchValue.trim().length > 0;
  const activeFlowQuickFilterLabel =
    flowQuickFilterOptions.find((option) => option.value === flowQuickFilter)?.label ?? "Filtro rápido";
  const activeFlowFilterDescription = buildActiveFlowFilterDescription(stateFilter, flowQuickFilter);
  const allowedFlowQuickFilterValues = useMemo(() => getAllowedFlowQuickFiltersForStateFilter(stateFilter), [stateFilter]);
  useEffect(() => {
    if (flowQuickFilter !== "none" && !allowedFlowQuickFilterValues.includes(flowQuickFilter)) {
      setFlowQuickFilter("none");
      setFlowQuickFilterAnchorEl(null);
    }
  }, [allowedFlowQuickFilterValues, flowQuickFilter]);
  const resetFilterAction =
    stateFilter !== "active" ? (
      <Button size="small" variant="outlined" color="inherit" onClick={() => setStateFilter("active")}>
        Ver activos
      </Button>
    ) : undefined;
  const flowRows = useMemo<FlowGridRow[]>(() => {
    return allFlowCards.map((item) => {
      const step = item.relevantStep;
      const primaryDateInput = resolvePrimaryDateInput(item.workflow, step);
      const executionDateInput = toDateInputValue(item.workflow.fecha_ejecucion_actual ?? step?.fecha_ejecucion_estimada);
      const waitingSinceInput =
        item.displayStatus === "esperando_respuesta" ? toDateInputValue(item.workflow.fecha_espera_desde ?? step?.fecha_estado_actual) : "";
      const completedAtInput = toDateInputValue(item.workflow.fecha_fin);
      const stepLabel =
        step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
          ? "Disparador"
          : "Ãšltima tarea";
      const movementAtValue = getDateValue(item.latestMovementAt);
      const movementAt = movementAtValue ?? Number.MAX_SAFE_INTEGER;
      const movementDateInput = movementAtValue === null ? null : formatLocalDateInput(new Date(movementAtValue));
      const movementDayDiff = getCalendarDayDiff(movementDateInput, today);
      const movementDays = movementDayDiff === null ? null : Math.max(0, -movementDayDiff);
      const requirementLabels = item.linkedRequirements.map(
        (requirement) => requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`
      );
      const contextualDateInput = primaryDateInput || "";
      const contextualDayValue = contextualDateInput ? toDateSortValue(contextualDateInput) : null;
      const operationalSortValue =
        contextualDayValue === null
          ? 3_000_000_000
          : contextualDateInput === today
            ? contextualDayValue
            : contextualDateInput < today
              ? 1_000_000_000 + Math.max(0, todaySortValue - contextualDayValue)
              : 2_000_000_000 + contextualDayValue;
        return {
          id: item.workflow.id,
          stepId: step?.id ?? null,
          ambito: item.workflow.ambito,
          status: item.displayStatus,
        taskName: step?.nombre ?? "Sin tarea registrada",
        stepLabel,
        dateContext: item.workflow.contexto_fecha_actual,
        primaryDateInput,
        executionDateInput,
        waitingSinceInput,
        completedAtInput,
        executionAt: executionDateInput ? toDateSortValue(executionDateInput) : Number.MAX_SAFE_INTEGER,
        contextualDateInput,
        contextualDateAt: contextualDateInput ? toDateSortValue(contextualDateInput) : Number.MAX_SAFE_INTEGER,
        operationalSortValue,
        lastRecord: getLatestMeaningfulWorkflowRecord(item.workflow),
        movementLabel: formatElapsedTime(item.latestMovementAt) ?? "Sin movimiento reciente",
        movementAt,
        movementDays,
        isDueToday: executionDateInput === today,
        requirementsLabel:
          item.linkedRequirements.length === 0
            ? "Sin proyectos"
            : item.linkedRequirements.map((requirement) => requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`).join(" Â· "),
        requirementsCount: item.linkedRequirements.length,
        primaryRequirementLabel: requirementLabels[0] ?? "Sin proyectos",
        extraRequirementCount: Math.max(0, requirementLabels.length - 1),
        linkedRequirements: item.linkedRequirements.map((requirement) => ({
          id: requirement.id,
          label: requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`,
        })),
        canCancel: canCancelWorkflow(item.workflow),
        canReactivate: canReactivateWorkflow(item.workflow),
        canDelete: canDeleteWorkflow(item.workflow),
      };
    });
  }, [allFlowCards, today]);

  const setPendingDateInputRef = useCallback((rowId: string, input: HTMLInputElement | null) => {
    const inputRefs = pendingDateInputRefs.current;
    if (input) {
      inputRefs.set(rowId, input);
      return;
    }
    inputRefs.delete(rowId);
  }, []);

  const openPendingDateEditorAndPicker = useCallback((rowId: string, draftValue: string) => {
    flushSync(() => {
      setPendingDates((previous) => {
        const next = new Map(previous);
        next.set(rowId, draftValue);
        return next;
      });
    });
    openNativeDateInputPicker(pendingDateInputRefs.current.get(rowId) ?? null);
  }, []);

  const stateFilteredFlowRows = useMemo(
    () => flowRows.filter((row) => matchesFlowStateFilter(row.status, stateFilter)),
    [flowRows, stateFilter]
  );

  const quickFilteredFlowRows = useMemo(
    () => stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, flowQuickFilter, today)),
    [flowQuickFilter, stateFilteredFlowRows, today]
  );
  const quickFilterCountsByValue = useMemo<Record<FlowQuickFilter, number>>(
    () => ({
      none: stateFilteredFlowRows.length,
      today: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "today", today)).length,
      this_week: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "this_week", today)).length,
      past: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "past", today)).length,
      future: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "future", today)).length,
      without_project: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "without_project", today)).length,
      without_date: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "without_date", today)).length,
      waiting_today: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "waiting_today", today)).length,
      waiting_days: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "waiting_days", today)).length,
      waiting_week: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "waiting_week", today)).length,
      waiting_15_plus: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "waiting_15_plus", today)).length,
      waiting_month_plus: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "waiting_month_plus", today)).length,
    }),
    [stateFilteredFlowRows, today]
  );

  useEffect(() => {
    setFlowSortModel(isDateGroupedQuickFilter(flowQuickFilter) ? [{ field: "executionAt", sort: "asc" }] : [{ field: "movementAt", sort: "asc" }]);
  }, [flowQuickFilter]);

  const searchedFlowRows = useMemo(() => {
    const normalizedQuery = normalizeSearchText(flowSearchValue.trim());
    if (!normalizedQuery) {
      return quickFilteredFlowRows;
    }

    const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    return quickFilteredFlowRows.filter((row) => {
      const searchableContent = normalizeSearchText(
        [
          row.taskName,
          row.stepLabel,
          row.status,
          row.requirementsLabel,
          row.lastRecord,
          row.ambito ?? "",
          getAmbitoLabel(row.ambito),
        ].join(" ")
      );

      return searchTerms.every((term) => searchableContent.includes(term));
    });
  }, [flowSearchValue, quickFilteredFlowRows]);

  const visibleFlowRows = searchedFlowRows;
  const shouldGroupFlowRowsByDate = isDateGroupedQuickFilter(flowQuickFilter);
  const groupedFlowSections = useMemo(
    () => (shouldGroupFlowRowsByDate ? groupFlowRowsByDate(visibleFlowRows, today) : []),
    [shouldGroupFlowRowsByDate, today, visibleFlowRows]
  );

  async function handleDateBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>, row: FlowGridRow) {
    event.stopPropagation();
    if (!row.stepId) return;

    const originalValue = row.executionDateInput || "";
    const nextValue = (pendingDates.get(row.id) ?? originalValue).trim();

    if (nextValue === originalValue) {
      setPendingDates((previous) => {
        if (!previous.has(row.id)) return previous;
        const next = new Map(previous);
        next.delete(row.id);
        return next;
      });
      return;
    }

    if (isPastCalendarDateInput(nextValue, today)) {
      showToast("La fecha de ejecución no puede ser una fecha pasada.", "error");
      setPendingDates((previous) => {
        const next = new Map(previous);
        next.set(row.id, originalValue);
        return next;
      });
      return;
    }

    const isoValue = toCalendarDateUtcIso(nextValue);

    try {
      await updateStep(row.stepId, { fecha_ejecucion_estimada: isoValue });
      setWorkflowsById((previous) => {
        const workflow = previous[row.id];
        if (!workflow) return previous;
        return {
          ...previous,
          [row.id]: {
            ...workflow,
            steps: workflow.steps.map((step) => (step.id === row.stepId ? { ...step, fecha_ejecucion_estimada: isoValue } : step)),
          },
        };
      });
      setPendingDates((previous) => {
        if (!previous.has(row.id)) return previous;
        const next = new Map(previous);
        next.delete(row.id);
        return next;
      });
      showToast("Fecha actualizada", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la fecha";
      showToast(message, "error");
      setPendingDates((previous) => {
        const next = new Map(previous);
        next.set(row.id, originalValue);
        return next;
      });
    }
  }

  const requirementRows = useMemo<RequirementGridRow[]>(() => {
    return filteredRequirements.map((trigger) => {
      const linkedWorkflows = trigger.workflow_ids
        .map((workflowId) => workflowsById[workflowId])
        .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));

      const openCount = linkedWorkflows.filter((workflow) => {
        const filter = getFlowFilterFromStatus(getVisibleWorkflowStatus(workflow));
        return filter === "active" || filter === "waiting";
      }).length;

      const waitingCount = linkedWorkflows.filter(
        (workflow) => getFlowFilterFromStatus(getVisibleWorkflowStatus(workflow)) === "waiting"
      ).length;

        return {
          id: trigger.id,
          ambito: trigger.ambito,
          description: trigger.descripcion?.trim() || "Proyecto sin detalle",
          requester: trigger.solicitante?.trim() || "Sin solicitante",
          status: getVisibleTriggerStatus(trigger.estado_general),
          flowsLabel:
            linkedWorkflows.length === 0
            ? "Sin flows"
            : openCount > 0
              ? `${linkedWorkflows.length} flows Â· ${openCount} abiertos`
              : `${linkedWorkflows.length} flows`,
        waitingLabel: waitingCount > 0 ? `Esperando: ${waitingCount}` : "",
        flowCount: linkedWorkflows.length,
        openCount,
        waitingCount,
        canDelete: trigger.workflow_ids.length === 0,
      };
    });
  }, [filteredRequirements, workflowsById]);

  async function handleDeleteTrigger(trigger: TriggerDetail) {
    const detail = trigger.descripcion?.trim() || "Proyecto sin detalle";
    if (trigger.workflow_ids.length > 0) {
      setError("No se puede eliminar este proyecto porque tiene flows vinculados. Primero desvinculÃ¡ los flows que quieras conservar, o cancelÃ¡/finalizÃ¡ y eliminÃ¡ los flows que ya no correspondan.");
      return;
    }

    const confirmed = window.confirm(
      `Â¿Eliminar este proyecto?\n\n${detail}\n\nEsta acciÃ³n no se puede deshacer.\nSolo se eliminarÃ¡ si no tiene flows vinculados.`
    );
    if (!confirmed) return;

    try {
      setDeletingTriggerId(trigger.id);
      setError(null);
      await deleteTrigger(trigger.id);
      await loadData();
      setRequirementToastMessage("Proyecto eliminado.");
      setRequirementToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el proyecto");
    } finally {
      setDeletingTriggerId(null);
    }
  }

  async function handleCreateRequirement() {
    if (newRequirementDescription.trim().length < 3) {
      setCreateRequirementError("Debes indicar el proyecto.");
      return;
    }

    try {
      setCreatingRequirement(true);
      setCreateRequirementError(null);
      await createTrigger({
        descripcion: newRequirementDescription.trim(),
        solicitante: newRequirementContext.trim() || null,
        tipo: "requerimiento",
        ambito: activeAmbito,
        metadata: null,
      });
      setCreateRequirementOpen(false);
      setNewRequirementDescription("");
      setNewRequirementContext("");
      await loadData();
      setRequirementToastMessage("Proyecto creado.");
      setRequirementToastOpen(true);
    } catch (err) {
      setCreateRequirementError(err instanceof Error ? err.message : "No se pudo guardar el proyecto");
    } finally {
      setCreatingRequirement(false);
    }
  }

  function handleChangeActiveAmbito(nextAmbito: ActiveAmbitoMode | null) {
    if (!nextAmbito) return;
    setActiveAmbito(nextAmbito);
  }

  function openAmbitoAdminView() {
    navigate("/requirements?admin=ambito");
  }

  function closeAmbitoAdminView() {
    navigate("/requirements");
  }

  async function handleClassifyTrigger(triggerId: string, ambito: ActiveAmbitoMode) {
    try {
      setClassifyingItemId(`trigger:${triggerId}:${ambito}`);
      setError(null);
      await updateTrigger(triggerId, { ambito, propagate_ambito: true });
      await loadData();
      setRequirementToastMessage(`Proyecto clasificado como ${getAmbitoLabel(ambito)}.`);
      setRequirementToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo clasificar el proyecto");
    } finally {
      setClassifyingItemId(null);
    }
  }

  async function handleClassifyWorkflow(workflowId: string, ambito: ActiveAmbitoMode) {
    try {
      setClassifyingItemId(`workflow:${workflowId}:${ambito}`);
      setError(null);
      await updateWorkflow(workflowId, { ambito, propagate_ambito: true });
      await loadData();
      setFlowToastMessage(`Flow clasificado como ${getAmbitoLabel(ambito)}.`);
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo clasificar el flow");
    } finally {
      setClassifyingItemId(null);
    }
  }

  async function handleCancelFlowAction(workflowId: string) {
    const workflow = workflowsById[workflowId];
    if (!workflow || !canCancelWorkflow(workflow)) return;
    const currentTask = pickRelevantStep(workflow)?.nombre?.trim() || workflow.objetivo_final?.trim() || "Flow sin tarea actual";

    const confirmed = window.confirm(
      `Â¿Cancelar este flow?\n\n${currentTask}\n\nEl flow saldra de la operacion activa y quedara en modo cancelado.\nNo se eliminaran tareas, comentarios ni proyectos vinculados.\nSi fue un error, luego podras reactivarlo.`
    );
    if (!confirmed) return;

    try {
      setCancellingFlowId(workflowId);
      setError(null);
      await cancelWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow cancelado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el flow.");
    } finally {
      setCancellingFlowId(null);
    }
  }

  async function handleReactivateFlowAction(workflowId: string) {
    const workflow = workflowsById[workflowId];
    if (!workflow || !canReactivateWorkflow(workflow)) return;
    const currentTask = pickRelevantStep(workflow)?.nombre?.trim() || workflow.objetivo_final?.trim() || "Flow sin tarea actual";

    const confirmed = window.confirm(
      `Â¿Reactivar este flow?\n\n${currentTask}\n\nEl flow volvera a la operacion activa.\nNo se eliminaran tareas, comentarios ni proyectos vinculados.`
    );
    if (!confirmed) return;

    try {
      setReactivatingFlowId(workflowId);
      setError(null);
      await reactivateWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow reactivado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reactivar el flow.");
    } finally {
      setReactivatingFlowId(null);
    }
  }

  async function handleDeleteFlowAction(workflowId: string) {
    const workflow = workflowsById[workflowId];
    if (!workflow || !canDeleteWorkflow(workflow)) return;

    const confirmed = window.confirm(
      "Â¿Eliminar este flow?\n\nEsta acciÃ³n eliminarÃ¡ el flow, sus tareas, comentarios, historial, eventos externos y vÃ­nculos con proyectos.\n\nEsta acciÃ³n no se puede deshacer."
    );
    if (!confirmed) return;

    try {
      setDeletingFlowId(workflowId);
      setError(null);
      await deleteWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow eliminado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el flow.");
    } finally {
      setDeletingFlowId(null);
    }
  }

  function openCaptureModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("modal", "capture");
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  const isFlowsView = viewMode === "flows";
  const pageTitle = title || (isFlowsView ? "Flows" : "Proyectos");
  const currentCounts = isFlowsView ? flowCounts : requirementCounts;

  const handleWorkflowNavigate = useCallback(
    (workflowId: string) => {
      navigateWithOrigin(navigate, location, `/workflows/${workflowId}`, location.pathname);
    },
    [location, navigate]
  );

  const handleProjectNavigate = useCallback(
    (requirementId: string, event?: React.MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      navigateWithOrigin(navigate, location, `/requirements/${requirementId}`, location.pathname);
    },
    [location, navigate]
  );

  const dateColumnVisibility = getFlowDateColumnVisibility(stateFilter);
  const showStatusColumn = shouldShowStatusColumn(stateFilter);

  const flowColumns = useMemo<GridColDef<FlowGridRow>[]>(
    () => [
      {
        field: "ambito",
        headerName: "Ãmbito",
        width: 128,
        minWidth: 120,
        sortable: false,
        renderCell: (params) => <AmbitoChip ambito={params.row.ambito} />,
      },
      {
        field: "taskName",
        headerName: "Tarea inicial / disparador",
        flex: 1.45,
        minWidth: 300,
        align: "left",
        headerAlign: "left",
        disableReorder: true,
        headerClassName: "flow-grid-sticky-column",
        cellClassName: "flow-grid-sticky-column-cell",
        valueGetter: (_, row) => `${row.stepLabel} ${row.taskName}`,
        renderCell: (params) => {
          const row = params.row;
          const statusHighlight = getStatusHighlight(row.status, theme);
          return (
            <Tooltip title={humanizeStatus(row.status)}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "stretch", minWidth: 0, width: "100%", py: 0.25 }}>
                <Box
                  aria-hidden
                  sx={(theme) => ({
                    width: 4,
                    flexShrink: 0,
                    borderRadius: theme.appShape.sm,
                    backgroundColor: statusHighlight.accent,
                    alignSelf: "stretch",
                    minHeight: 34,
                  })}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    whiteSpace: "normal",
                    lineHeight: 1.25,
                    minWidth: 0,
                    alignSelf: "center",
                  }}
                >
                  {row.taskName}
                </Typography>
              </Stack>
            </Tooltip>
          );
        },
      },
      {
        field: "lastRecord",
        headerName: "Registro",
        flex: 1.35,
        minWidth: 300,
        align: "left",
        headerAlign: "left",
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "requirementsLabel",
        headerName: "Proyecto",
        flex: 1.2,
        minWidth: 260,
        align: "left",
        headerAlign: "left",
        sortable: false,
        renderCell: (params) => {
          const row = params.row;
          const hasNoProjects = row.linkedRequirements.length === 0;
          const hasOneProject = row.linkedRequirements.length === 1;
          const primaryProjectId = row.linkedRequirements[0]?.id;

          if (hasNoProjects) {
            return (
              <ButtonBase
                onClick={(event) => {
                  event.stopPropagation();
                  setLinkProjectDialog({ workflowId: row.id, workflowName: row.taskName });
                }}
                onMouseDown={(event) => event.stopPropagation()}
                sx={{
                  color: "text.disabled",
                  fontSize: "0.8rem",
                  px: 0.5,
                  py: 0.25,
                  borderRadius: (theme) => `${theme.appShape.sm}px`,
                  "&:hover": { color: "text.secondary" },
                }}
              >
                + Asociar proyecto
              </ButtonBase>
            );
          }

          if (hasOneProject) {
            return (
              <ButtonBase
                onClick={(event: React.MouseEvent<HTMLElement>) => {
                  if (primaryProjectId) {
                    handleProjectNavigate(primaryProjectId, event);
                  }
                }}
                sx={{
                  color: "inherit",
                  textAlign: "left",
                  width: "100%",
                  justifyContent: "flex-start",
                  borderRadius: (theme) => `${theme.appShape.sm}px`,
                  px: 0.5,
                  py: 0.25,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}
                >
                  {row.primaryRequirementLabel}
                </Typography>
              </ButtonBase>
            );
          }

          return (
            <ButtonBase
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation();
                setRequirementsMenu({ rowId: row.id, anchorEl: event.currentTarget as HTMLElement });
              }}
              sx={{
                color: "inherit",
                textAlign: "left",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: (theme) => `${theme.appShape.sm}px`,
                px: 0.5,
                py: 0.25,
              }}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0, width: "100%" }}>
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}
                >
                  {row.primaryRequirementLabel}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`+${row.extraRequirementCount}`}
                  sx={(theme) => ({
                    height: 22,
                    flexShrink: 0,
                    borderRadius: theme.appShape.sm,
                    borderColor: theme.palette.outlineVariant,
                    color: theme.palette.text.secondary,
                    backgroundColor: theme.palette.surfaceContainerLowest,
                    pointerEvents: "none",
                  })}
                  aria-label={`${row.linkedRequirements.length} proyectos vinculados`}
                />
              </Stack>
            </ButtonBase>
          );
        },
      },
      {
        field: "movementAt",
        headerName: "Inactividad",
        width: 126,
        minWidth: 120,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const heatVisual = getMovementHeatVisual(params.row.movementDays);
          return (
            <Stack direction="row" spacing={0.45} sx={{ alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color="text.secondary">
                {params.row.movementLabel}
              </Typography>
              {heatVisual ? (
                <LocalFireDepartmentRoundedIcon sx={{ fontSize: 14, color: heatVisual.color, opacity: heatVisual.opacity }} />
              ) : null}
            </Stack>
          );
        },
      },
      ...(showStatusColumn
        ? [
            {
              field: "status",
              headerName: "Estado",
              width: 150,
              minWidth: 140,
              align: "center" as const,
              headerAlign: "center" as const,
              sortable: false,
              renderCell: (params: GridRenderCellParams<FlowGridRow>) => (
                <Box sx={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
                  <StatusBadge value={params.row.status} />
                </Box>
              ),
            },
          ]
        : []),
      ...(dateColumnVisibility.waiting
        ? [
            {
              field: "waitingSinceInput",
              headerName: "En espera desde",
              width: 172,
              minWidth: 160,
              align: "center" as const,
              headerAlign: "center" as const,
              valueGetter: (_: unknown, row: FlowGridRow) =>
                row.waitingSinceInput ? getFlowDateGroupSortKey(row.waitingSinceInput, today) : Number.MAX_SAFE_INTEGER,
              renderCell: (params: GridRenderCellParams<FlowGridRow>) => {
                const rowState = getFlowFilterFromStatus(params.row.status);
                if (rowState === "active") {
                  return renderNotApplicableDateCell("Solo aplica a flows en espera");
                }

                const value = params.row.waitingSinceInput;
                if (!value) {
                  return (
                    <Typography variant="caption" color="text.secondary">
                      Sin fecha registrada
                    </Typography>
                  );
                }
                const absoluteDateLabel = formatCalendarDate(value);
                const elapsedLabel = formatElapsedTime(value);
                return (
                  <Tooltip title={absoluteDateLabel ?? "En espera"}>
                    <Stack spacing={0} sx={{ alignItems: "center", minWidth: 134 }}>
                      <Typography variant="body2" sx={{ fontSize: "0.84rem", fontWeight: 500, lineHeight: 1.2 }}>
                        {elapsedLabel ?? "En espera"}
                      </Typography>
                      {absoluteDateLabel ? (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                          {absoluteDateLabel}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Tooltip>
                );
              },
            },
          ]
        : []),
      ...(dateColumnVisibility.execution
        ? [
            {
              field: "executionAt",
              headerName: "Fecha de ejecucion",
              width: 172,
              minWidth: 160,
              align: "center" as const,
              headerAlign: "center" as const,
              valueGetter: (_: unknown, row: FlowGridRow) => row.operationalSortValue,
              renderCell: (params: GridRenderCellParams<FlowGridRow>) => {
                const row = params.row;
                const rowState = getFlowFilterFromStatus(row.status);
                if (rowState === "waiting") {
                  return renderNotApplicableDateCell("Solo aplica a flows activos");
                }

                const originalValue = row.executionDateInput;
                const isEditing = pendingDates.has(row.id);

                if (!isEditing) {
                  if (originalValue) {
                    const absoluteDateLabel = formatCalendarDate(originalValue);
                    const relativeLabel = originalValue <= today ? formatRelativeCalendarDay(originalValue) : null;
                    const dateLabel = relativeLabel ?? absoluteDateLabel ?? "Sin fecha";
                    const shouldPulseToday = row.isDueToday;
                    const statusHighlight = getStatusHighlight(row.status, theme);
                    return (
                      <Tooltip title={absoluteDateLabel ?? dateLabel}>
                        <ButtonBase
                          disabled={!row.stepId || row.dateContext === "cerrado"}
                          onClick={(event) => {
                            event.stopPropagation();
                            openPendingDateEditorAndPicker(row.id, originalValue);
                          }}
                          sx={(theme) => ({
                            borderRadius: theme.appShape.sm,
                            px: 0.5,
                            py: 0.25,
                            width: "100%",
                            justifyContent: "center",
                          })}
                        >
                          <Stack
                            spacing={0}
                            sx={(theme) => ({
                              alignItems: "center",
                              minWidth: 134,
                              borderRadius: theme.appShape.sm,
                              px: shouldPulseToday ? 0.45 : 0,
                              backgroundColor: shouldPulseToday ? statusHighlight.soft : "transparent",
                              border: shouldPulseToday ? `1px solid ${statusHighlight.border}` : "1px solid transparent",
                              transition: theme.transitions.create(["background-color", "border-color"], {
                                duration: theme.appMotion.short,
                              }),
                            })}
                          >
                            <Typography variant="body2" sx={{ fontSize: "0.82rem", lineHeight: 1.2 }}>
                              {dateLabel}
                            </Typography>
                            {absoluteDateLabel && absoluteDateLabel !== dateLabel ? (
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                                {absoluteDateLabel}
                              </Typography>
                            ) : null}
                          </Stack>
                        </ButtonBase>
                      </Tooltip>
                    );
                  }
                  return (
                    <IconButton
                      size="small"
                      disabled={!row.stepId || row.dateContext === "cerrado"}
                      onClick={(event) => {
                        event.stopPropagation();
                        openPendingDateEditorAndPicker(row.id, "");
                      }}
                      sx={{ opacity: 0.38, "&:hover": { opacity: 0.9 } }}
                    >
                      <EditCalendarRoundedIcon fontSize="small" />
                    </IconButton>
                  );
                }

                const value = pendingDates.get(row.id) ?? originalValue;
                return (
                  <TextField
                    type="date"
                    size="small"
                    variant="outlined"
                    value={value}
                    autoFocus={isEditing}
                    inputRef={(input) => {
                      setPendingDateInputRef(row.id, input);
                    }}
                    disabled={!row.stepId}
                    slotProps={{ htmlInput: { min: today } }}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation();
                      setPendingDates((previous) => {
                        const next = new Map(previous);
                        next.set(row.id, event.target.value);
                        return next;
                      });
                    }}
                    onBlur={(event) => {
                      void handleDateBlur(event, row);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") {
                        setPendingDates((previous) => {
                          if (!previous.has(row.id)) return previous;
                          const next = new Map(previous);
                          next.delete(row.id);
                          return next;
                        });
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    sx={(theme) => ({
                      minWidth: 150,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: theme.appShape.sm,
                        backgroundColor: theme.palette.surfaceContainerLowest,
                      },
                      "& input": {
                        fontSize: "0.82rem",
                        padding: "4px 8px",
                      },
                    })}
                  />
                );
              },
            },
          ]
        : []),
      ...(dateColumnVisibility.completed
        ? [
            {
              field: "completedAtInput",
              headerName: "Finalizacion",
              width: 156,
              minWidth: 146,
              align: "center" as const,
              headerAlign: "center" as const,
              valueGetter: (_: unknown, row: FlowGridRow) =>
                row.completedAtInput ? getFlowDateGroupSortKey(row.completedAtInput, today) : Number.MAX_SAFE_INTEGER,
              renderCell: (params: GridRenderCellParams<FlowGridRow>) => {
                const value = params.row.completedAtInput;
                return (
                  <Typography variant="body2" color={value ? "text.primary" : "text.secondary"} sx={{ fontSize: "0.82rem", lineHeight: 1.2 }}>
                    {value ? formatCalendarDate(value) : "Sin cierre"}
                  </Typography>
                );
              },
            },
          ]
        : []),
    ],
    [
      dateColumnVisibility.completed,
      dateColumnVisibility.execution,
      dateColumnVisibility.waiting,
      openPendingDateEditorAndPicker,
      pendingDates,
      setPendingDateInputRef,
      showStatusColumn,
      theme,
      today,
      handleProjectNavigate,
      setRequirementsMenu,
      setLinkProjectDialog,
    ]
  );

  const visibleFlowColumns = useMemo(
    () => flowColumns.filter((column) => column.field !== "ambito"),
    [flowColumns]
  );
  const flowVisibleColumnBaseOrder = useMemo(
    () => visibleFlowColumns.map((column) => String(column.field)),
    [visibleFlowColumns]
  );
  const sanitizedFlowColumnOrder = useMemo(
    () => flowVisibleColumnBaseOrder,
    [flowVisibleColumnBaseOrder]
  );
  const orderedVisibleFlowColumns = useMemo(
    () => visibleFlowColumns,
    [visibleFlowColumns]
  );
  const flowGroupedHeaderTemplateColumns = useMemo(
    () => buildGroupedHeaderTemplateColumns(orderedVisibleFlowColumns),
    [orderedVisibleFlowColumns]
  );
  const flowGroupedHeaderMinWidth = useMemo(
    () => getGroupedHeaderMinWidth(orderedVisibleFlowColumns),
    [orderedVisibleFlowColumns]
  );

  useEffect(() => {
    if (!areStringArraysEqual(flowColumnOrder, sanitizedFlowColumnOrder)) {
      setFlowColumnOrder(sanitizedFlowColumnOrder);
    }
  }, [flowColumnOrder, sanitizedFlowColumnOrder]);

  useEffect(() => {
    storeFlowColumnOrder(sanitizedFlowColumnOrder);
  }, [sanitizedFlowColumnOrder]);

  const isFlowColumnReorderable = useCallback((_field: string) => false, []);

  const commitFlowColumnSwap = useCallback(
    (draggedField: string, targetField: string) => {
      if (!isFlowColumnReorderable(draggedField) || !isFlowColumnReorderable(targetField) || draggedField === targetField) {
        return;
      }

      setFlowColumnOrder((previous) =>
        swapFlowColumnsInOrder(sanitizeFlowColumnOrder(flowVisibleColumnBaseOrder, previous), draggedField, targetField)
      );
    },
    [flowVisibleColumnBaseOrder, isFlowColumnReorderable]
  );

  const handleFlowColumnDragStart = useCallback(
    (event: ReactDragEvent<HTMLElement>, field: string) => {
      if (!isFlowColumnReorderable(field)) {
        event.preventDefault();
        return;
      }

      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", field);
      setDraggedFlowColumnField(field);
      setFlowColumnDropTargetField(field);
    },
    [isFlowColumnReorderable]
  );

  const handleFlowColumnDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, field: string) => {
      if (!draggedFlowColumnField || !isFlowColumnReorderable(field)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (field !== flowColumnDropTargetField) {
        setFlowColumnDropTargetField(field);
      }
    },
    [draggedFlowColumnField, flowColumnDropTargetField, isFlowColumnReorderable]
  );

  const clearFlowColumnDragState = useCallback(() => {
    setDraggedFlowColumnField(null);
    setFlowColumnDropTargetField(null);
  }, []);

  const handleFlowColumnDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetField: string) => {
      event.preventDefault();
      event.stopPropagation();

      const draggedField = draggedFlowColumnField ?? event.dataTransfer.getData("text/plain");
      if (!draggedField) {
        clearFlowColumnDragState();
        return;
      }

      commitFlowColumnSwap(draggedField, targetField);
      clearFlowColumnDragState();
    },
    [clearFlowColumnDragState, commitFlowColumnSwap, draggedFlowColumnField]
  );

  const interactiveOrderedVisibleFlowColumns = useMemo(
    () =>
      orderedVisibleFlowColumns.map((column) => {
        const field = String(column.field);
        const isReorderable = isFlowColumnReorderable(field);
        const isDropTarget = field === flowColumnDropTargetField && draggedFlowColumnField !== field;

        return {
          ...column,
          renderHeader: () => (
            <Box
              draggable={isReorderable}
              onDragStart={(event) => handleFlowColumnDragStart(event, field)}
              onDragOver={(event) => handleFlowColumnDragOver(event, field)}
              onDrop={(event) => handleFlowColumnDrop(event, field)}
              onDragEnd={clearFlowColumnDragState}
              sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                justifyContent:
                  (column.headerAlign ?? column.align ?? "left") === "center"
                    ? "center"
                    : (column.headerAlign ?? column.align ?? "left") === "right"
                      ? "flex-end"
                      : "flex-start",
                gap: 0.5,
                width: "100%",
                minWidth: 0,
                cursor: isReorderable ? "grab" : "default",
                opacity: draggedFlowColumnField === field ? 0.58 : 1,
                color: isDropTarget ? theme.palette.status.active.accent : "inherit",
                transition: theme.transitions.create(["color", "opacity"], {
                  duration: theme.appMotion.short,
                }),
              })}
            >
              {isReorderable ? <DragIndicatorRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} /> : null}
              <Typography
                variant="inherit"
                sx={(theme) => ({
                  fontWeight: isDropTarget ? 800 : 700,
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  borderBottom: isDropTarget ? `2px solid ${theme.palette.status.active.accent}` : "2px solid transparent",
                })}
              >
                {column.headerName ?? field}
              </Typography>
            </Box>
          ),
        } satisfies GridColDef<FlowGridRow>;
      }),
    [
      clearFlowColumnDragState,
      draggedFlowColumnField,
      flowColumnDropTargetField,
      handleFlowColumnDragOver,
      handleFlowColumnDragStart,
      handleFlowColumnDrop,
      isFlowColumnReorderable,
      orderedVisibleFlowColumns,
    ]
  );

  const requirementColumns = useMemo<GridColDef<RequirementGridRow>[]>(
    () => [
      {
        field: "description",
        headerName: "Proyecto",
        flex: 1.5,
        minWidth: 280,
        align: "left",
        headerAlign: "left",
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "requester",
        headerName: "Solicitante",
        flex: 1.1,
        minWidth: 220,
        align: "left",
        headerAlign: "left",
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 150,
        minWidth: 140,
        align: "left",
        headerAlign: "left",
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%", width: "100%" }}>
            <StatusBadge value={params.value} />
          </Box>
        ),
      },
      {
        field: "ambito",
        headerName: "Ãmbito",
        width: 128,
        minWidth: 120,
        sortable: false,
        renderCell: (params) => <AmbitoChip ambito={params.row.ambito} />,
      },
      {
        field: "flowsLabel",
        headerName: "Flows",
        flex: 1,
        minWidth: 220,
        align: "left",
        headerAlign: "left",
        renderCell: (params) => {
          const row = params.row;
          const activeCount = row.openCount - row.waitingCount;
          return (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.4 }}>
              {row.flowCount === 0 ? (
                <Chip size="small" variant="outlined" label="Sin flows" />
              ) : (
                <>
                  <Chip size="small" variant="outlined" label={`${row.flowCount} flows`} />
                  {activeCount > 0 && (
                    <Chip size="small" variant="filled" color="info" label={`${activeCount} activos`} />
                  )}
                  {row.waitingCount > 0 && (
                    <Chip size="small" variant="filled" color="warning" label={`${row.waitingCount} esperando`} />
                  )}
                </>
              )}
            </Stack>
          );
        },
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Acciones",
        width: 116,
        align: "center",
        headerAlign: "center",
        getActions: (params) => {
          const row = params.row;
          return [
            <GridActionsCellItem
              key="open"
              icon={<LaunchRoundedIcon fontSize="small" />}
              label="Abrir proyecto"
              onClick={(event) => {
                event.stopPropagation();
                handleProjectNavigate(row.id);
              }}
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteOutlineRoundedIcon fontSize="small" />}
              label={deletingTriggerId === row.id ? "Eliminando..." : "Eliminar proyecto"}
              disabled={!row.canDelete || Boolean(deletingTriggerId)}
              onClick={(event) => {
                event.stopPropagation();
                const trigger = triggers.find((item) => item.id === row.id);
                if (!trigger) return;
                void handleDeleteTrigger(trigger);
              }}
              showInMenu
            />,
          ];
        },
      },
    ],
    [deletingTriggerId, handleProjectNavigate, triggers]
  );

  function GridToolbar({
    quickFilterPlaceholder = "",
    searchOpen = false,
    searchValue = "",
    onSearchToggle,
    onSearchChange,
    onSearchClearOrClose,
  }: FlowGridToolbarProps) {
    const searchIsEmpty = searchValue.trim().length === 0;

    return (
      <Toolbar aria-label="Toolbar del listado" style={{ gap: "6px", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <ToolbarButton aria-label={searchOpen ? "Alternar bÃºsqueda" : "Buscar"} onClick={onSearchToggle}>
            <SearchRoundedIcon fontSize="small" />
          </ToolbarButton>
          {searchOpen ? (
            <>
              <TextField
                aria-label="BÃºsqueda rÃ¡pida"
                placeholder={quickFilterPlaceholder}
                size="small"
                fullWidth={false}
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && searchIsEmpty) {
                    onSearchClearOrClose?.();
                  }
                }}
                sx={{ width: { xs: 180, sm: 280 } }}
              />
              <ToolbarButton
                aria-label={searchIsEmpty ? "Cerrar bÃºsqueda" : "Limpiar bÃºsqueda"}
                onClick={onSearchClearOrClose}
              >
                <CancelOutlinedIcon fontSize="small" />
              </ToolbarButton>
            </>
          ) : null}
        </Stack>

        <Box sx={{ flex: 1 }} />

        <ColumnsPanelTrigger
          aria-label="Columnas"
          render={<ToolbarButton aria-label="Columnas">{<ViewColumnRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
        <FilterPanelTrigger
          aria-label="Filtros"
          render={<ToolbarButton aria-label="Filtros">{<FilterListRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
        <ExportCsv
          aria-label="Descargar"
          render={<ToolbarButton aria-label="Descargar CSV">{<DownloadRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
      </Toolbar>
    );
  }

  return (
    <Stack spacing={2}>
      <Snackbar
        open={requirementToastOpen}
        autoHideDuration={2600}
        onClose={() => setRequirementToastOpen(false)}
        message={requirementToastMessage}
      />
      <Snackbar
        open={flowToastOpen}
        autoHideDuration={2600}
        onClose={() => setFlowToastOpen(false)}
        message={flowToastMessage}
      />

      <Dialog
        open={linkProjectDialog !== null}
        onClose={handleCloseLinkProjectDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0.5 }}>Asociar proyecto</DialogTitle>
        <DialogContent>
          {linkProjectDialog && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {`Flow: ${linkProjectDialog.workflowName}`}
            </Typography>
          )}
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Buscar proyecto"
            placeholder="Buscar proyecto..."
            value={linkProjectSearch}
            onChange={(event) => setLinkProjectSearch(event.target.value)}
            sx={{ mb: 1 }}
          />
          {linkableProjects.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {linkProjectSearch.trim()
                ? "No se encontraron proyectos."
                : "No hay proyectos disponibles para asociar."}
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
              <List disablePadding>
              {linkableProjects.map((project) => (
                <ListItemButton
                  key={project.id}
                  disabled={linkProjectLoading}
                  onClick={() => void handleLinkProject(project.id)}
                  sx={{ alignItems: "flex-start", py: 1, borderRadius: (theme) => theme.appShape.sm }}
                >
                  <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}
                    >
                      {project.descripcion?.trim() || `Proyecto ${project.id.slice(0, 8)}`}
                    </Typography>
                    {project.solicitante?.trim() ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {project.solicitante.trim()}
                      </Typography>
                    ) : null}
                  </Stack>
                </ListItemButton>
              ))}
              </List>
            </Box>
          )}
          {linkProjectLoading && <LinearProgress sx={{ mt: 1.5 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLinkProjectDialog} disabled={linkProjectLoading}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      <PageContainer
        breadcrumbs={[]}
        title={pageTitle}
        actions={
          <>
            <Tooltip title="Refrescar">
              <IconButton color="inherit" aria-label="Refrescar listado" onClick={() => void loadData()}>
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {isFlowsView ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCaptureModal}>
                Capturar tarea
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setCreateRequirementOpen((value) => !value);
                  setCreateRequirementError(null);
                }}
              >
                {createRequirementOpen ? "Cerrar formulario" : "Nuevo proyecto"}
              </Button>
            )}
          </>
        }
      >
        <Stack spacing={1.5}>
          {!lockView && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, value: ViewMode | null) => {
                if (!value) return;
                setViewMode(value);
                setStateFilter(getDefaultFilterForView(value));
                if (value !== "flows") {
                  setFlowQuickFilter("none");
                  setFlowQuickFilterAnchorEl(null);
                }
                setCreateRequirementOpen(false);
                setCreateRequirementError(null);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              <ToggleButton value="flows">Flows</ToggleButton>
              <ToggleButton value="requirements">Proyectos</ToggleButton>
            </ToggleButtonGroup>
          )}

          {(unclassifiedTriggers.length > 0 || unclassifiedWorkflowCards.length > 0) && (
            <Alert
              severity="info"
              action={
                isAmbitoAdminView ? (
                  <Button color="inherit" size="small" onClick={closeAmbitoAdminView}>
                    Cerrar vista
                  </Button>
                ) : (
                  <Button color="inherit" size="small" onClick={openAmbitoAdminView}>
                    Clasificar
                  </Button>
                )
              }
            >
              {`Hay ${unclassifiedTriggers.length + unclassifiedWorkflowCards.length} elemento(s) sin Ã¡mbito definido fuera del modo ${getAmbitoLabel(activeAmbito)}.`}
            </Alert>
          )}

          {isAmbitoAdminView && (
            <Paper sx={{ p: { xs: 1.5, md: 1.8 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Clasificar elementos sin Ã¡mbito</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    Estos registros legacy no aparecen en la operaciÃ³n principal hasta asignarles Laboral o Personal.
                  </Typography>
                </Box>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Proyectos sin definir
                  </Typography>
                  {unclassifiedTriggers.length === 0 ? (
                    <Alert severity="success">No hay proyectos pendientes de clasificar.</Alert>
                  ) : (
                    unclassifiedTriggers.map((trigger) => (
                      <Paper key={trigger.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
                        >
                          <Box>
                            <Typography variant="body1">{trigger.descripcion?.trim() || "Proyecto sin descripciÃ³n"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {trigger.solicitante?.trim() || "Sin solicitante"} Â· {trigger.workflow_ids.length} flow(s) vinculado(s)
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => void handleClassifyTrigger(trigger.id, "laboral")}
                              disabled={classifyingItemId !== null}
                            >
                              {classifyingItemId === `trigger:${trigger.id}:laboral` ? "Guardando..." : "Laboral"}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => void handleClassifyTrigger(trigger.id, "personal")}
                              disabled={classifyingItemId !== null}
                            >
                              {classifyingItemId === `trigger:${trigger.id}:personal` ? "Guardando..." : "Personal"}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))
                  )}
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Flows sin definir
                  </Typography>
                  {unclassifiedWorkflowCards.length === 0 ? (
                    <Alert severity="success">No hay flows pendientes de clasificar.</Alert>
                  ) : (
                    unclassifiedWorkflowCards.map(({ workflow, linkedRequirements }) => {
                      const requiresProjectClassification = linkedRequirements.length > 0;
                      return (
                        <Paper key={workflow.id} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1}
                            sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
                          >
                            <Box>
                              <Typography variant="body1">{workflow.objetivo_final?.trim() || "Flow sin tÃ­tulo"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {linkedRequirements.length > 0
                                  ? `Clasificar desde el proyecto asociado: ${linkedRequirements
                                      .map((item) => item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`)
                                      .join(" Â· ")}`
                                  : "Sin proyecto asociado"}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => void handleClassifyWorkflow(workflow.id, "laboral")}
                                disabled={classifyingItemId !== null || requiresProjectClassification}
                              >
                                {classifyingItemId === `workflow:${workflow.id}:laboral` ? "Guardando..." : "Laboral"}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => void handleClassifyWorkflow(workflow.id, "personal")}
                                disabled={classifyingItemId !== null || requiresProjectClassification}
                              >
                                {classifyingItemId === `workflow:${workflow.id}:personal` ? "Guardando..." : "Personal"}
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}

          <Menu
            anchorEl={requirementsMenu?.anchorEl ?? null}
            open={requirementsMenu !== null}
            onClose={() => setRequirementsMenu(null)}
            slotProps={{
              paper: {
                sx: { maxHeight: 320 },
              },
            }}
          >
            {requirementsMenu && (
              <>
                {flowRows
                  .find((row) => row.id === requirementsMenu.rowId)
                  ?.linkedRequirements.map((requirement) => (
                    <MenuItem
                      key={requirement.id}
                      onClick={(event: React.MouseEvent<HTMLLIElement>) => {
                        event.stopPropagation();
                        setRequirementsMenu(null);
                        handleProjectNavigate(requirement.id);
                      }}
                    >
                      {requirement.label}
                    </MenuItem>
                  ))}
              </>
            )}
          </Menu>

          {!isFlowsView && createRequirementOpen && (
            <Paper sx={{ p: { xs: 1.5, md: 1.8 } }}>
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" color="text.secondary">
                  Crear proyecto
                </Typography>
                <TextField
                  label="Proyecto"
                  multiline
                  minRows={2}
                  value={newRequirementDescription}
                  onChange={(event) => setNewRequirementDescription(event.target.value)}
                  disabled={creatingRequirement}
                />
                <TextField
                  label="Solicitante"
                  value={newRequirementContext}
                  onChange={(event) => setNewRequirementContext(event.target.value)}
                  disabled={creatingRequirement}
                />
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Se crearÃ¡ como: {getAmbitoLabel(activeAmbito)}
                </Alert>
                {createRequirementError && <Alert severity="error">{createRequirementError}</Alert>}
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => void handleCreateRequirement()} disabled={creatingRequirement}>
                    {creatingRequirement ? "Creando..." : "Guardar proyecto"}
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setCreateRequirementOpen(false);
                      setCreateRequirementError(null);
                      setNewRequirementDescription("");
                      setNewRequirementContext("");
                    }}
                    disabled={creatingRequirement}
                  >
                    Cancelar
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", lg: "row" },
              alignItems: { xs: "stretch", lg: "flex-start" },
              gap: 1.5,
              width: "100%",
            }}
          >
            <Box
              sx={{
                width: { xs: "100%", sm: 260 },
                maxWidth: { xs: "100%", sm: 260 },
                flexShrink: 0,
              }}
            >
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Tabs
                  value={activeAmbito}
                  onChange={(_, value: ActiveAmbitoMode | null) => handleChangeActiveAmbito(value)}
                  variant="fullWidth"
                  aria-label="Modo de Ã¡mbito"
                  sx={{
                    minHeight: 64,
                    "& .MuiTabs-indicator": {
                      height: 3,
                    },
                  }}
                >
                  {activeAmbitoOptions.map((option) => {
                    const isLaboral = option.value === "laboral";
                    const accent = isLaboral ? theme.palette.primary : theme.palette.secondary;
                    return (
                      <Tab
                        key={option.value}
                        value={option.value}
                        icon={getAmbitoModeIcon(option.value)}
                        iconPosition="top"
                        label={option.label}
                        sx={{
                          minWidth: 0,
                          minHeight: 64,
                          px: 0.75,
                          py: 0.5,
                          textTransform: "none",
                          fontWeight: 500,
                          fontSize: "0.73rem",
                          letterSpacing: "0.01em",
                          lineHeight: 1.15,
                          whiteSpace: "nowrap",
                          color: "text.secondary",
                          "& .MuiTab-iconWrapper": {
                            marginBottom: 0.25,
                          },
                          "& .MuiSvgIcon-root": {
                            fontSize: 16,
                            color: "text.secondary",
                          },
                          "&.Mui-selected": {
                            color: accent.main,
                            backgroundColor: alpha(accent.main, 0.1),
                          },
                          "&.Mui-selected .MuiSvgIcon-root": {
                            color: accent.main,
                          },
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Paper>
            </Box>

            <Box sx={{ width: "100%", maxWidth: 620, ml: { lg: "auto" } }}>
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(5, minmax(0, 1fr))" },
                    gridTemplateRows: "auto auto",
                  }}
                >
                  {(
                    [
                      {
                        value: "active" as const,
                        label: "Activos",
                        token: theme.palette.status.active,
                        count: currentCounts.active,
                      },
                      {
                        value: "waiting" as const,
                        label: "Esperando",
                        token: theme.palette.status.waiting,
                        count: currentCounts.waiting,
                      },
                      {
                        value: "non_operational" as const,
                        label: "No operativos",
                        token: theme.palette.status.cancelled,
                        count: currentCounts.cancelled + currentCounts.finalized,
                      },
                      {
                        value: "cancelled" as const,
                        label: "Cancelados",
                        token: theme.palette.status.cancelled,
                        count: currentCounts.cancelled,
                      },
                      {
                        value: "finalized" as const,
                        label: "Finalizados",
                        token: theme.palette.status.finalized,
                        count: currentCounts.finalized,
                      },
                    ] as const
                  ).map((option, idx) => {
                    const isSelected =
                      stateFilter === option.value ||
                      (option.value === "non_operational" && (stateFilter === "cancelled" || stateFilter === "finalized"));
                    const iconColor = isSelected ? option.token.accent : "text.disabled";
                    const iconSx = { fontSize: 13, mb: 0.25, color: iconColor };
                    return (
                      <ButtonBase
                        key={option.value}
                        onClick={() => setStateFilter(option.value)}
                        sx={{
                          gridColumn: { xs: idx === 4 ? "1 / 3" : undefined, sm: idx + 1 },
                          gridRow: { xs: Math.floor(idx / 2) + 1, sm: 1 },
                          py: 1,
                          px: 0.5,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRight: {
                            xs: idx % 2 === 0 && idx !== 4 ? "1px solid" : "none",
                            sm: idx < 4 ? "1px solid" : "none",
                          },
                          borderBottom: {
                            xs: idx < 4 ? "1px solid" : "none",
                            sm: "none",
                          },
                          borderColor: "divider",
                          backgroundColor: isSelected
                            ? option.token.container
                            : "transparent",
                          color: isSelected ? option.token.onContainer : "text.secondary",
                          transition: "background-color 0.15s",
                          "&:hover": {
                            backgroundColor: alpha(option.token.container, 0.6),
                          },
                        }}
                      >
                        {option.value === "active" && <BoltRoundedIcon sx={iconSx} />}
                        {option.value === "waiting" && <HourglassTopRoundedIcon sx={iconSx} />}
                        {option.value === "non_operational" && <CancelOutlinedIcon sx={iconSx} />}
                        {option.value === "cancelled" && <CancelOutlinedIcon sx={iconSx} />}
                        {option.value === "finalized" && <CheckCircleRoundedIcon sx={iconSx} />}
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: "0.68rem",
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {option.label} ({option.count})
                        </Typography>
                      </ButtonBase>
                    );
                  })}
                </Box>
              </Paper>
            </Box>
          </Box>

          <Paper sx={{ overflow: "hidden" }}>
            {loading ? (
              <LinearProgress />
            ) : isFlowsView ? (
              <Box
                sx={{
                  height: {
                    xs: "calc(100dvh - 320px)",
                    md: "calc(100dvh - 300px)",
                  },
                  minHeight: { xs: 520, md: 720 },
                  width: "100%",
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Box
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      backgroundColor: "background.paper",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <FlowListToolbar
                      quickFilterPlaceholder="Buscar flow, tarea o proyecto vinculado..."
                      searchOpen={flowSearchOpen}
                      searchValue={flowSearchValue}
                      activeFlowFilterDescription={activeFlowFilterDescription}
                      flowQuickFilter={flowQuickFilter}
                      flowQuickFilterCounts={quickFilterCountsByValue}
                      flowQuickFilterLabel={flowQuickFilter === "none" ? "Filtro rápido" : activeFlowQuickFilterLabel}
                      allowedFlowQuickFilters={allowedFlowQuickFilterValues}
                      quickFilterAnchorEl={flowQuickFilterAnchorEl}
                      onQuickFilterOpen={(event: MouseEvent<HTMLElement>) => {
                        setFlowQuickFilterAnchorEl(event.currentTarget);
                      }}
                      onQuickFilterClose={() => {
                        setFlowQuickFilterAnchorEl(null);
                      }}
                      onFlowQuickFilterChange={(value: FlowQuickFilter) => {
                        setFlowQuickFilter(value);
                      }}
                      onSearchToggle={() => {
                        if (flowSearchOpen && flowSearchValue.trim().length === 0) {
                          setFlowSearchOpen(false);
                          return;
                        }
                        setFlowSearchOpen(true);
                      }}
                      onSearchChange={(value: string) => {
                        setFlowSearchValue(value);
                      }}
                      onSearchClearOrClose={() => {
                        if (flowSearchValue.trim().length > 0) {
                          setFlowSearchValue("");
                          return;
                        }
                        setFlowSearchOpen(false);
                      }}
                    />
                  </Box>

                  <Box sx={{ flex: 1, overflowY: "auto" }}>
                    {visibleFlowRows.length === 0 ? (
                      flowSearchActive ? (
                        <DataGridEmptyState
                          icon={<SearchRoundedIcon color="action" />}
                          title="No hay resultados para esta búsqueda"
                          description="Probá con otros términos para encontrar el flow, la tarea o el proyecto asociado."
                        />
                      ) : (
                        <DataGridEmptyState
                          icon={<InboxRoundedIcon color="action" />}
                          title="No hay flows para este filtro"
                          description="Probá con otro estado o capturá una nueva tarea para iniciar el flujo."
                          action={resetFilterAction}
                        />
                      )
                    ) : shouldGroupFlowRowsByDate ? (
                      <Box sx={{ overflowX: "auto", overflowY: "visible" }}>
                        <Stack spacing={0} sx={{ minWidth: flowGroupedHeaderMinWidth }}>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: flowGroupedHeaderTemplateColumns,
                              columnGap: 0,
                              alignItems: "stretch",
                              minWidth: flowGroupedHeaderMinWidth,
                              borderBottom: "1px solid",
                              borderColor: "divider",
                              color: "text.secondary",
                              backgroundColor: "background.paper",
                            }}
                          >
                            {orderedVisibleFlowColumns.map((column) => {
                              const field = String(column.field);
                              const align = column.headerAlign ?? column.align ?? "left";
                              const isStickyPrimaryColumn = field === FLOW_PRIMARY_COLUMN_FIELD;
                              const isReorderable = isFlowColumnReorderable(field);
                              const isDropTarget = field === flowColumnDropTargetField && draggedFlowColumnField !== field;

                              return (
                                <Box
                                  key={field}
                                  draggable={isReorderable}
                                  onDragStart={(event) => handleFlowColumnDragStart(event, field)}
                                  onDragOver={(event) => handleFlowColumnDragOver(event, field)}
                                  onDrop={(event) => handleFlowColumnDrop(event, field)}
                                  onDragEnd={clearFlowColumnDragState}
                                  sx={{
                                    position: isStickyPrimaryColumn ? "sticky" : "relative",
                                    left: isStickyPrimaryColumn ? 0 : "auto",
                                    zIndex: isStickyPrimaryColumn ? 3 : 1,
                                    px: 1.5,
                                    py: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    justifyContent:
                                      align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
                                    backgroundColor: "background.paper",
                                    borderRight: "1px solid",
                                    borderColor: "divider",
                                    cursor: isReorderable ? "grab" : "default",
                                    opacity: draggedFlowColumnField === field ? 0.58 : 1,
                                  }}
                                >
                                  {isReorderable ? <DragIndicatorRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} /> : null}
                                  <Typography
                                    variant="overline"
                                    sx={(theme) => ({
                                      fontWeight: isDropTarget ? 800 : 700,
                                      letterSpacing: "0.08em",
                                      textAlign: align,
                                      color: isDropTarget ? theme.palette.status.active.accent : "inherit",
                                      borderBottom: isDropTarget ? `2px solid ${theme.palette.status.active.accent}` : "2px solid transparent",
                                    })}
                                  >
                                    {column.headerName ?? field}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>

                          {groupedFlowSections.map((group) => (
                            <Box
                              key={group.key}
                              sx={{
                                borderTop: "1px solid",
                                borderColor: "divider",
                                pt: 0.5,
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={0.75}
                                sx={{
                                  alignItems: "center",
                                  px: 1.5,
                                  py: 0.75,
                                  color: "text.secondary",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    backgroundColor: alpha(theme.palette.text.secondary, 0.5),
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 600,
                                    color: "text.secondary",
                                    letterSpacing: "0.02em",
                                  }}
                                >
                                  {group.label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                  {group.rows.length}
                                </Typography>
                              </Stack>

                              <DataGrid
                                rows={group.rows}
                                columns={interactiveOrderedVisibleFlowColumns}
                                rowHeight={62}
                                sortModel={flowSortModel}
                                onSortModelChange={setFlowSortModel}
                                disableRowSelectionOnClick
                                autoHeight
                                hideFooter
                                columnHeaderHeight={0}
                                onCellClick={(params, event) => {
                                  if (params.field === "requirementsLabel") {
                                    event.defaultMuiPrevented = true;
                                  }
                                }}
                                onRowClick={(params: GridRowParams<FlowGridRow>) => {
                                  handleWorkflowNavigate(params.row.id);
                                }}
                                sx={{
                                  border: 0,
                                  minWidth: flowGroupedHeaderMinWidth,
                                  "& .MuiDataGrid-columnHeaders": { display: "none" },
                                  "& .MuiDataGrid-virtualScroller": { marginTop: "0 !important" },
                                  "& .flow-grid-sticky-column": {
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 4,
                                    backgroundColor: theme.palette.background.paper,
                                    borderRight: `1px solid ${theme.palette.divider}`,
                                  },
                                  "& .flow-grid-sticky-column-cell": {
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 3,
                                    backgroundColor: theme.palette.background.paper,
                                    borderRight: `1px solid ${theme.palette.divider}`,
                                  },
                                  "& .MuiDataGrid-row:hover .flow-grid-sticky-column-cell": {
                                    backgroundColor: theme.palette.action.hover,
                                  },
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ) : (
                      <DataGrid
                        rows={visibleFlowRows}
                        columns={interactiveOrderedVisibleFlowColumns}
                        rowHeight={62}
                        sortModel={flowSortModel}
                        onSortModelChange={setFlowSortModel}
                        disableRowSelectionOnClick
                        autoHeight
                        hideFooter={visibleFlowRows.length <= 10}
                        onCellClick={(params, event) => {
                          if (params.field === "requirementsLabel") {
                            event.defaultMuiPrevented = true;
                          }
                        }}
                        onRowClick={(params: GridRowParams<FlowGridRow>) => {
                          handleWorkflowNavigate(params.row.id);
                        }}
                        sx={{
                          border: 0,
                          "& .flow-grid-sticky-column": {
                            position: "sticky",
                            left: 0,
                            zIndex: 4,
                            backgroundColor: theme.palette.background.paper,
                            borderRight: `1px solid ${theme.palette.divider}`,
                          },
                          "& .flow-grid-sticky-column-cell": {
                            position: "sticky",
                            left: 0,
                            zIndex: 3,
                            backgroundColor: theme.palette.background.paper,
                            borderRight: `1px solid ${theme.palette.divider}`,
                          },
                          "& .MuiDataGrid-row:hover .flow-grid-sticky-column-cell": {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  height: {
                    xs: "calc(100dvh - 320px)",
                    md: "calc(100dvh - 300px)",
                  },
                  minHeight: { xs: 520, md: 680 },
                  width: "100%",
                }}
              >
                <DataGrid
                  rows={requirementRows}
                  columns={requirementColumns}
                  rowHeight={58}
                  filterModel={requirementFilterModel}
                  onFilterModelChange={setRequirementFilterModel}
                  disableRowSelectionOnClick
                  showToolbar
                  onRowClick={(params: GridRowParams<RequirementGridRow>) => {
                    handleProjectNavigate(params.row.id);
                  }}
                  slots={{
                    toolbar: FlowGridToolbar,
                    noRowsOverlay: () => (
                      <DataGridEmptyState
                        icon={<InboxRoundedIcon color="action" />}
                        title="No hay proyectos para este filtro"
                        description="ProbÃ¡ con otro estado o creÃ¡ un nuevo proyecto para empezar."
                        action={resetFilterAction}
                      />
                    ),
                  }}
                  slotProps={{
                    toolbar: {
                      quickFilterPlaceholder: "Buscar proyecto o solicitante...",
                      searchOpen: requirementSearchOpen,
                      searchValue: requirementSearchValue,
                      showGridActions: true,
                      onSearchToggle: () => {
                        if (requirementSearchOpen && requirementSearchValue.trim().length === 0) {
                          setRequirementSearchOpen(false);
                          return;
                        }
                        setRequirementSearchOpen(true);
                      },
                      onSearchChange: (value: string) => {
                        setRequirementSearchValue(value);
                        setRequirementFilterModel((previous) => ({
                          ...previous,
                          quickFilterValues: toQuickFilterValues(value),
                        }));
                      },
                      onSearchClearOrClose: () => {
                        if (requirementSearchValue.trim().length > 0) {
                          setRequirementSearchValue("");
                          setRequirementFilterModel((previous) => ({
                            ...previous,
                            quickFilterValues: [],
                          }));
                          return;
                        }
                        setRequirementSearchOpen(false);
                      },
                    } as any,
                  }}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: "description", sort: "asc" }],
                    },
                    pagination: {
                      paginationModel: { pageSize: 20, page: 0 },
                    },
                  }}
                  pageSizeOptions={[10, 15, 20, 50]}
                  sx={{ border: 0, height: "100%" }}
                />
              </Box>
            )}
          </Paper>

        </Stack>
      </PageContainer>
    </Stack>
  );
}



