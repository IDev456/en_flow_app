import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
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
  Collapse,
  LinearProgress,
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
  type GridRowParams,
  Toolbar,
  ToolbarButton,
} from "@mui/x-data-grid";
import { useLocation, useNavigate } from "react-router-dom";

import { DataGridEmptyState } from "../../../components/feedback/DataGridEmptyState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { useToastContext } from "../../../components/Toast";
import { getStatusSemanticKey } from "../../../theme";
import { cancelWorkflow, createTrigger, deleteTrigger, deleteWorkflow, getWorkflow, listTriggers, listWorkflows, reactivateWorkflow, updateStepDate, updateTrigger, updateWorkflow } from "../api";
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
  getReminderDateError,
  getVisibleTriggerStatus,
  getVisibleWorkflowStatus,
  isNoisyAutomaticJournalText,
  matchesActiveAmbito,
  getStatusTone,
  setStoredActiveAmbito,
  getTodayLocalDateInput,
  toCalendarDateInputValue,
  toCalendarDayValue,
  toCalendarDateUtcIso,
  type ActiveAmbitoMode,
} from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "active" | "waiting" | "cancelled" | "finalized";

type TriggerListPageProps = {
  defaultView?: ViewMode;
  lockView?: boolean;
  title?: string;
};

type FlowCardData = {
  workflow: WorkflowDetail;
  displayStatus: string;
  relevantStep: Step | null;
  latestMovementAt: string | null;
  linkedRequirements: TriggerDetail[];
};

type FlowGridRow = {
  id: string;
  stepId: string | null;
  ambito: Ambito;
  status: string;
  taskName: string;
  stepLabel: string;
  executionDateInput: string;
  executionAt: number;
  lastRecord: string;
  movementLabel: string;
  movementAt: number;
  movementDays: number | null;
  isDueToday: boolean;
  requirementsLabel: string;
  requirementsCount: number;
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

const flowFilterOptions: Array<{ value: FlowFilter; label: string }> = [
  { value: "active", label: "Activos" },
  { value: "waiting", label: "Esperando" },
  { value: "cancelled", label: "Cancelados" },
  { value: "finalized", label: "Finalizados" },
  { value: "all", label: "Todos" },
];

function getFilterIcon(filter: FlowFilter) {
  if (filter === "active") return <BoltRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "waiting") return <HourglassTopRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "cancelled") return <CancelOutlinedIcon sx={{ fontSize: 14 }} />;
  if (filter === "finalized") return <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />;
  return <InboxRoundedIcon sx={{ fontSize: 14 }} />;
}

function getAmbitoModeIcon(ambito: ActiveAmbitoMode) {
  if (ambito === "laboral") return <WorkOutlineRoundedIcon sx={{ fontSize: 14 }} />;
  return <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />;
}

function getFlowFilterFromStatus(statusValue: string): Exclude<FlowFilter, "all"> | null {
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

function getDefaultFilterForView(view: ViewMode): FlowFilter {
  return view === "flows" ? "active" : "all";
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
    return "Sin registros todavía";
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

function formatNearestFuture(executionDay: number, todayDay: number): string {
  const diffDays = executionDay - todayDay;
  if (diffDays === 1) return "mañana";
  if (diffDays <= 6) return `en ${diffDays} días`;
  return `el ${formatCalendarDate(formatCalendarDayInput(executionDay))}`;
}

function formatFutureGroupLabel(dateInput: string, todayInput: string) {
  const diffDays = getCalendarDayDiff(dateInput, todayInput) ?? 0;
  const formattedDate = formatCalendarDate(dateInput);
  if (diffDays === 1) return `Mañana · ${formattedDate}`;
  if (diffDays === 2) return `Pasado mañana · ${formattedDate}`;
  return formattedDate;
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
};

function FlowGridToolbar(props: any) {
  const {
    quickFilterPlaceholder,
    searchOpen,
    searchValue,
    onSearchToggle,
    onSearchChange,
    onSearchClearOrClose,
  } = props as FlowGridToolbarProps;
  const resolvedPlaceholder = quickFilterPlaceholder ?? "";
  const resolvedSearchOpen = searchOpen ?? false;
  const resolvedSearchValue = searchValue ?? "";
  const searchIsEmpty = resolvedSearchValue.trim().length === 0;
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <Toolbar aria-label="Toolbar del listado" style={{ gap: "6px", justifyContent: "space-between" }}>
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

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Proyectos" }: TriggerListPageProps) {
  const theme = useTheme();
  const { showToast } = useToastContext();
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [stateFilter, setStateFilter] = useState<FlowFilter>(() => getDefaultFilterForView(defaultView));
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
  const [pendingDates, setPendingDates] = useState<Map<string, string>>(new Map());
  const [futuresOpen, setFuturesOpen] = useState(false);
  const [flowSearchOpen, setFlowSearchOpen] = useState(false);
  const [flowSearchValue, setFlowSearchValue] = useState("");
  const [requirementSearchOpen, setRequirementSearchOpen] = useState(false);
  const [requirementSearchValue, setRequirementSearchValue] = useState("");
  const [flowFilterModel, setFlowFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });
  const [requirementFilterModel, setRequirementFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });
  const [classifyingItemId, setClassifyingItemId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isAmbitoAdminView = defaultView === "requirements" && searchParams.get("admin") === "ambito";

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setViewMode(defaultView);
    setStateFilter(getDefaultFilterForView(defaultView));
  }, [defaultView]);

  useEffect(() => {
    setStoredActiveAmbito(activeAmbito);
  }, [activeAmbito]);

  useEffect(() => {
    const state = location.state as { openCreateRequirement?: boolean; toast?: string } | null;
    if (!state) return;

    if (state.toast) {
      setRequirementToastMessage(state.toast);
      setRequirementToastOpen(true);
    }

    if (state.openCreateRequirement && defaultView === "requirements") {
      setViewMode("requirements");
      setCreateRequirementOpen(true);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [defaultView, location.pathname, location.state, navigate]);

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
    () =>
      allFlowCards.filter((item) => {
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(item.displayStatus) === stateFilter;
      }),
    [allFlowCards, stateFilter]
  );

  const flowCounts = useMemo(() => {
    return Object.values(workflowsById)
      .filter((workflow) => matchesActiveAmbito(workflow.ambito, activeAmbito))
      .map((workflow) => getVisibleWorkflowStatus(workflow))
      .reduce<Record<Exclude<FlowFilter, "all">, number>>(
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
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(trigger.estado_general) === stateFilter;
      }),
    [triggers, stateFilter, activeAmbito]
  );

  const requirementCounts = useMemo(() => {
    return triggers
      .filter((trigger) => matchesActiveAmbito(trigger.ambito, activeAmbito))
      .reduce<Record<Exclude<FlowFilter, "all">, number>>(
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
  const resetFilterAction =
    stateFilter !== "all" ? (
      <Button size="small" variant="outlined" color="inherit" onClick={() => setStateFilter("all")}>
        Ver todos
      </Button>
    ) : undefined;
  const flowRows = useMemo<FlowGridRow[]>(() => {
    return allFlowCards.map((item) => {
      const step = item.relevantStep;
      const executionDateInput = toDateInputValue(step?.fecha_vencimiento);
      const stepLabel =
        step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
          ? "Disparador"
          : "Última tarea";
      const movementAtValue = getDateValue(item.latestMovementAt);
      const movementAt = movementAtValue ?? Number.MAX_SAFE_INTEGER;
      const movementDateInput = movementAtValue === null ? null : formatLocalDateInput(new Date(movementAtValue));
      const movementDayDiff = getCalendarDayDiff(movementDateInput, today);
      const movementDays = movementDayDiff === null ? null : Math.max(0, -movementDayDiff);
        return {
          id: item.workflow.id,
          stepId: step?.id ?? null,
          ambito: item.workflow.ambito,
          status: item.displayStatus,
        taskName: step?.nombre ?? "Sin tarea registrada",
        stepLabel,
        executionDateInput,
        executionAt: executionDateInput ? toDateSortValue(executionDateInput) : Number.MAX_SAFE_INTEGER,
        lastRecord: getLatestMeaningfulWorkflowRecord(item.workflow),
        movementLabel: formatElapsedTime(item.latestMovementAt) ?? "Sin movimiento reciente",
        movementAt,
        movementDays,
        isDueToday: executionDateInput === today,
        requirementsLabel:
          item.linkedRequirements.length === 0
            ? "Sin proyectos"
            : item.linkedRequirements.map((requirement) => requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`).join(" · "),
        requirementsCount: item.linkedRequirements.length,
        canCancel: canCancelWorkflow(item.workflow),
        canReactivate: canReactivateWorkflow(item.workflow),
        canDelete: canDeleteWorkflow(item.workflow),
      };
    });
  }, [allFlowCards, today]);

  const searchedFlowRows = useMemo(() => {
    const normalizedQuery = normalizeSearchText(flowSearchValue.trim());
    if (!normalizedQuery) {
      return flowRows;
    }

    const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    return flowRows.filter((row) => {
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
  }, [flowRows, flowSearchValue]);

  const filteredFlowRows = useMemo(
    () =>
      flowRows.filter((row) => {
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(row.status) === stateFilter;
      }),
    [flowRows, stateFilter]
  );

  const mainRows = useMemo(
    () => filteredFlowRows.filter((row) => !row.executionDateInput || row.executionDateInput <= today),
    [filteredFlowRows, today]
  );
  const futureRows = useMemo(
    () => filteredFlowRows.filter((row) => row.executionDateInput && row.executionDateInput > today),
    [filteredFlowRows, today]
  );

  const nearestFutureMs = useMemo(
    () => (futureRows.length > 0 ? Math.min(...futureRows.map((r) => r.executionAt)) : null),
    [futureRows]
  );
  const futureGroups = useMemo(() => {
    const byDate = new Map<string, FlowGridRow[]>();
    for (const row of futureRows) {
      if (!row.executionDateInput) continue;
      const current = byDate.get(row.executionDateInput) ?? [];
      current.push(row);
      byDate.set(row.executionDateInput, current);
    }

    return Array.from(byDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateInput, rows]) => ({
        dateInput,
        label: formatFutureGroupLabel(dateInput, today),
        rows,
      }));
  }, [futureRows, today]);

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

    const reminderError = getReminderDateError(nextValue, today);
    if (reminderError) {
      showToast(reminderError, "error");
      setPendingDates((previous) => {
        const next = new Map(previous);
        next.set(row.id, originalValue);
        return next;
      });
      return;
    }

    const isoValue = toCalendarDateUtcIso(nextValue);

    try {
      await updateStepDate(row.stepId, { fecha_vencimiento: isoValue });
      setWorkflowsById((previous) => {
        const workflow = previous[row.id];
        if (!workflow) return previous;
        return {
          ...previous,
          [row.id]: {
            ...workflow,
            steps: workflow.steps.map((step) => (step.id === row.stepId ? { ...step, fecha_vencimiento: isoValue } : step)),
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
              ? `${linkedWorkflows.length} flows · ${openCount} abiertos`
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
      setError("No se puede eliminar este proyecto porque tiene flows vinculados. Primero desvinculá los flows que quieras conservar, o cancelá/finalizá y eliminá los flows que ya no correspondan.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar este proyecto?\n\n${detail}\n\nEsta acción no se puede deshacer.\nSolo se eliminará si no tiene flows vinculados.`
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
      `¿Cancelar este flow?\n\n${currentTask}\n\nEl flow saldra de la operacion activa y quedara en modo cancelado.\nNo se eliminaran tareas, comentarios ni proyectos vinculados.\nSi fue un error, luego podras reactivarlo.`
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
      `¿Reactivar este flow?\n\n${currentTask}\n\nEl flow volvera a la operacion activa.\nNo se eliminaran tareas, comentarios ni proyectos vinculados.`
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
      "¿Eliminar este flow?\n\nEsta acción eliminará el flow, sus tareas, comentarios, historial, eventos externos y vínculos con proyectos.\n\nEsta acción no se puede deshacer."
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

  const flowColumns = useMemo<GridColDef<FlowGridRow>[]>(
    () => [
      {
        field: "status",
        headerName: "Estado",
        width: 160,
        minWidth: 160,
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
        headerName: "Ámbito",
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
        valueGetter: (_, row) => `${row.stepLabel} ${row.taskName}`,
        renderCell: (params) => {
          const row = params.row;
          return (
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
              }}
            >
              {row.taskName}
            </Typography>
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
        field: "executionAt",
        headerName: "Fecha",
        width: 172,
        minWidth: 160,
        align: "center",
        headerAlign: "center",
        valueGetter: (_, row) => row.executionAt,
        renderCell: (params) => {
          const row = params.row;
          const originalValue = row.executionDateInput;
          const isEditing = pendingDates.has(row.id);
          const showInput = isEditing;
          const isFutureRow = Boolean(row.executionDateInput && row.executionDateInput > today);

          if (!showInput) {
            if (originalValue) {
              const relativeLabel = !isFutureRow ? formatRelativeCalendarDay(originalValue) : null;
              const dateLabel = relativeLabel ?? formatCalendarDate(originalValue);
              const absoluteDateLabel = formatCalendarDate(originalValue);
              const secondaryLabel = relativeLabel ? absoluteDateLabel : null;
              const shouldPulseToday = row.isDueToday && !isEditing;
              const statusHighlight = getStatusHighlight(row.status, theme);
              return (
                <Tooltip title={absoluteDateLabel}>
                    <ButtonBase
                    disabled={!row.stepId}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDates((previous) => {
                        const next = new Map(previous);
                        next.set(row.id, originalValue);
                        return next;
                      });
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
                      {secondaryLabel ? (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                          {secondaryLabel}
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
                disabled={!row.stepId}
                onClick={(event) => {
                  event.stopPropagation();
                  setPendingDates((previous) => {
                    const next = new Map(previous);
                    next.set(row.id, "");
                    return next;
                  });
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
              sx={{ minWidth: 150, "& input": { fontSize: "0.82rem", padding: "4px 8px" } }}
            />
          );
        },
      },
      {
        field: "movementAt",
        headerName: "Movimiento",
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
      {
        field: "requirementsLabel",
        headerName: "Proyecto",
        flex: 1.2,
        minWidth: 260,
        align: "left",
        headerAlign: "left",
        sortable: false,
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
    ],
    [pendingDates, theme.palette.mode, today]
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
        headerName: "Ámbito",
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
                navigate(`/requirements/${row.id}`);
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
    [deletingTriggerId, navigate, triggers]
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
          <ToolbarButton aria-label={searchOpen ? "Alternar búsqueda" : "Buscar"} onClick={onSearchToggle}>
            <SearchRoundedIcon fontSize="small" />
          </ToolbarButton>
          {searchOpen ? (
            <>
              <TextField
                aria-label="Búsqueda rápida"
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
                aria-label={searchIsEmpty ? "Cerrar búsqueda" : "Limpiar búsqueda"}
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
              {`Hay ${unclassifiedTriggers.length + unclassifiedWorkflowCards.length} elemento(s) sin ámbito definido fuera del modo ${getAmbitoLabel(activeAmbito)}.`}
            </Alert>
          )}

          {isAmbitoAdminView && (
            <Paper sx={{ p: { xs: 1.5, md: 1.8 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Clasificar elementos sin ámbito</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    Estos registros legacy no aparecen en la operación principal hasta asignarles Laboral o Personal.
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
                            <Typography variant="body1">{trigger.descripcion?.trim() || "Proyecto sin descripción"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {trigger.solicitante?.trim() || "Sin solicitante"} · {trigger.workflow_ids.length} flow(s) vinculado(s)
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
                              <Typography variant="body1">{workflow.objetivo_final?.trim() || "Flow sin título"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {linkedRequirements.length > 0
                                  ? `Clasificar desde el proyecto asociado: ${linkedRequirements
                                      .map((item) => item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`)
                                      .join(" · ")}`
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
                  Se creará como: {getAmbitoLabel(activeAmbito)}
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
            <Box sx={{ width: "100%", maxWidth: 560 }}>
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Tabs
                  value={stateFilter}
                  onChange={(_, value: FlowFilter) => setStateFilter(value)}
                  variant="fullWidth"
                  aria-label="Filtros de estado"
                  sx={{
                    minHeight: 64,
                    "& .MuiTabs-indicator": {
                      height: 3,
                    },
                  }}
                >
                  {flowFilterOptions.map((option) => {
                    const count = option.value !== "all" ? (currentCounts[option.value] ?? 0) : null;
                    const filterToken =
                      option.value === "active"
                        ? theme.palette.status.active
                        : option.value === "waiting"
                          ? theme.palette.status.waiting
                          : option.value === "cancelled"
                            ? theme.palette.status.cancelled
                            : option.value === "finalized"
                              ? theme.palette.status.finalized
                              : theme.palette.status.neutral;

                    return (
                      <Tab
                        key={option.value}
                        value={option.value}
                        icon={getFilterIcon(option.value)}
                        iconPosition="top"
                        label={count !== null ? `${option.label} (${count})` : option.label}
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
                            color: filterToken.onContainer,
                            backgroundColor: filterToken.container,
                          },
                          "&.Mui-selected .MuiSvgIcon-root": {
                            color: filterToken.accent,
                          },
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Paper>
            </Box>

            <Box
              sx={{
                width: { xs: "100%", sm: 260 },
                maxWidth: { xs: "100%", sm: 260 },
                ml: { lg: "auto" },
                flexShrink: 0,
              }}
            >
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Tabs
                  value={activeAmbito}
                  onChange={(_, value: ActiveAmbitoMode | null) => handleChangeActiveAmbito(value)}
                  variant="fullWidth"
                  aria-label="Modo de ámbito"
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
          </Box>

          {isFlowsView && !loading && !flowSearchActive && futureRows.length > 0 && (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Button
                variant="text"
                color="inherit"
                onClick={() => setFuturesOpen((value) => !value)}
                sx={{ color: "text.secondary", py: 1.25, px: 2, width: "100%", justifyContent: "flex-start", gap: 1 }}
                startIcon={<ScheduleRoundedIcon fontSize="small" />}
                endIcon={
                  <ExpandMoreIcon
                    sx={{ ml: "auto", transform: futuresOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                  />
                }
              >
                {`Programados para más adelante (${futureRows.length})${nearestFutureMs ? ` · próximo ${formatNearestFuture(nearestFutureMs, todaySortValue)}` : ""}`}
              </Button>
              <Collapse in={futuresOpen}>
                <Stack spacing={0} sx={{ px: 1.25, pb: 1.25 }}>
                  {futureGroups.map((group) => (
                    <Box key={group.dateInput} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        {`${group.label} (${group.rows.length})`}
                      </Typography>
                      <DataGrid
                        rows={group.rows}
                        columns={flowColumns}
                        rowHeight={62}
                        filterModel={flowFilterModel}
                        onFilterModelChange={setFlowFilterModel}
                        disableRowSelectionOnClick
                        onRowClick={(params: GridRowParams<FlowGridRow>) => {
                          navigate(`/workflows/${params.row.id}`);
                        }}
                        autoHeight
                        hideFooter={group.rows.length <= 10}
                        initialState={{
                          sorting: {
                            sortModel: [{ field: "movementAt", sort: "asc" }],
                          },
                          pagination: {
                            paginationModel: { pageSize: 20, page: 0 },
                          },
                        }}
                        pageSizeOptions={[10, 15, 20, 50]}
                        sx={{ border: 0 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Paper>
          )}

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
                <DataGrid
                  rows={flowSearchActive ? searchedFlowRows : mainRows}
                  columns={flowColumns}
                  rowHeight={62}
                  filterModel={flowFilterModel}
                  onFilterModelChange={setFlowFilterModel}
                  disableRowSelectionOnClick
                  showToolbar
                  onRowClick={(params: GridRowParams<FlowGridRow>) => {
                    navigate(`/workflows/${params.row.id}`);
                  }}
                  slots={{
                    toolbar: FlowGridToolbar,
                    noRowsOverlay: () =>
                      flowSearchActive ? (
                        <DataGridEmptyState
                          icon={<SearchRoundedIcon color="action" />}
                          title="No hay resultados para esta búsqueda"
                          description="Probá con otros términos para encontrar el flow, la tarea o el proyecto asociado."
                        />
                      ) : filteredFlowRows.length === 0 ? (
                        <DataGridEmptyState
                          icon={<InboxRoundedIcon color="action" />}
                          title="No hay flows para este filtro"
                          description="Probá con otro estado o capturá una nueva tarea para iniciar el flujo."
                          action={resetFilterAction}
                        />
                      ) : (
                        <DataGridEmptyState
                          icon={<ScheduleRoundedIcon color="action" />}
                          title="Sin flows pendientes en esta tabla"
                          description="Todos los flows de este filtro están programados para más adelante. Revisalos en la sección superior."
                        />
                      ),
                  }}
                  slotProps={{
                    toolbar: {
                      quickFilterPlaceholder: "Buscar flow, tarea o proyecto vinculado...",
                      searchOpen: flowSearchOpen,
                      searchValue: flowSearchValue,
                      onSearchToggle: () => {
                        if (flowSearchOpen && flowSearchValue.trim().length === 0) {
                          setFlowSearchOpen(false);
                          return;
                        }
                        setFlowSearchOpen(true);
                      },
                      onSearchChange: (value: string) => {
                        setFlowSearchValue(value);
                      },
                      onSearchClearOrClose: () => {
                        if (flowSearchValue.trim().length > 0) {
                          setFlowSearchValue("");
                          return;
                        }
                        setFlowSearchOpen(false);
                      },
                    } as any,
                  }}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: "movementAt", sort: "asc" }],
                    },
                    pagination: {
                      paginationModel: { pageSize: 20, page: 0 },
                    },
                  }}
                  pageSizeOptions={[10, 15, 20, 50]}
                  sx={{ border: 0, height: "100%" }}
                />
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
                    navigate(`/requirements/${params.row.id}`);
                  }}
                  slots={{
                    toolbar: FlowGridToolbar,
                    noRowsOverlay: () => (
                      <DataGridEmptyState
                        icon={<InboxRoundedIcon color="action" />}
                        title="No hay proyectos para este filtro"
                        description="Probá con otro estado o creá un nuevo proyecto para empezar."
                        action={resetFilterAction}
                      />
                    ),
                  }}
                  slotProps={{
                    toolbar: {
                      quickFilterPlaceholder: "Buscar proyecto o solicitante...",
                      searchOpen: requirementSearchOpen,
                      searchValue: requirementSearchValue,
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
