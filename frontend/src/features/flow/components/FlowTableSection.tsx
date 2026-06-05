import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent as ReactMouseEvent } from "react";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { alpha, type Theme, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRowParams, type GridSortModel } from "@mui/x-data-grid";

import { DataGridEmptyState } from "../../../components/feedback/DataGridEmptyState";
import { useToastContext } from "../../../components/Toast";
import { getStatusSemanticKey } from "../../../theme";
import { updateStepDate } from "../api";
import { StatusBadge } from "./StatusBadge";
import {
  buildActiveFlowFilterDescription,
  buildFlowRows,
  flowQuickFilterOptions,
  getFlowDateGroupSortKey,
  getFlowFilterFromStatus,
  getFlowCounts,
  getFlowSearchableContent,
  groupFlowRowsByDate,
  isDateGroupedQuickFilter,
  matchesFlowQuickFilter,
  matchesFlowStateFilter,
  selectableFlowQuickFilterOptions,
  type FlowCountSummary,
  type FlowFilter,
  type FlowGridRow,
  type FlowQuickFilter,
  type FlowTableItem,
} from "../utils/flowTable";
import {
  formatCalendarDate,
  formatElapsedTime,
  formatRelativeCalendarDay,
  getReminderDateError,
  getStatusTone,
  getTodayLocalDateInput,
  humanizeStatus,
  openNativeDateInputPicker,
  toCalendarDateUtcIso,
} from "../utils";

type FlowTableSectionProps = {
  items: FlowTableItem[];
  stateFilter: FlowFilter;
  onStateFilterChange: (value: FlowFilter) => void;
  currentCounts?: FlowCountSummary;
  showStateTabs?: boolean;
  stateTabsVariant?: "full" | "summary";
  showProjectColumn?: boolean;
  quickFilterPlaceholder?: string;
  allowedQuickFilters?: FlowQuickFilter[];
  noRowsTitle: string;
  noRowsDescription: string;
  noSearchTitle?: string;
  noSearchDescription?: string;
  emptyStateAction?: React.ReactNode;
  onRowNavigate: (workflowId: string) => void;
  onProjectNavigate?: (requirementId: string, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenLinkProject?: (workflowId: string, workflowName: string) => void;
  onWorkflowStepDatePatched?: (workflowId: string, stepId: string, nextIsoValue: string | null) => void;
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

function getSemanticTabSx(accent: string, soft: string) {
  return {
    minHeight: 46,
    borderRadius: 1.15,
    border: "1px solid",
    borderColor: alpha(accent, 0.18),
    textTransform: "none",
    fontWeight: 700,
    color: alpha(accent, 0.88),
    backgroundColor: alpha(accent, 0.04),
    transition: "background-color 180ms ease, color 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      backgroundColor: alpha(accent, 0.1),
      borderColor: alpha(accent, 0.3),
    },
    "&.Mui-selected": {
      color: accent,
      backgroundColor: soft,
      borderColor: alpha(accent, 0.42),
      boxShadow: `inset 0 -2px 0 ${accent}, 0 0 0 1px ${alpha(accent, 0.08)}`,
    },
  } as const;
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

export function FlowTableSection({
  items,
  stateFilter,
  onStateFilterChange,
  currentCounts,
  showStateTabs = false,
  stateTabsVariant = "full",
  showProjectColumn = true,
  quickFilterPlaceholder = "Buscar flow o tarea...",
  allowedQuickFilters,
  noRowsTitle,
  noRowsDescription,
  noSearchTitle = "No hay resultados para esta búsqueda",
  noSearchDescription = "Probá con otros términos para encontrar el flow o la tarea.",
  emptyStateAction,
  onRowNavigate,
  onProjectNavigate,
  onOpenLinkProject,
  onWorkflowStepDatePatched,
}: FlowTableSectionProps) {
  const theme = useTheme();
  const { showToast } = useToastContext();
  const [flowQuickFilter, setFlowQuickFilter] = useState<FlowQuickFilter>("none");
  const [flowQuickFilterAnchorEl, setFlowQuickFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [flowSearchOpen, setFlowSearchOpen] = useState(false);
  const [flowSearchValue, setFlowSearchValue] = useState("");
  const [flowSortModel, setFlowSortModel] = useState<GridSortModel>([{ field: "movementAt", sort: "asc" }]);
  const [pendingDates, setPendingDates] = useState<Map<string, string>>(new Map());
  const [requirementsMenu, setRequirementsMenu] = useState<{ rowId: string; anchorEl: HTMLElement } | null>(null);
  const pendingDateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const today = getTodayLocalDateInput();
  const flowRows = useMemo(() => buildFlowRows(items, today), [items, today]);
  const resolvedCounts = useMemo(() => currentCounts ?? getFlowCounts(items), [currentCounts, items]);

  useEffect(() => {
    if (!flowSearchOpen) {
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
  }, [flowSearchOpen]);

  useEffect(() => {
    setFlowSortModel(isDateGroupedQuickFilter(flowQuickFilter) ? [{ field: "executionAt", sort: "asc" }] : [{ field: "movementAt", sort: "asc" }]);
  }, [flowQuickFilter]);

  const activeFlowQuickFilterLabel =
    flowQuickFilterOptions.find((option) => option.value === flowQuickFilter)?.label ?? "Filtro rápido";
  const activeFlowFilterDescription = buildActiveFlowFilterDescription(stateFilter, flowQuickFilter);
  const flowSearchActive = flowSearchValue.trim().length > 0;

  const allowedQuickFilterValues = useMemo(
    () =>
      allowedQuickFilters ?? selectableFlowQuickFilterOptions.map((option) => option.value),
    [allowedQuickFilters]
  );

  useEffect(() => {
    if (flowQuickFilter !== "none" && !allowedQuickFilterValues.includes(flowQuickFilter)) {
      setFlowQuickFilter("none");
      setFlowQuickFilterAnchorEl(null);
    }
  }, [allowedQuickFilterValues, flowQuickFilter]);

  const stateFilteredFlowRows = useMemo(
    () => flowRows.filter((row) => matchesFlowStateFilter(row.status, stateFilter)),
    [flowRows, stateFilter]
  );

  const quickFilterCountsByValue = useMemo<Record<FlowQuickFilter, number>>(
    () => ({
      none: stateFilteredFlowRows.length,
      today: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "today", today)).length,
      this_week: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "this_week", today)).length,
      past: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "past", today)).length,
      future: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "future", today)).length,
      without_project: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "without_project", today)).length,
      without_reminder: stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, "without_reminder", today)).length,
    }),
    [stateFilteredFlowRows, today]
  );

  const quickFilteredFlowRows = useMemo(
    () => stateFilteredFlowRows.filter((row) => matchesFlowQuickFilter(row, flowQuickFilter, today)),
    [flowQuickFilter, stateFilteredFlowRows, today]
  );

  const visibleFlowRows = useMemo(() => {
    const normalizedQuery = normalizeSearchText(flowSearchValue.trim());
    if (!normalizedQuery) {
      return quickFilteredFlowRows;
    }

    const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    return quickFilteredFlowRows.filter((row) => {
      const searchableContent = normalizeSearchText(getFlowSearchableContent(row));
      return searchTerms.every((term) => searchableContent.includes(term));
    });
  }, [flowSearchValue, quickFilteredFlowRows]);

  const shouldGroupFlowRowsByDate = isDateGroupedQuickFilter(flowQuickFilter);
  const groupedFlowSections = useMemo(
    () => (shouldGroupFlowRowsByDate ? groupFlowRowsByDate(visibleFlowRows, today) : []),
    [shouldGroupFlowRowsByDate, today, visibleFlowRows]
  );

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

  const dateColumnVisibility = getFlowDateColumnVisibility(stateFilter);
  const showStatusColumn = shouldShowStatusColumn(stateFilter);

  const flowColumns = useMemo<GridColDef<FlowGridRow>[]>(() => {
    const columns: GridColDef<FlowGridRow>[] = [
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
            <StatusBadge value={params.row.status} />
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
    theme,
    today,
  ]);

  const visibleFlowColumns = flowColumns;
  const flowGroupedHeaderTemplateColumns = visibleFlowColumns
    .map((column) => {
      if (column.field === "taskName") return "minmax(300px, 1.45fr)";
      if (column.field === "lastRecord") return "minmax(300px, 1.35fr)";
      if (column.field === "requirementsLabel") return "minmax(260px, 1.2fr)";
      if (column.field === "status") return "150px";
      return `${column.width ?? column.minWidth ?? 140}px`;
    })
    .join(" ");

  const requirementsMenuRow = requirementsMenu
    ? visibleFlowRows.find((row) => row.id === requirementsMenu.rowId) ??
      groupedFlowSections.flatMap((group) => group.rows).find((row) => row.id === requirementsMenu.rowId) ??
      null
    : null;
  const operationalHighlight = getStatusHighlight("activo", theme);
  const nonOperationalHighlight = getStatusHighlight("cancelado", theme);
  const neutralHighlight = theme.palette.status.neutral;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showStateTabs ? (
        <Box sx={{ px: 1.5, pt: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs
            value={stateFilter}
            onChange={(_, value: FlowFilter) => onStateFilterChange(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={
              stateTabsVariant === "summary"
                ? {
                    minHeight: 52,
                    gap: 0.75,
                    px: 0.4,
                    py: 0.45,
                    borderRadius: 1.4,
                    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.34 : 0.74),
                    "& .MuiTabs-indicator": { display: "none" },
                    "& .MuiTab-root": { minHeight: 46, px: 1.8, mr: 0 },
                  }
                : undefined
            }
          >
            {stateTabsVariant === "summary" ? (
              [
                <Tab
                  key="summary_operational"
                  value="operational"
                  label={`Operativos (${resolvedCounts.active + resolvedCounts.waiting})`}
                  sx={getSemanticTabSx(operationalHighlight.accent, operationalHighlight.soft)}
                />,
                <Tab
                  key="summary_non_operational"
                  value="non_operational"
                  label={`No operativos (${resolvedCounts.cancelled + resolvedCounts.finalized})`}
                  sx={getSemanticTabSx(nonOperationalHighlight.accent, nonOperationalHighlight.soft)}
                />,
                <Tab
                  key="summary_all"
                  value="all"
                  label={`Todos (${resolvedCounts.active + resolvedCounts.waiting + resolvedCounts.cancelled + resolvedCounts.finalized})`}
                  sx={getSemanticTabSx(neutralHighlight.accent, neutralHighlight.soft)}
                />,
              ]
            ) : (
              [
                <Tab key="tab_active" value="active" label={`Activos (${resolvedCounts.active})`} />,
                <Tab key="tab_waiting" value="waiting" label={`Esperando (${resolvedCounts.waiting})`} />,
                <Tab key="tab_cancelled" value="cancelled" label={`Cancelados (${resolvedCounts.cancelled})`} />,
                <Tab key="tab_finalized" value="finalized" label={`Finalizados (${resolvedCounts.finalized})`} />,
                <Tab
                  key="tab_all"
                  value="all"
                  label={`Todos (${resolvedCounts.active + resolvedCounts.waiting + resolvedCounts.cancelled + resolvedCounts.finalized})`}
                />,
              ]
            )}
          </Tabs>
        </Box>
      ) : null}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.75,
          px: 1,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
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
            <IconButton aria-label={flowSearchOpen ? "Alternar búsqueda" : "Buscar"} size="small" onClick={() => {
              if (flowSearchOpen && flowSearchValue.trim().length === 0) {
                setFlowSearchOpen(false);
                return;
              }
              setFlowSearchOpen(true);
            }}>
              <SearchRoundedIcon fontSize="small" />
            </IconButton>
            {flowSearchOpen ? (
              <>
                <TextField
                  aria-label="Búsqueda rápida"
                  placeholder={quickFilterPlaceholder}
                  size="small"
                  fullWidth={false}
                  autoFocus
                  inputRef={searchInputRef}
                  value={flowSearchValue}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    setFlowSearchValue(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape" && flowSearchValue.trim().length === 0) {
                      setFlowSearchOpen(false);
                    }
                  }}
                  sx={{ width: { xs: 180, sm: 280 } }}
                />
                <IconButton
                  aria-label={flowSearchValue.trim().length === 0 ? "Cerrar búsqueda" : "Limpiar búsqueda"}
                  size="small"
                  onClick={() => {
                    if (flowSearchValue.trim().length > 0) {
                      setFlowSearchValue("");
                      return;
                    }
                    setFlowSearchOpen(false);
                  }}
                >
                  <CancelOutlinedIcon fontSize="small" />
                </IconButton>
              </>
            ) : null}
          </Stack>

          <ButtonBase
            aria-label={flowQuickFilter === "none" ? "Filtro rápido" : activeFlowQuickFilterLabel}
            onClick={(event) => setFlowQuickFilterAnchorEl(event.currentTarget)}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              color: "text.secondary",
              "&:hover": { backgroundColor: "action.hover" },
            }}
          >
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <ScheduleRoundedIcon fontSize="small" />
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {flowQuickFilter === "none" ? "Filtro rápido" : activeFlowQuickFilterLabel}
              </Typography>
              <ExpandMoreIcon fontSize="small" />
            </Stack>
          </ButtonBase>
          {flowQuickFilter !== "none" ? (
            <IconButton
              aria-label="Restablecer filtro rápido"
              size="small"
              onClick={() => {
                setFlowQuickFilter("none");
                setFlowQuickFilterAnchorEl(null);
              }}
            >
              <CancelOutlinedIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
      </Box>

      <Menu anchorEl={flowQuickFilterAnchorEl} open={Boolean(flowQuickFilterAnchorEl)} onClose={() => setFlowQuickFilterAnchorEl(null)}>
        {selectableFlowQuickFilterOptions
          .filter((option) => allowedQuickFilterValues.includes(option.value))
          .map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === flowQuickFilter}
              onClick={() => {
                setFlowQuickFilter(option.value);
                setFlowQuickFilterAnchorEl(null);
              }}
            >
              {`${option.label} (${quickFilterCountsByValue[option.value] ?? 0})`}
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
            <DataGridEmptyState
              icon={<SearchRoundedIcon color="action" />}
              title={noSearchTitle}
              description={noSearchDescription}
            />
          ) : (
            <DataGridEmptyState
              icon={<InboxRoundedIcon color="action" />}
              title={noRowsTitle}
              description={noRowsDescription}
              action={emptyStateAction}
            />
          )
        ) : shouldGroupFlowRowsByDate ? (
          <Stack spacing={0}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: flowGroupedHeaderTemplateColumns,
                columnGap: 0,
                alignItems: "center",
                px: 1.5,
                py: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
                color: "text.secondary",
                backgroundColor: "background.paper",
              }}
            >
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em" }}>
                Tarea inicial / disparador
              </Typography>
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em", pl: 1 }}>
                Registro
              </Typography>
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em", textAlign: "center" }}>
                Fecha
              </Typography>
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em", textAlign: "center" }}>
                Inactividad
              </Typography>
              {showProjectColumn ? (
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em", pl: 1 }}>
                  Proyecto
                </Typography>
              ) : null}
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
                  columns={visibleFlowColumns}
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
                    onRowNavigate(params.row.id);
                  }}
                  sx={{
                    border: 0,
                    "& .MuiDataGrid-columnHeaders": { display: "none" },
                    "& .MuiDataGrid-virtualScroller": { marginTop: "0 !important" },
                  }}
                />
              </Box>
            ))}
          </Stack>
        ) : (
          <DataGrid
            rows={visibleFlowRows}
            columns={visibleFlowColumns}
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
              onRowNavigate(params.row.id);
            }}
            sx={{ border: 0 }}
          />
        )}
      </Box>
    </Box>
  );
}
