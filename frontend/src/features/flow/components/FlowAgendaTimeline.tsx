import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, ButtonBase, Chip, Stack, Tooltip, Typography } from "@mui/material";

import { getStatusToken } from "../../../theme";
import { StatusBadge } from "./StatusBadge";
import type { FlowAgendaColumn, FlowAgendaItem, FlowAgendaModel } from "../utils/flowAgenda";
import { formatCalendarDayInput, formatRelativeCalendarDay, getStatusTone, toCalendarDayValue } from "../utils";

type FlowAgendaTimelineProps = {
  model: FlowAgendaModel;
  onWorkflowOpen: (workflowId: string) => void;
  onExecutionDateChange: (
    workflowId: string,
    stepId: string,
    nextDateInput: string,
    previousDateInput: string
  ) => Promise<void>;
};

const LEFT_COLUMN_WIDTH = 360;
const DAY_COLUMN_WIDTH = 68;
const GROUP_ROW_HEIGHT = 42;
const FLOW_ROW_HEIGHT = 50;
const TIMELINE_MAX_HEIGHT = "calc(100vh - 250px)";
const FLOW_INFO_GRID_TEMPLATE = "minmax(0, 1fr) 108px";
const UNSCHEDULED_GROUP_INDENT = 18;
const UNSCHEDULED_ITEM_INDENT = 34;

function formatAgendaColumnLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  const day = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);

  return {
    weekday: weekday.replace(".", ""),
    day,
  };
}

function getTodayGuideLeft(model: FlowAgendaModel) {
  if (!model.isTodayVisible || model.todayColumnIndex === null) {
    return null;
  }

  return model.todayColumnIndex * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2;
}

type DragState = {
  itemId: string;
  workflowId: string;
  stepId: string;
  pointerId: number;
  startClientX: number;
  originalDateInput: string;
  originalDay: number;
  previewDay: number;
};

function TimelineBackground({ columns, height }: { columns: FlowAgendaColumn[]; height: number }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: "relative",
        inset: 0,
        height,
        display: "grid",
        gridTemplateColumns: `repeat(${columns.length}, ${DAY_COLUMN_WIDTH}px)`,
        overflow: "hidden",
      }}
    >
      {columns.map((column) => (
        <Box
          key={column.dateInput}
          sx={{
            borderRight: column.day === columns[columns.length - 1]?.day ? "none" : "1px solid",
            borderColor: "divider",
            bgcolor: column.isToday
              ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.08)
              : column.isWeekend
                ? alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.035)
                : "transparent",
          }}
        />
      ))}
    </Box>
  );
}

function TodayGuide({ model, zIndex = 1 }: { model: FlowAgendaModel; zIndex?: number }) {
  const theme = useTheme();
  const todayGuideLeft = getTodayGuideLeft(model);

  if (todayGuideLeft === null) {
    return null;
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: todayGuideLeft,
        width: 2,
        transform: "translateX(-50%)",
        bgcolor: alpha(theme.palette.primary.main, 0.65),
        boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.12)}`,
        pointerEvents: "none",
        zIndex,
      }}
    />
  );
}

function AgendaTrack({
  item,
  model,
  dragState,
  setDragState,
  onDragFinish,
}: {
  item: FlowAgendaItem;
  model: FlowAgendaModel;
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  onDragFinish: (dragState: DragState, commit: boolean) => Promise<void>;
}) {
  const theme = useTheme();
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;
  const statusToken = getStatusToken(theme, getStatusTone(item.row.status));
  const activeDrag = dragState?.itemId === item.id ? dragState : null;
  const effectiveStartDay = activeDrag?.previewDay ?? item.startDay;
  const effectiveStartDateInput = effectiveStartDay === null ? item.startDateInput : formatCalendarDayInput(effectiveStartDay);
  const startOffset = effectiveStartDay === null ? 0 : effectiveStartDay - model.visibleStartDay;
  const barLeft = startOffset * DAY_COLUMN_WIDTH + 5;
  const barWidth = Math.max(DAY_COLUMN_WIDTH - 10, item.spanDays * DAY_COLUMN_WIDTH - 10);
  const relativeLabel = formatRelativeCalendarDay(effectiveStartDateInput);
  const relativeLabelLeft = barLeft + barWidth + 8;
  const isDraggable = Boolean(item.row.stepId && item.startDateInput);

  return (
    <Box
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />
      <TodayGuide model={model} zIndex={1} />

      <Box
        role="button"
        aria-label={`Mover fecha del flow ${item.row.taskName}`}
        onPointerDown={(event) => {
          if (!isDraggable || !item.row.stepId || !item.startDateInput) {
            return;
          }
          const originalDay = toCalendarDayValue(item.startDateInput);
          if (originalDay === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const nextDragState: DragState = {
            itemId: item.id,
            workflowId: item.row.id,
            stepId: item.row.stepId,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            originalDateInput: item.startDateInput,
            originalDay,
            previewDay: originalDay,
          };
          setDragState(nextDragState);
        }}
        sx={{
          position: "absolute",
          left: barLeft,
          top: 9,
          width: barWidth,
          height: 30,
          borderRadius: `${theme.appShape.md}px`,
          border: "1px solid",
          borderColor: item.isOverdue ? statusToken.accent : statusToken.border,
          bgcolor:
            activeDrag
              ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.18)
              : item.isOverdue
                ? alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.28 : 0.18)
                : statusToken.container,
          color: item.isOverdue ? theme.palette.warning.dark : statusToken.onContainer,
          boxShadow: item.isOverdue ? `inset 0 0 0 1px ${alpha(theme.palette.warning.main, 0.14)}` : "none",
          cursor: isDraggable ? (activeDrag ? "grabbing" : "grab") : "default",
          touchAction: "none",
          userSelect: "none",
          "&:hover": {
            bgcolor: activeDrag
              ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.32 : 0.22)
              : item.isOverdue
              ? alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.34 : 0.24)
              : alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.12),
          },
        }}
        onPointerMove={(event) => {
          if (!isDraggable || !item.row.stepId || !item.startDateInput) {
            return;
          }
          const currentDrag = dragState?.itemId === item.id ? dragState : null;
          if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const deltaDays = Math.round((event.clientX - currentDrag.startClientX) / DAY_COLUMN_WIDTH);
          const nextPreviewDay = Math.min(
            model.visibleEndDay,
            Math.max(model.visibleStartDay, currentDrag.originalDay + deltaDays)
          );
          if (nextPreviewDay === currentDrag.previewDay) {
            return;
          }
          setDragState((previous) =>
            previous && previous.itemId === item.id ? { ...previous, previewDay: nextPreviewDay } : previous
          );
        }}
        onPointerUp={async (event) => {
          const currentDrag = dragState?.itemId === item.id ? dragState : null;
          if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          await onDragFinish(currentDrag, true);
        }}
        onPointerCancel={async (event) => {
          const currentDrag = dragState?.itemId === item.id ? dragState : null;
          if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          await onDragFinish(currentDrag, false);
        }}
      />

      {relativeLabel ? (
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            top: "50%",
            left: relativeLabelLeft,
            width: Math.max(0, timelineWidth - relativeLabelLeft - 8),
            transform: "translateY(-50%)",
            fontWeight: activeDrag ? 700 : 600,
            color: activeDrag ? "primary.main" : item.isOverdue ? "warning.dark" : "text.secondary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {relativeLabel}
        </Typography>
      ) : null}
    </Box>
  );
}

function TimelinePlaceholder({ model, label = "Sin fecha" }: { model: FlowAgendaModel; label?: string }) {
  const theme = useTheme();
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;

  return (
    <Box
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />
      <TodayGuide model={model} zIndex={1} />
      <Box
        sx={{
          position: "absolute",
          top: 10,
          right: 8,
          bottom: 10,
          left: 12,
          display: "flex",
          alignItems: "center",
          px: 1.2,
          borderRadius: `${theme.appShape.md}px`,
          border: "1px dashed",
          borderColor: alpha(theme.palette.warning.main, 0.42),
          bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.13 : 0.07),
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function AgendaGroupTimeline({ model }: { model: FlowAgendaModel }) {
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;

  return (
    <Box
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: GROUP_ROW_HEIGHT,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <TimelineBackground columns={model.columns} height={GROUP_ROW_HEIGHT} />
      <TodayGuide model={model} zIndex={1} />
    </Box>
  );
}

function AgendaRow({
  item,
  model,
  onWorkflowOpen,
  dragState,
  setDragState,
  onDragFinish,
  contentInset = 0,
}: {
  item: FlowAgendaItem;
  model: FlowAgendaModel;
  onWorkflowOpen: (workflowId: string) => void;
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  onDragFinish: (dragState: DragState, commit: boolean) => Promise<void>;
  contentInset?: number;
}) {
  const theme = useTheme();
  const secondaryLabel =
    item.isOverdue ? item.row.movementLabel : item.row.stepLabel === "Disparador" ? "" : item.row.stepLabel;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          width: "100%",
          position: "sticky",
          left: 0,
          zIndex: 3,
          minHeight: FLOW_ROW_HEIGHT,
          height: FLOW_ROW_HEIGHT,
          borderRadius: 0,
          borderColor: "divider",
          borderBottom: "1px solid",
          borderRight: "1px solid",
          borderTop: "none",
          borderLeft: "none",
          bgcolor: "background.paper",
          px: 1.2,
          py: 0,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: FLOW_INFO_GRID_TEMPLATE,
            columnGap: 1,
            alignItems: "center",
            width: "100%",
            minWidth: 0,
            pl: `${contentInset}px`,
          }}
        >
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.65} sx={{ alignItems: "center", minWidth: 0 }}>
              <Tooltip title={item.row.taskName}>
                <ButtonBase
                  onClick={() => onWorkflowOpen(item.row.id)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    borderRadius: `${theme.appShape.sm}px`,
                    px: 0.2,
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.05),
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: 700,
                      color: "text.primary",
                      minWidth: 0,
                    }}
                  >
                    {item.row.taskName}
                  </Typography>
                </ButtonBase>
              </Tooltip>
              {item.row.extraRequirementCount > 0 ? <Chip size="small" variant="outlined" label={`+${item.row.extraRequirementCount}`} /> : null}
            </Stack>
            {secondaryLabel ? (
              <Typography variant="caption" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {secondaryLabel}
              </Typography>
            ) : null}
          </Stack>

          <StatusBadge value={item.row.status} />
        </Box>
      </Box>

      {item.isWithoutDate ? (
        <TimelinePlaceholder model={model} label="Sin fecha" />
      ) : (
        <AgendaTrack
          item={item}
          model={model}
          dragState={dragState}
          setDragState={setDragState}
          onDragFinish={onDragFinish}
        />
      )}
    </Box>
  );
}

function UnscheduledGroupRow({
  count,
  model,
  expanded,
  onToggle,
  contentInset = UNSCHEDULED_GROUP_INDENT,
}: {
  count: number;
  model: FlowAgendaModel;
  expanded: boolean;
  onToggle: () => void;
  contentInset?: number;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
        alignItems: "center",
      }}
    >
      <ButtonBase
        onClick={onToggle}
        sx={{
          position: "sticky",
          left: 0,
          zIndex: 3,
          minHeight: FLOW_ROW_HEIGHT,
          height: FLOW_ROW_HEIGHT,
          justifyContent: "flex-start",
          textAlign: "left",
          borderRadius: 0,
          borderBottom: "1px solid",
          borderRight: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.09 : 0.05),
          px: 1.2,
        }}
      >
        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", pl: `${contentInset}px`, minWidth: 0 }}>
          <ExpandMoreRoundedIcon
            sx={{
              fontSize: 18,
              color: "text.secondary",
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: theme.transitions.create("transform", {
                duration: theme.appMotion.short,
              }),
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Sin fecha de ejecución
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {count} {count === 1 ? "flow" : "flows"}
          </Typography>
        </Stack>
      </ButtonBase>

      <TimelinePlaceholder model={model} label="Sin fecha" />
    </Box>
  );
}

export function FlowAgendaTimeline({ model, onWorkflowOpen, onExecutionDateChange }: FlowAgendaTimelineProps) {
  const theme = useTheme();
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedUnscheduledGroups, setCollapsedUnscheduledGroups] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    setCollapsedGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of model.groups) {
        if (!(group.key in next)) {
          next[group.key] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [model.groups]);

  useEffect(() => {
    setCollapsedUnscheduledGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of model.groups) {
        if (group.unscheduledItems.length > 0 && !(group.key in next)) {
          next[group.key] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [model.groups]);

  const monthSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; startIndex: number; span: number }> = [];

    model.columns.forEach((column, index) => {
      if (segments.length === 0 || column.showMonthLabel) {
        segments.push({
          key: `${column.monthKey}:${column.dateInput}`,
          label: column.monthLabel,
          startIndex: index,
          span: 1,
        });
        return;
      }

      segments[segments.length - 1].span += 1;
    });

    return segments;
  }, [model.columns]);

  function handleToggleGroup(groupKey: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function handleToggleUnscheduledGroup(groupKey: string) {
    setCollapsedUnscheduledGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  async function handleBarPointerFinish(nextDragState: DragState, commit: boolean) {
    if (!commit) {
      setDragState((current) => (current?.itemId === nextDragState.itemId ? null : current));
      return;
    }

    const nextDateInput = formatCalendarDayInput(nextDragState.previewDay);
    if (nextDateInput === nextDragState.originalDateInput) {
      setDragState((current) => (current?.itemId === nextDragState.itemId ? null : current));
      return;
    }

    try {
      await onExecutionDateChange(
        nextDragState.workflowId,
        nextDragState.stepId,
        nextDateInput,
        nextDragState.originalDateInput
      );
    } catch {
      // La página ya revierte el estado optimista y muestra feedback.
    } finally {
      setDragState((current) => (current?.itemId === nextDragState.itemId ? null : current));
    }
  }

  return (
    <Box
      sx={{
        overflow: "auto",
        maxHeight: { xs: "none", md: TIMELINE_MAX_HEIGHT },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: (resolvedTheme) => resolvedTheme.appShape.md,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ position: "relative", minWidth: LEFT_COLUMN_WIDTH + timelineWidth }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "grid",
            gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
            alignItems: "stretch",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              position: "sticky",
              left: 0,
              zIndex: 22,
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
              px: 1.2,
              py: 1,
              display: "grid",
              gridTemplateRows: "28px 36px",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
              Flows activos
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: FLOW_INFO_GRID_TEMPLATE,
                columnGap: 1,
                alignItems: "center",
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Flow / tarea actual
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Estado
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              position: "relative",
              minWidth: timelineWidth,
              width: timelineWidth,
              bgcolor: "background.paper",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${model.columns.length}, ${DAY_COLUMN_WIDTH}px)`,
                height: 28,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {monthSegments.map((segment) => (
                <Box
                  key={segment.key}
                  sx={{
                    gridColumn: `${segment.startIndex + 1} / span ${segment.span}`,
                    px: 0.9,
                    display: "flex",
                    alignItems: "center",
                    borderRight:
                      segment.startIndex + segment.span >= model.columns.length
                        ? "none"
                        : "1px solid",
                    borderColor: "divider",
                    bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.04 : 0.02),
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize", fontWeight: 700 }}>
                    {segment.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                position: "relative",
                minWidth: timelineWidth,
                width: timelineWidth,
                height: 36,
                overflow: "visible",
              }}
            >
              <TimelineBackground columns={model.columns} height={36} />
              {model.isTodayVisible && model.todayColumnIndex !== null ? (
                <Chip
                  label="Hoy"
                  size="small"
                  color="primary"
                  sx={{
                    position: "absolute",
                    top: "calc(100% - 10px)",
                    left: getTodayGuideLeft(model) ?? 0,
                    height: 20,
                    zIndex: 3,
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                    "& .MuiChip-label": {
                      px: 0.75,
                    },
                  }}
                />
              ) : null}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  gridTemplateColumns: `repeat(${model.columns.length}, ${DAY_COLUMN_WIDTH}px)`,
                }}
              >
                {model.columns.map((column) => {
                  const label = formatAgendaColumnLabel(column.dateInput);
                  return (
                    <Box
                      key={column.dateInput}
                      sx={{
                        px: 0.55,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", textTransform: "capitalize", lineHeight: 1.1 }}>
                        {label.weekday}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: column.isToday ? 700 : 600,
                          color: column.isToday ? "primary.main" : "text.primary",
                          lineHeight: 1.15,
                        }}
                      >
                        {label.day}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>

        {model.groups.map((group) => {
          const isCollapsed = collapsedGroups[group.key] ?? false;

          return (
            <Box key={group.key}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
                  alignItems: "center",
                }}
              >
                <ButtonBase
                  onClick={() => handleToggleGroup(group.key)}
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 4,
                    minHeight: GROUP_ROW_HEIGHT,
                    height: GROUP_ROW_HEIGHT,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    borderRadius: 0,
                    borderBottom: "1px solid",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    bgcolor: (resolvedTheme) =>
                      alpha(resolvedTheme.palette.text.primary, resolvedTheme.palette.mode === "dark" ? 0.08 : 0.035),
                    px: 1.1,
                    gap: 0.8,
                  }}
                >
                  <ExpandMoreRoundedIcon
                    sx={{
                      fontSize: 18,
                      color: "text.secondary",
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      transition: theme.transitions.create("transform", {
                        duration: theme.appMotion.short,
                      }),
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {group.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.items.length} {group.items.length === 1 ? "flow" : "flows"}
                  </Typography>
                  {group.unscheduledItems.length > 0 ? (
                    <Chip size="small" variant="outlined" color="warning" label={`${group.unscheduledItems.length} sin fecha`} />
                  ) : null}
                </ButtonBase>

                <AgendaGroupTimeline model={model} />
              </Box>

              {!isCollapsed
                ? (
                    <>
                      {group.scheduledItems.map((item) => (
                        <AgendaRow
                          key={item.id}
                          item={item}
                          model={model}
                          onWorkflowOpen={onWorkflowOpen}
                          dragState={dragState}
                          setDragState={setDragState}
                          onDragFinish={handleBarPointerFinish}
                        />
                      ))}
                      {group.unscheduledItems.length > 0 ? (
                        <>
                          <UnscheduledGroupRow
                            count={group.unscheduledItems.length}
                            model={model}
                            expanded={!(collapsedUnscheduledGroups[group.key] ?? true)}
                            onToggle={() => handleToggleUnscheduledGroup(group.key)}
                            contentInset={UNSCHEDULED_GROUP_INDENT}
                          />
                          {!(collapsedUnscheduledGroups[group.key] ?? true)
                            ? group.unscheduledItems.map((item) => (
                                <AgendaRow
                                  key={item.id}
                                  item={item}
                                  model={model}
                                  onWorkflowOpen={onWorkflowOpen}
                                  dragState={dragState}
                                  setDragState={setDragState}
                                  onDragFinish={handleBarPointerFinish}
                                  contentInset={UNSCHEDULED_ITEM_INDENT}
                                />
                              ))
                            : null}
                        </>
                      ) : null}
                    </>
                  )
                : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
