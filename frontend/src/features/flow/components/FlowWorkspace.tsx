import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { alpha, type SxProps, type Theme, useTheme } from "@mui/material/styles";
import {
  Box,
  ButtonBase,
  Chip,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRowParams, type GridSortModel } from "@mui/x-data-grid";

import { DataGridEmptyState } from "../../../components/feedback/DataGridEmptyState";
import { useToastContext } from "../../../components/Toast";
import { getStatusSemanticKey } from "../../../theme";
import { updateStep } from "../api";
import { FlowStateFilterControl } from "./FlowStateFilterControl";
import { StatusBadge } from "./StatusBadge";
import {
  buildActiveFlowFilterDescription,
  buildFlowRows,
  countFlowQuickFilters,
  flowQuickFilterOptions,
  getFlowDateGroupSortKey,
  getAllowedFlowQuickFiltersForStateFilter,
  getFlowFilterFromStatus,
  getFlowCounts,
  getFlowSearchableContent,
  getFlowStatusDisplayValue,
  groupFlowRowsByDate,
  matchesFlowQuickFilter,
  matchesFlowStateFilter,
  normalizeVisibleFlowFilter,
  selectableFlowQuickFilterOptions,
  shouldGroupFlowRowsByDate,
  type FlowCountSummary,
  type FlowDateGroupSection,
  type FlowFilter,
  type FlowGridRow,
  type FlowQuickFilter,
  type FlowStatusPresentation,
  type FlowTableItem,
  type FlowRowSource,
} from "../utils/flowTable";
import {
  formatCalendarDate,
  formatElapsedTime,
  formatRelativeCalendarDay,
  getStatusTone,
  getTodayLocalDateInput,
  humanizeStatus,
  isPastCalendarDateInput,
  openNativeDateInputPicker,
  toCalendarDateUtcIso,
} from "../utils";

export type FlowWorkspaceViewMeta = {
  activeFlowFilterDescription: string;
  visibleRowCount: number;
  flowSearchActive: boolean;
};

type FlowWorkspaceProps = {
  items?: FlowRowSource[];
  rows?: FlowGridRow[];
  stateFilter: FlowFilter;
  onStateFilterChange: (value: FlowFilter) => void;
  currentCounts?: FlowCountSummary;
  showProjectColumn?: boolean;
  quickFilterPlaceholder?: string;
  allowedQuickFilters?: FlowQuickFilter[];
  noRowsTitle: string;
  noRowsDescription: string;
  noSearchTitle?: string;
  noSearchDescription?: string;
  emptyStateAction?: ReactNode;
  onRowNavigate: (workflowId: string) => void;
  normalizeStateFilter?: boolean;
  onProjectNavigate?: (requirementId: string, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenLinkProject?: (workflowId: string, workflowName: string) => void;
  onWorkflowStepDatePatched?: (workflowId: string, stepId: string, nextIsoValue: string | null) => void;
  statusPresentation?: FlowStatusPresentation;
  loading?: boolean;
  showStateFilterControl?: boolean;
  stateFilterControlVariant?: "flows" | "projects";
  topActions?: ReactNode;
  paperSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  groupRowsByDate?: boolean;
  flowQuickFilter?: FlowQuickFilter;
  onFlowQuickFilterChange?: (value: FlowQuickFilter) => void;
  flowSearchOpen?: boolean;
  onFlowSearchOpenChange?: (value: boolean) => void;
  flowSearchValue?: string;
  onFlowSearchValueChange?: (value: string) => void;
  flowSortModel?: GridSortModel;
  onFlowSortModelChange?: (value: GridSortModel) => void;
  onViewMetaChange?: (value: FlowWorkspaceViewMeta) => void;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getStatusHighlight(statusValue: string, theme: Theme) {
  const semantic = getStatusSemanticKey(getStatusTone(statusValue));
  return theme.palette.status[semantic];
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

const FLOW_FIXED_COLUMN_ORDER = ["taskName", "lastRecord", "requirementsLabel", "movementAt", "status", "waitingSinceInput", "executionAt", "completedAtInput"];

function orderFlowColumnsFixed(columns: GridColDef<FlowGridRow>[]) {
  const fallbackIndex = FLOW_FIXED_COLUMN_ORDER.length;
  return [...columns].sort((left, right) => {
    const leftIndex = FLOW_FIXED_COLUMN_ORDER.indexOf(String(left.field));
    const rightIndex = FLOW_FIXED_COLUMN_ORDER.indexOf(String(right.field));
    return (leftIndex === -1 ? fallbackIndex : leftIndex) - (rightIndex === -1 ? fallbackIndex : rightIndex);
  });
}

function areSortModelsEqual(left: GridSortModel, right: GridSortModel) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item.field === right[index]?.field && item.sort === right[index]?.sort);
}

const attentionFlowQuickFilters = new Set<FlowQuickFilter>([
  "past",
  "without_project",
  "without_date",
  "waiting_15_plus",
  "waiting_month_plus",
]);

function isOperationalFlowQuickFilter(filter: FlowQuickFilter) {
  return filter === "today" || filter === "this_week" || filter === "waiting_today" || filter === "waiting_days" || filter === "waiting_week";
}

export function renderFlowQuickFilterOptionLabel(
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
          fontWeight: selected ? 500 : 400,
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

export function FlowWorkspace({
  items,
  rows,
  stateFilter,
  onStateFilterChange,
  currentCounts,
  showProjectColumn = true,
  quickFilterPlaceholder = "Buscar flow o tarea...",
  allowedQuickFilters,
  noRowsTitle,
  noRowsDescription,
  noSearchTitle = "No hay resultados para esta búsqueda",
  noSearchDescription = "Probá con otros términos para encontrar el flow o la tarea.",
  emptyStateAction,
  onRowNavigate,
  normalizeStateFilter = true,
  onProjectNavigate,
  onOpenLinkProject,
  onWorkflowStepDatePatched,
  statusPresentation = "detailed",
  loading = false,
  showStateFilterControl = true,
  stateFilterControlVariant = "flows",
  topActions,
  paperSx,
  contentSx,
  groupRowsByDate = true,
  flowQuickFilter,
  onFlowQuickFilterChange,
  flowSearchOpen,
  onFlowSearchOpenChange,
  flowSearchValue,
  onFlowSearchValueChange,
  flowSortModel,
  onFlowSortModelChange,
  onViewMetaChange,
}: FlowWorkspaceProps) {
  const theme = useTheme();
  const { showToast } = useToastContext();
  const [internalFlowQuickFilter, setInternalFlowQuickFilter] = useState<FlowQuickFilter>("none");
  const [flowQuickFilterAnchorEl, setFlowQuickFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [internalFlowSearchOpen, setInternalFlowSearchOpen] = useState(false);
  const [internalFlowSearchValue, setInternalFlowSearchValue] = useState("");
  const [internalFlowSortModel, setInternalFlowSortModel] = useState<GridSortModel>([{ field: "movementAt", sort: "asc" }]);
  const [pendingDates, setPendingDates] = useState<Map<string, string>>(new Map());
  const [requirementsMenu, setRequirementsMenu] = useState<{ rowId: string; anchorEl: HTMLElement } | null>(null);
  const pendingDateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isFlowSortModelControlled = flowSortModel !== undefined;

  const resolvedFlowQuickFilter = flowQuickFilter ?? internalFlowQuickFilter;
  const resolvedFlowSearchOpen = flowSearchOpen ?? internalFlowSearchOpen;
  const resolvedFlowSearchValue = flowSearchValue ?? internalFlowSearchValue;
  const resolvedFlowSortModel = flowSortModel ?? internalFlowSortModel;
  const today = getTodayLocalDateInput();
  const sourceItems = items ?? [];
  const flowRows = useMemo(() => rows ?? buildFlowRows(sourceItems, today), [rows, sourceItems, today]);
  const resolvedCounts = useMemo(() => currentCounts ?? getFlowCounts(sourceItems), [currentCounts, sourceItems]);
  const visibleStateFilter = normalizeStateFilter ? normalizeVisibleFlowFilter(stateFilter) : stateFilter;

  const setResolvedFlowQuickFilter = useCallback(
    (value: FlowQuickFilter) => {
      onFlowQuickFilterChange?.(value);
      if (flowQuickFilter === undefined) {
        setInternalFlowQuickFilter(value);
      }
    },
    [flowQuickFilter, onFlowQuickFilterChange]
  );

  const setResolvedFlowSearchOpen = useCallback(
    (value: boolean) => {
      onFlowSearchOpenChange?.(value);
      if (flowSearchOpen === undefined) {
        setInternalFlowSearchOpen(value);
      }
    },
    [flowSearchOpen, onFlowSearchOpenChange]
  );

  const setResolvedFlowSearchValue = useCallback(
    (value: string) => {
      onFlowSearchValueChange?.(value);
      if (flowSearchValue === undefined) {
        setInternalFlowSearchValue(value);
      }
    },
    [flowSearchValue, onFlowSearchValueChange]
  );

  const setResolvedFlowSortModel = useCallback(
    (value: GridSortModel) => {
      if (areSortModelsEqual(resolvedFlowSortModel, value)) {
        return;
      }
      onFlowSortModelChange?.(value);
      if (!isFlowSortModelControlled) {
        setInternalFlowSortModel(value);
      }
    },
    [isFlowSortModelControlled, onFlowSortModelChange, resolvedFlowSortModel]
  );

  useEffect(() => {
    if (visibleStateFilter !== stateFilter) {
      onStateFilterChange(visibleStateFilter);
    }
  }, [onStateFilterChange, stateFilter, visibleStateFilter]);

  useEffect(() => {
    if (!resolvedFlowSearchOpen) {
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
  }, [resolvedFlowSearchOpen]);

  useEffect(() => {
    if (visibleStateFilter === "waiting") {
      setResolvedFlowSortModel([{ field: "movementAt", sort: "asc" }]);
    }
  }, [setResolvedFlowSortModel, visibleStateFilter]);

  const activeFlowQuickFilterLabel =
    flowQuickFilterOptions.find((option) => option.value === resolvedFlowQuickFilter)?.label ?? "Filtro rápido";
  const activeFlowFilterDescription = buildActiveFlowFilterDescription(visibleStateFilter, resolvedFlowQuickFilter);
  const flowSearchActive = resolvedFlowSearchValue.trim().length > 0;

  const allowedQuickFilterValues = useMemo(
    () => {
      const stateAllowedValues = getAllowedFlowQuickFiltersForStateFilter(visibleStateFilter);
      const configuredValues = allowedQuickFilters ?? selectableFlowQuickFilterOptions.map((option) => option.value);
      return configuredValues.filter((value) => stateAllowedValues.includes(value));
    },
    [allowedQuickFilters, visibleStateFilter]
  );

  useEffect(() => {
    if (resolvedFlowQuickFilter !== "none" && !allowedQuickFilterValues.includes(resolvedFlowQuickFilter)) {
      setResolvedFlowQuickFilter("none");
      setFlowQuickFilterAnchorEl(null);
    }
  }, [allowedQuickFilterValues, resolvedFlowQuickFilter, setResolvedFlowQuickFilter]);

  const stateFilteredFlowRows = useMemo(
    () => flowRows.filter((row) => matchesFlowStateFilter(row.status, visibleStateFilter)),
    [flowRows, visibleStateFilter]
  );

  const quickFilterCountsByValue = useMemo<Record<FlowQuickFilter, number>>(
    () => countFlowQuickFilters(stateFilteredFlowRows, today),
    [stateFilteredFlowRows, today]
  );

  const quickFilteredFlowRows = useMemo(
    () => stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, resolvedFlowQuickFilter, today)),
    [resolvedFlowQuickFilter, stateFilteredFlowRows, today]
  );

  const visibleFlowRows = useMemo(() => {
    const normalizedQuery = normalizeSearchText(resolvedFlowSearchValue.trim());
    if (!normalizedQuery) {
      return quickFilteredFlowRows;
    }

    const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    return quickFilteredFlowRows.filter((row) => {
      const searchableContent = normalizeSearchText(getFlowSearchableContent(row, statusPresentation));
      return searchTerms.every((term) => searchableContent.includes(term));
    });
  }, [quickFilteredFlowRows, resolvedFlowSearchValue, statusPresentation]);

  const shouldGroupVisibleFlowRows = groupRowsByDate && shouldGroupFlowRowsByDate(visibleStateFilter, resolvedFlowQuickFilter);
  const groupedVisibleFlowRows = useMemo<FlowDateGroupSection[]>(
    () => (shouldGroupVisibleFlowRows ? groupFlowRowsByDate(visibleFlowRows, today) : []),
    [shouldGroupVisibleFlowRows, today, visibleFlowRows]
  );

  useEffect(() => {
    onViewMetaChange?.({
      activeFlowFilterDescription,
      visibleRowCount: visibleFlowRows.length,
      flowSearchActive,
    });
  }, [activeFlowFilterDescription, flowSearchActive, onViewMetaChange, visibleFlowRows.length]);

  const setPendingDateInputRef = useCallback((rowId: string, input: HTMLInputElement | null) => {
    const inputRefs = pendingDateInputRefs.current;
    if (input) {
      inputRefs.set(rowId, input);
      return;
    }
    inputRefs.delete(rowId);
  }, []);

  const openPendingDateEditorAndPicker = useCallback((rowId: string, draftValue: string) => {
    setPendingDates((previous) => {
      const next = new Map(previous);
      next.set(rowId, draftValue);
      return next;
    });
    window.setTimeout(() => {
      openNativeDateInputPicker(pendingDateInputRefs.current.get(rowId) ?? null);
    }, 0);
  }, []);

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
      onWorkflowStepDatePatched?.(row.id, row.stepId, isoValue);
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

  const dateColumnVisibility = getFlowDateColumnVisibility(visibleStateFilter);
  const showStatusColumn = shouldShowStatusColumn(visibleStateFilter);

  const flowColumns = useMemo<GridColDef<FlowGridRow>[]>(() => {
    const columns: GridColDef<FlowGridRow>[] = [
      {
        field: "taskName",
        headerName: "Tarea inicial / disparador",
        flex: 1.45,
        minWidth: 300,
        align: "left",
        headerAlign: "left",
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
                  sx={{
                    width: 4,
                    flexShrink: 0,
                    borderRadius: theme.appShape.sm,
                    backgroundColor: statusHighlight.accent,
                    alignSelf: "stretch",
                    minHeight: 34,
                  }}
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
    ];

    const movementColumn = columns.pop();

    if (dateColumnVisibility.waiting) {
      columns.push({
        field: "waitingSinceInput",
        headerName: "En espera desde",
        width: 172,
        minWidth: 160,
        align: "center",
        headerAlign: "center",
        valueGetter: (_, row) => (row.waitingSinceInput ? getFlowDateGroupSortKey(row.waitingSinceInput, today) : Number.MAX_SAFE_INTEGER),
        renderCell: (params) => {
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
      });
    }

    if (dateColumnVisibility.execution) {
      columns.push({
        field: "executionAt",
        headerName: "Fecha de ejecucion",
        width: 172,
        minWidth: 160,
        align: "center",
        headerAlign: "center",
        valueGetter: (_, row) => row.operationalSortValue,
        renderCell: (params) => {
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
                    sx={{
                      borderRadius: theme.appShape.sm,
                      px: 0.5,
                      py: 0.25,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <Stack
                      spacing={0}
                      sx={{
                        alignItems: "center",
                        minWidth: 134,
                        borderRadius: theme.appShape.sm,
                        px: shouldPulseToday ? 0.45 : 0,
                        backgroundColor: shouldPulseToday ? statusHighlight.soft : "transparent",
                        border: shouldPulseToday ? `1px solid ${statusHighlight.border}` : "1px solid transparent",
                        transition: theme.transitions.create(["background-color", "border-color"], {
                          duration: theme.appMotion.short,
                        }),
                      }}
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
              sx={{
                minWidth: 150,
                "& .MuiOutlinedInput-root": {
                  borderRadius: theme.appShape.sm,
                  backgroundColor: theme.palette.surfaceContainerLowest,
                },
                "& input": {
                  fontSize: "0.82rem",
                  padding: "4px 8px",
                },
              }}
            />
          );
        },
      });
    }

    if (dateColumnVisibility.completed) {
      columns.push({
        field: "completedAtInput",
        headerName: "Finalizacion",
        width: 156,
        minWidth: 146,
        align: "center",
        headerAlign: "center",
        valueGetter: (_, row) => (row.completedAtInput ? getFlowDateGroupSortKey(row.completedAtInput, today) : Number.MAX_SAFE_INTEGER),
        renderCell: (params) => {
          const value = params.row.completedAtInput;
          return (
            <Typography variant="body2" color={value ? "text.primary" : "text.secondary"} sx={{ fontSize: "0.82rem", lineHeight: 1.2 }}>
              {value ? formatCalendarDate(value) : "Sin cierre"}
            </Typography>
          );
        },
      });
    }

    if (movementColumn) {
      columns.push(movementColumn);
    }

    if (showStatusColumn) {
      columns.push({
        field: "status",
        headerName: "Estado",
        width: 150,
        minWidth: 140,
        align: "center",
        headerAlign: "center",
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
            <StatusBadge value={getFlowStatusDisplayValue(params.row.status, statusPresentation)} />
          </Box>
        ),
      });
    }

    if (showProjectColumn) {
      columns.push({
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
            if (!onOpenLinkProject) {
              return (
                <Typography variant="body2" color="text.secondary">
                  Sin proyectos
                </Typography>
              );
            }

            return (
              <ButtonBase
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenLinkProject(row.id, row.taskName);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                sx={{
                  color: "text.disabled",
                  fontSize: "0.8rem",
                  px: 0.5,
                  py: 0.25,
                  borderRadius: `${theme.appShape.sm}px`,
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
                onClick={(event: ReactMouseEvent<HTMLElement>) => {
                  if (primaryProjectId && onProjectNavigate) {
                    onProjectNavigate(primaryProjectId, event);
                  }
                }}
                sx={{
                  color: "inherit",
                  textAlign: "left",
                  width: "100%",
                  justifyContent: "flex-start",
                  borderRadius: `${theme.appShape.sm}px`,
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
              onClick={(event: ReactMouseEvent<HTMLElement>) => {
                event.stopPropagation();
                setRequirementsMenu({ rowId: row.id, anchorEl: event.currentTarget as HTMLElement });
              }}
              sx={{
                color: "inherit",
                textAlign: "left",
                width: "100%",
                justifyContent: "flex-start",
                borderRadius: `${theme.appShape.sm}px`,
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
                  sx={{
                    height: 22,
                    flexShrink: 0,
                    borderRadius: theme.appShape.sm,
                    borderColor: theme.palette.outlineVariant,
                    color: theme.palette.text.secondary,
                    backgroundColor: theme.palette.surfaceContainerLowest,
                    pointerEvents: "none",
                  }}
                  aria-label={`${row.linkedRequirements.length} proyectos vinculados`}
                />
              </Stack>
            </ButtonBase>
          );
        },
      });
    }

    return orderFlowColumnsFixed(columns);
  }, [
    dateColumnVisibility.completed,
    dateColumnVisibility.execution,
    dateColumnVisibility.waiting,
    onOpenLinkProject,
    onProjectNavigate,
    openPendingDateEditorAndPicker,
    pendingDates,
    setPendingDateInputRef,
    showProjectColumn,
    showStatusColumn,
    statusPresentation,
    theme,
    today,
  ]);

  const requirementsMenuRow = requirementsMenu
    ? visibleFlowRows.find((row) => row.id === requirementsMenu.rowId) ?? null
    : null;

  const flowGridSx = useMemo(
    () => ({
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
    }),
    [theme]
  );

  const handleFlowGridCellClick = useCallback((params: { field: string }, event: { defaultMuiPrevented?: boolean }) => {
    if (params.field === "requirementsLabel") {
      event.defaultMuiPrevented = true;
    }
  }, []);

  const renderRows = (rows: FlowGridRow[], hideFooter: boolean) => (
    <DataGrid
      rows={rows}
      columns={flowColumns}
      rowHeight={62}
      sortModel={resolvedFlowSortModel}
      onSortModelChange={setResolvedFlowSortModel}
      disableRowSelectionOnClick
      autoHeight
      hideFooter={hideFooter}
      onCellClick={handleFlowGridCellClick}
      onRowClick={(params: GridRowParams<FlowGridRow>) => {
        onRowNavigate(params.row.id);
      }}
      sx={flowGridSx}
    />
  );

  return (
    <Stack spacing={1.5}>
      {(showStateFilterControl || topActions) ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: { xs: "stretch", lg: "flex-start" },
            gap: 1.5,
            width: "100%",
          }}
        >
          {showStateFilterControl ? (
            <Box
              sx={{
                width: { xs: "100%", sm: 320 },
                maxWidth: { xs: "100%", sm: 320 },
                flexShrink: 0,
              }}
            >
              <FlowStateFilterControl value={visibleStateFilter} counts={resolvedCounts} onChange={onStateFilterChange} variant={stateFilterControlVariant} />
            </Box>
          ) : null}

          {topActions ? (
            <Box
              sx={{
                width: { xs: "100%", sm: "auto" },
                maxWidth: "100%",
                ml: { lg: "auto" },
                display: "flex",
                justifyContent: { xs: "stretch", sm: "flex-end" },
                flexShrink: 0,
              }}
            >
              {topActions}
            </Box>
          ) : null}
        </Box>
      ) : null}

      <Paper sx={{ overflow: "hidden", ...paperSx }}>
        {loading ? (
          <LinearProgress />
        ) : (
          <Box
            sx={{
              height: {
                xs: "calc(100dvh - 320px)",
                md: "calc(100dvh - 300px)",
              },
              minHeight: { xs: 520, md: 720 },
              width: "100%",
              ...contentSx,
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
                <Box
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
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: 600,
                    }}
                  >
                    {activeFlowFilterDescription}
                  </Typography>

                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
                      <IconButton
                        aria-label={resolvedFlowSearchOpen ? "Alternar búsqueda" : "Buscar"}
                        size="small"
                        onClick={() => {
                          if (resolvedFlowSearchOpen && resolvedFlowSearchValue.trim().length === 0) {
                            setResolvedFlowSearchOpen(false);
                            return;
                          }
                          setResolvedFlowSearchOpen(true);
                        }}
                      >
                        <SearchRoundedIcon fontSize="small" />
                      </IconButton>
                      {resolvedFlowSearchOpen ? (
                        <>
                          <TextField
                            aria-label="Búsqueda rápida"
                            placeholder={quickFilterPlaceholder}
                            size="small"
                            fullWidth={false}
                            autoFocus
                            inputRef={searchInputRef}
                            value={resolvedFlowSearchValue}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              event.stopPropagation();
                              setResolvedFlowSearchValue(event.target.value);
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Escape" && resolvedFlowSearchValue.trim().length === 0) {
                                setResolvedFlowSearchOpen(false);
                              }
                            }}
                            sx={{ width: { xs: 180, sm: 280 } }}
                          />
                          <IconButton
                            aria-label={resolvedFlowSearchValue.trim().length === 0 ? "Cerrar búsqueda" : "Limpiar búsqueda"}
                            size="small"
                            onClick={() => {
                              if (resolvedFlowSearchValue.trim().length > 0) {
                                setResolvedFlowSearchValue("");
                                return;
                              }
                              setResolvedFlowSearchOpen(false);
                            }}
                          >
                            <CancelOutlinedIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : null}
                    </Stack>

                    <ButtonBase
                      aria-label={resolvedFlowQuickFilter === "none" ? "Filtro rápido" : activeFlowQuickFilterLabel}
                      onClick={(event) => setFlowQuickFilterAnchorEl(event.currentTarget)}
                      sx={{
                        px: 1,
                        py: 0.5,
                        borderRadius: theme.appShape.sm,
                        color: "text.secondary",
                        "&:hover": { backgroundColor: "action.hover" },
                      }}
                    >
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <ScheduleRoundedIcon fontSize="small" />
                        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                          {resolvedFlowQuickFilter === "none" ? "Filtro rápido" : activeFlowQuickFilterLabel}
                        </Typography>
                        <ExpandMoreIcon fontSize="small" />
                      </Stack>
                    </ButtonBase>
                    {resolvedFlowQuickFilter !== "none" ? (
                      <IconButton
                        aria-label="Restablecer filtro rápido"
                        size="small"
                        onClick={() => {
                          setResolvedFlowQuickFilter("none");
                          setFlowQuickFilterAnchorEl(null);
                        }}
                      >
                        <CancelOutlinedIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                </Box>
              </Box>

              <Menu anchorEl={flowQuickFilterAnchorEl} open={Boolean(flowQuickFilterAnchorEl)} onClose={() => setFlowQuickFilterAnchorEl(null)}>
                {selectableFlowQuickFilterOptions
                  .filter((option) => allowedQuickFilterValues.includes(option.value))
                  .map((option) => (
                    <MenuItem
                      key={option.value}
                      selected={option.value === resolvedFlowQuickFilter}
                      onClick={() => {
                        setResolvedFlowQuickFilter(option.value);
                        setFlowQuickFilterAnchorEl(null);
                      }}
                    >
                      {renderFlowQuickFilterOptionLabel(
                        option,
                        quickFilterCountsByValue[option.value] ?? 0,
                        option.value === resolvedFlowQuickFilter
                      )}
                    </MenuItem>
                  ))}
              </Menu>

              <Menu
                anchorEl={requirementsMenu?.anchorEl ?? null}
                open={Boolean(requirementsMenu)}
                onClose={() => setRequirementsMenu(null)}
              >
                {(requirementsMenuRow?.linkedRequirements ?? []).map((requirement) => (
                  <MenuItem
                    key={requirement.id}
                    onClick={(event) => {
                      setRequirementsMenu(null);
                      onProjectNavigate?.(requirement.id, event as unknown as ReactMouseEvent<HTMLElement>);
                    }}
                  >
                    {requirement.label}
                  </MenuItem>
                ))}
              </Menu>

              <Box sx={{ flex: 1, overflowY: "auto" }}>
                {visibleFlowRows.length === 0 ? (
                  flowSearchActive ? (
                    <DataGridEmptyState icon={<SearchRoundedIcon color="action" />} title={noSearchTitle} description={noSearchDescription} />
                  ) : (
                    <DataGridEmptyState
                      icon={<InboxRoundedIcon color="action" />}
                      title={noRowsTitle}
                      description={noRowsDescription}
                      action={emptyStateAction}
                    />
                  )
                ) : shouldGroupVisibleFlowRows ? (
                  <Stack spacing={1.25} sx={{ p: 1.25 }}>
                    {groupedVisibleFlowRows.map((group) => (
                      <Paper key={group.key} variant="outlined" sx={{ overflow: "hidden" }}>
                        <Box
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {group.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {group.rows.length} {group.rows.length === 1 ? "flow" : "flows"}
                            </Typography>
                          </Stack>
                        </Box>
                        {renderRows(group.rows, true)}
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  renderRows(visibleFlowRows, visibleFlowRows.length <= 10)
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
