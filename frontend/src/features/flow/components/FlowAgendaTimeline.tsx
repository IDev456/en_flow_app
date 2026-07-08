import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, ButtonBase, Chip, Stack, Tooltip, Typography } from "@mui/material";

import { getStatusToken } from "../../../theme";
import { StatusBadge } from "./StatusBadge";
import type { FlowAgendaColumn, FlowAgendaItem, FlowAgendaModel } from "../utils/flowAgenda";
import { formatCalendarDate, formatCalendarDayInput, formatRelativeCalendarDay, getStatusTone, toCalendarDayValue } from "../utils";

type FlowAgendaTimelineProps = {
  model: FlowAgendaModel;
  onWorkflowOpen: (workflowId: string) => void;
  onExecutionDateChange: (
    workflowId: string,
    stepId: string,
    nextDateInput: string,
    previousDateInput: string | null
  ) => Promise<void>;
  onWaitingReminderChange: (
    workflowId: string,
    stepId: string,
    nextDateInput: string,
    previousDateInput: string | null
  ) => Promise<void>;
};

const LEFT_COLUMN_WIDTH = 460;
const DAY_COLUMN_WIDTH = 68;
const GROUP_ROW_HEIGHT = 58;
const FLOW_ROW_HEIGHT = 50;
const TIMELINE_MAX_HEIGHT = "calc(100vh - 250px)";
const FLOW_INFO_GRID_TEMPLATE = "minmax(0, 1fr) 108px";
const UNSCHEDULED_GROUP_INDENT = 18;
const UNSCHEDULED_ITEM_INDENT = 34;
const PROJECT_CHILD_INDENT = UNSCHEDULED_ITEM_INDENT;

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
  itemKind: FlowAgendaItem["kind"];
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

function TodayGuideOverlay({
  model,
  horizontalScrollLeft,
}: {
  model: FlowAgendaModel;
  horizontalScrollLeft: number;
}) {
  const theme = useTheme();
  const todayGuideLeft = getTodayGuideLeft(model);

  if (todayGuideLeft === null) {
    return null;
  }

  return (
    <Box
      data-testid="agenda-today-guide-overlay"
      aria-hidden
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: `${LEFT_COLUMN_WIDTH}px`,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 8,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: todayGuideLeft - horizontalScrollLeft,
          width: 2,
          transform: "translateX(-50%)",
          bgcolor: alpha(theme.palette.primary.main, 0.65),
          boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.12)}`,
        }}
      />
      <Chip
        data-testid="agenda-today-chip"
        data-today-chip-style="custom"
        label="Hoy"
        size="small"
        sx={{
          position: "absolute",
          top: 10,
          left: todayGuideLeft - horizontalScrollLeft,
          height: 20,
          transform: "translateX(-50%)",
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          color: theme.palette.primary.dark,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
          boxShadow: `0 1px 2px ${alpha(theme.palette.primary.main, 0.1)}`,
          "& .MuiChip-label": {
            px: 0.75,
            fontWeight: 700,
          },
        }}
      />
    </Box>
  );
}

function buildAgendaTooltipLines(
  item: FlowAgendaItem,
  primaryDateLabel: string,
  primaryDateInput: string | null
) {
  return [
    { label: "Estado", value: item.kind === "waiting_reminder" ? "Esperando respuesta" : "En proceso" },
    primaryDateInput ? { label: primaryDateLabel, value: formatCalendarDate(primaryDateInput) } : null,
    item.row.waitingSinceInput ? { label: "Esperando desde", value: formatCalendarDate(item.row.waitingSinceInput) } : null,
    item.row.movementLabel ? { label: "Último movimiento", value: item.row.movementLabel } : null,
    item.row.lastRecord ? { label: "Último registro", value: item.row.lastRecord } : null,
  ].filter((line): line is { label: string; value: string } => Boolean(line));
}

function AgendaTooltipContent({
  item,
  lines,
}: {
  item: FlowAgendaItem;
  lines: Array<{ label: string; value: string }>;
}) {
  return (
    <Stack spacing={0.45} sx={{ py: 0.2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {item.row.taskName}
      </Typography>
      {lines.map((line) => (
        <Typography key={line.label} variant="caption" sx={{ display: "block" }}>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {line.label}:
          </Box>{" "}
          {line.value}
        </Typography>
      ))}
    </Stack>
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
  const isDanger = item.isOverdue || Boolean(item.row.hasProblem);
  const activeDrag = dragState?.itemId === item.id ? dragState : null;
  const effectiveStartDay = activeDrag?.previewDay ?? item.startDay;
  const effectiveStartDateInput = effectiveStartDay === null ? item.startDateInput : formatCalendarDayInput(effectiveStartDay);
  const startOffset = effectiveStartDay === null ? 0 : effectiveStartDay - model.visibleStartDay;
  const barLeft = startOffset * DAY_COLUMN_WIDTH + 5;
  const barWidth = Math.max(DAY_COLUMN_WIDTH - 10, item.spanDays * DAY_COLUMN_WIDTH - 10);
  const relativeLabel = formatRelativeCalendarDay(effectiveStartDateInput);
  const relativeLabelLeft = barLeft + barWidth + 8;
  const isDraggable = Boolean(item.row.stepId && item.startDateInput);
  const tooltipLines = buildAgendaTooltipLines(item, "Fecha de ejecución", effectiveStartDateInput);

  return (
    <Box
      data-row-divider="none"
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />

      <Tooltip title={<AgendaTooltipContent item={item} lines={tooltipLines} />}>
        <Box
          data-agenda-tooltip="detailed"
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
              itemKind: item.kind,
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
            borderColor: isDanger ? statusToken.accent : statusToken.border,
            bgcolor:
              activeDrag
                ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.18)
                : isDanger
                  ? alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.28 : 0.18)
                  : statusToken.container,
            color: isDanger ? theme.palette.error.dark : statusToken.onContainer,
            boxShadow: isDanger ? `inset 0 0 0 1px ${alpha(theme.palette.error.main, 0.14)}` : "none",
            cursor: isDraggable ? (activeDrag ? "grabbing" : "grab") : "default",
            touchAction: "none",
            userSelect: "none",
            "&:hover": {
              bgcolor: activeDrag
                ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.32 : 0.22)
                : isDanger
                  ? alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.34 : 0.24)
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
      </Tooltip>

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
            color: activeDrag ? "primary.main" : isDanger ? "error.dark" : "text.secondary",
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

function TimelinePlaceholder({
  model,
  label = "Sin fecha",
  onAssign,
  stepId,
}: {
  model: FlowAgendaModel;
  label?: string;
  onAssign?: (nextDateInput: string) => Promise<void>;
  stepId?: string | null;
}) {
  const theme = useTheme();
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;
  const [hoverColumnIndex, setHoverColumnIndex] = useState<number | null>(null);

  return (
    <Box
      data-row-divider="none"
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />

      <Box
        onMouseMove={(event) => {
          if (!onAssign) return;
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const x = event.clientX - rect.left;
          const columnIndex = Math.floor((x / timelineWidth) * model.columns.length);
          if (columnIndex < 0 || columnIndex >= model.columns.length) {
            setHoverColumnIndex(null);
            return;
          }
          setHoverColumnIndex(columnIndex);
        }}
        onMouseLeave={() => setHoverColumnIndex(null)}
        onClick={async (event) => {
          if (!onAssign || !stepId) return;
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const x = event.clientX - rect.left;
          const columnIndex = Math.floor((x / timelineWidth) * model.columns.length);
          if (columnIndex < 0 || columnIndex >= model.columns.length) return;
          const column = model.columns[columnIndex];
          const target = column.dateInput;
          try {
            await onAssign(target);
          } catch {
            // caller handles toast/revert
          }
        }}
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
          cursor: onAssign && stepId ? "pointer" : "default",
        }}
      >
        {hoverColumnIndex !== null ? (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: hoverColumnIndex * DAY_COLUMN_WIDTH,
              width: DAY_COLUMN_WIDTH,
              height: "100%",
              bgcolor: (currentTheme) => alpha(currentTheme.palette.primary.main, 0.12),
              pointerEvents: "none",
              borderRadius: `${theme.appShape.sm}px`,
            }}
          />
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function TimelineTextRow({
  model,
  label,
}: {
  model: FlowAgendaModel;
  label: string;
}) {
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;

  return (
    <Box
      data-row-divider="none"
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          position: "absolute",
          top: "50%",
          left: 12,
          transform: "translateY(-50%)",
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function WaitingReminderMarker({
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

  if (item.startDay === null || item.startDateInput === null) {
    return <TimelineTextRow model={model} label="Sin recordatorio" />;
  }

  const markerCenter = (item.startDay - model.visibleStartDay) * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2;
  const relativeLabel = formatRelativeCalendarDay(item.startDateInput);
  const isDanger = item.isOverdue || Boolean(item.row.hasProblem);
  const markerTone = isDanger ? theme.palette.error : theme.palette.warning;
  const activeDrag = dragState?.itemId === item.id ? dragState : null;
  const effectiveStartDay = activeDrag?.previewDay ?? item.startDay;
  const effectiveStartDateInput = effectiveStartDay === null ? item.startDateInput : formatCalendarDayInput(effectiveStartDay);
  const effectiveMarkerCenter = (effectiveStartDay - model.visibleStartDay) * DAY_COLUMN_WIDTH + DAY_COLUMN_WIDTH / 2;
  const isDraggable = Boolean(item.row.stepId && item.startDateInput);
  const tooltipLines = buildAgendaTooltipLines(item, "Recordatorio", effectiveStartDateInput);

  return (
    <Box
      data-row-divider="none"
      sx={{
        position: "relative",
        minWidth: timelineWidth,
        width: timelineWidth,
        height: FLOW_ROW_HEIGHT,
        overflow: "hidden",
      }}
    >
      <TimelineBackground columns={model.columns} height={FLOW_ROW_HEIGHT} />
      <Tooltip
        title={<AgendaTooltipContent item={item} lines={tooltipLines} />}
      >
        <ButtonBase
          data-testid={`agenda-waiting-reminder-${item.row.id}`}
          data-agenda-tooltip="detailed"
          aria-label={`Mover recordatorio del flow ${item.row.taskName}`}
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
              itemKind: item.kind,
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
          sx={{
            position: "absolute",
            left: effectiveMarkerCenter,
            top: "50%",
            width: 28,
            height: 28,
            transform: "translate(-50%, -50%)",
            borderRadius: "999px",
            border: "1px solid",
            borderColor: alpha(markerTone.main, 0.34),
            bgcolor: alpha(markerTone.main, theme.palette.mode === "dark" ? (activeDrag ? 0.32 : 0.2) : activeDrag ? 0.2 : 0.12),
            color: markerTone.main,
            zIndex: 2,
            cursor: isDraggable ? (activeDrag ? "grabbing" : "grab") : "pointer",
            touchAction: "none",
            "&:hover": {
              bgcolor: alpha(markerTone.main, theme.palette.mode === "dark" ? 0.28 : 0.18),
            },
          }}
        >
          <NotificationsNoneRoundedIcon sx={{ fontSize: 18 }} />
        </ButtonBase>
      </Tooltip>

      {relativeLabel ? (
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            top: "50%",
            left: effectiveMarkerCenter + 20,
            width: Math.max(0, timelineWidth - effectiveMarkerCenter - 28),
            transform: "translateY(-50%)",
            fontWeight: 700,
            color: activeDrag ? "primary.main" : isDanger ? "error.dark" : "text.secondary",
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

function ProjectHeaderLabel({
  groupLabel,
  flowCount,
  unscheduledCount,
  waitingWithoutReminderCount,
  expanded,
  onToggle,
}: {
  groupLabel: string;
  flowCount: number;
  unscheduledCount: number;
  waitingWithoutReminderCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <ButtonBase
      data-project-header-style="flat"
      data-project-header-width="full"
      onClick={onToggle}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        minHeight: GROUP_ROW_HEIGHT,
        height: GROUP_ROW_HEIGHT,
        justifyContent: "flex-start",
        textAlign: "left",
        borderRadius: 0,
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
          transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          transition: theme.transitions.create("transform", {
            duration: theme.appMotion.short,
          }),
        }}
      />
      <Stack spacing={0.25} sx={{ minWidth: 0, justifyContent: "center", py: 0.5 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {groupLabel}
        </Typography>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.4 }}>
          <Typography variant="caption" color="text.secondary">
            {flowCount} {flowCount === 1 ? "flow" : "flows"}
          </Typography>
          {unscheduledCount > 0 ? (
            <Chip size="small" variant="outlined" color="warning" label={`${unscheduledCount} sin fecha`} />
          ) : null}
          {waitingWithoutReminderCount > 0 ? (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={`${waitingWithoutReminderCount} espera sin recordatorio`}
            />
          ) : null}
        </Stack>
      </Stack>
    </ButtonBase>
  );
}

function ProjectHeaderFill() {
  return (
    <Box
      data-project-header-style="flat"
      sx={{
        width: "100%",
        minWidth: 0,
        height: GROUP_ROW_HEIGHT,
        bgcolor: (resolvedTheme) =>
          alpha(resolvedTheme.palette.text.primary, resolvedTheme.palette.mode === "dark" ? 0.08 : 0.035),
      }}
    />
  );
}

function AgendaRowLabel({
  item,
  onWorkflowOpen,
  contentInset = 0,
}: {
  item: FlowAgendaItem;
  onWorkflowOpen: (workflowId: string) => void;
  contentInset?: number;
}) {
  const theme = useTheme();
  const secondaryLabel =
    item.isOverdue ? item.row.movementLabel : item.row.stepLabel === "Disparador" ? "" : item.row.stepLabel;

  return (
    <Box
      data-testid={`agenda-row-${item.id}`}
      data-row-divider="none"
      sx={{
        minHeight: FLOW_ROW_HEIGHT,
        height: FLOW_ROW_HEIGHT,
        bgcolor: "background.paper",
        px: 1.2,
        py: 0,
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        data-content-inset={contentInset}
        sx={{
          display: "grid",
          gridTemplateColumns: FLOW_INFO_GRID_TEMPLATE,
          columnGap: 1,
          alignItems: "center",
          width: "100%",
          minWidth: 0,
          height: "100%",
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
                    fontWeight: 500,
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
  );
}

function AgendaRowTimeline({
  item,
  model,
  dragState,
  setDragState,
  onDragFinish,
  onExecutionDateChange,
  onWaitingReminderChange,
}: {
  item: FlowAgendaItem;
  model: FlowAgendaModel;
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  onDragFinish: (dragState: DragState, commit: boolean) => Promise<void>;
  onExecutionDateChange: (workflowId: string, stepId: string, nextDateInput: string, previousDateInput: string | null) => Promise<void>;
  onWaitingReminderChange: (workflowId: string, stepId: string, nextDateInput: string, previousDateInput: string | null) => Promise<void>;
}) {
  if (item.kind === "waiting_reminder") {
    if (item.isWithoutDate) {
      return (
        <TimelinePlaceholder
          model={model}
          label="Sin recordatorio"
          stepId={item.row.stepId ?? null}
          onAssign={(nextDateInput) => {
            if (!item.row.stepId) {
              return Promise.reject(new Error("no-step"));
            }
            return onWaitingReminderChange(item.row.id, item.row.stepId, nextDateInput, null);
          }}
        />
      );
    }

    return (
      <WaitingReminderMarker
        item={item}
        model={model}
        dragState={dragState}
        setDragState={setDragState}
        onDragFinish={onDragFinish}
      />
    );
  }

  if (item.isWithoutDate) {
    return (
      <TimelinePlaceholder
        model={model}
        label="Sin fecha"
        stepId={item.row.stepId ?? null}
        onAssign={(nextDateInput) => {
          if (!item.row.stepId) {
            return Promise.reject(new Error("no-step"));
          }
          return onExecutionDateChange(item.row.id, item.row.stepId, nextDateInput, null);
        }}
      />
    );
  }

  return (
    <AgendaTrack
      item={item}
      model={model}
      dragState={dragState}
      setDragState={setDragState}
      onDragFinish={onDragFinish}
    />
  );
}

function UnscheduledGroupLabel({
  count,
  expanded,
  onToggle,
  contentInset = UNSCHEDULED_GROUP_INDENT,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  contentInset?: number;
}) {
  const theme = useTheme();

  return (
    <ButtonBase
      data-testid="agenda-unscheduled-group-row"
      data-row-divider="none"
      onClick={onToggle}
      sx={{
        minHeight: FLOW_ROW_HEIGHT,
        height: FLOW_ROW_HEIGHT,
        justifyContent: "flex-start",
        textAlign: "left",
        borderRadius: 0,
        bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.09 : 0.05),
        px: 1.2,
        borderRight: "1px solid",
        borderColor: "divider",
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
  );
}

function UnscheduledGroupTimeline({ model }: { model: FlowAgendaModel }) {
  return <TimelinePlaceholder model={model} label="Sin fecha" />;
}

function WaitingWithoutReminderGroupLabel({
  count,
  expanded,
  onToggle,
  contentInset = UNSCHEDULED_GROUP_INDENT,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  contentInset?: number;
}) {
  const theme = useTheme();

  return (
    <ButtonBase
      data-testid="agenda-waiting-without-reminder-group-row"
      data-row-divider="none"
      onClick={onToggle}
      sx={{
        minHeight: FLOW_ROW_HEIGHT,
        height: FLOW_ROW_HEIGHT,
        justifyContent: "flex-start",
        textAlign: "left",
        borderRadius: 0,
        bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.09 : 0.05),
        px: 1.2,
        borderRight: "1px solid",
        borderColor: "divider",
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
          En espera sin recordatorio
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count} {count === 1 ? "flow" : "flows"}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function WaitingWithoutReminderGroupTimeline({ model }: { model: FlowAgendaModel }) {
  return <TimelineTextRow model={model} label="Sin recordatorio" />;
}

export function FlowAgendaTimeline({ model, onWorkflowOpen, onExecutionDateChange, onWaitingReminderChange }: FlowAgendaTimelineProps) {
  const theme = useTheme();
  const timelineWidth = model.columns.length * DAY_COLUMN_WIDTH;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedUnscheduledGroups, setCollapsedUnscheduledGroups] = useState<Record<string, boolean>>({});
  const [collapsedWaitingWithoutReminderGroups, setCollapsedWaitingWithoutReminderGroups] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0);

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

  useEffect(() => {
    setCollapsedWaitingWithoutReminderGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of model.groups) {
        if (group.waitingWithoutReminderItems.length > 0 && !(group.key in next)) {
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

  const visibleGroups = useMemo(
    () =>
      model.groups.map((group) => {
        const isCollapsed = collapsedGroups[group.key] ?? false;
        const isUnscheduledCollapsed = collapsedUnscheduledGroups[group.key] ?? true;
        const isWaitingWithoutReminderCollapsed = collapsedWaitingWithoutReminderGroups[group.key] ?? true;
        const showGroupChildren = !isCollapsed;
        const showUnscheduledItems = showGroupChildren && group.unscheduledItems.length > 0 && !isUnscheduledCollapsed;
        const showWaitingWithoutReminderItems =
          showGroupChildren && group.waitingWithoutReminderItems.length > 0 && !isWaitingWithoutReminderCollapsed;

        return {
          group,
          isCollapsed,
          isUnscheduledCollapsed,
          isWaitingWithoutReminderCollapsed,
          showGroupChildren,
          showUnscheduledItems,
          showWaitingWithoutReminderItems,
          hasVisibleChildren:
            showGroupChildren &&
            (group.scheduledItems.length > 0 ||
              group.unscheduledItems.length > 0 ||
              group.waitingWithoutReminderItems.length > 0),
        };
      }),
    [collapsedGroups, collapsedUnscheduledGroups, collapsedWaitingWithoutReminderGroups, model.groups]
  );

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

  function handleToggleWaitingWithoutReminderGroup(groupKey: string) {
    setCollapsedWaitingWithoutReminderGroups((current) => ({
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
      if (nextDragState.itemKind === "waiting_reminder") {
        await onWaitingReminderChange(
          nextDragState.workflowId,
          nextDragState.stepId,
          nextDateInput,
          nextDragState.originalDateInput
        );
      } else {
        await onExecutionDateChange(
          nextDragState.workflowId,
          nextDragState.stepId,
          nextDateInput,
          nextDragState.originalDateInput
        );
      }
    } catch {
      // La página ya revierte el estado optimista y muestra feedback.
    } finally {
      setDragState((current) => (current?.itemId === nextDragState.itemId ? null : current));
    }
  }

  return (
    <Box
      sx={{
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: `${theme.appShape.md}px`,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <TodayGuideOverlay model={model} horizontalScrollLeft={horizontalScrollLeft} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
          alignItems: "stretch",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
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
            Flows operativos
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
          data-testid="agenda-gantt-header-viewport"
          sx={{
            position: "relative",
            minWidth: 0,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          <Box
            sx={{
              width: timelineWidth,
              minWidth: timelineWidth,
              transform: `translateX(-${horizontalScrollLeft}px)`,
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
      </Box>

      <Box
        data-testid="agenda-body-scroll"
        data-scroll-axis="y"
        sx={{
          maxHeight: { xs: "none", md: TIMELINE_MAX_HEIGHT },
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarGutter: "stable",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)`,
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: LEFT_COLUMN_WIDTH, bgcolor: "background.paper" }}>
            {visibleGroups.map(
              ({
                group,
                isCollapsed,
                isUnscheduledCollapsed,
                isWaitingWithoutReminderCollapsed,
                showGroupChildren,
                showUnscheduledItems,
                showWaitingWithoutReminderItems,
                hasVisibleChildren,
              }) => (
              <Box
                key={group.key}
                data-testid={`agenda-project-group-${group.key}`}
                sx={{
                  ml: 1,
                  mr: 0,
                  my: 0.9,
                  border: "1px solid",
                  borderRight: "none",
                  borderColor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.34 : 0.32),
                  borderRadius: `${theme.appShape.md}px 0 0 ${theme.appShape.md}px`,
                  overflow: "hidden",
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  sx={{
                    borderBottom: hasVisibleChildren ? "1px solid" : "none",
                    borderColor: "divider",
                  }}
                >
                  <ProjectHeaderLabel
                    groupLabel={group.label}
                    flowCount={group.items.length}
                    unscheduledCount={group.unscheduledItems.length}
                    waitingWithoutReminderCount={group.waitingWithoutReminderItems.length}
                    expanded={!isCollapsed}
                    onToggle={() => handleToggleGroup(group.key)}
                  />
                </Box>

                {showGroupChildren ? (
                  <>
                    {group.scheduledItems.map((item) => (
                      <AgendaRowLabel
                        key={item.id}
                        item={item}
                        onWorkflowOpen={onWorkflowOpen}
                        contentInset={PROJECT_CHILD_INDENT}
                      />
                    ))}
                    {group.unscheduledItems.length > 0 ? (
                      <>
                        <UnscheduledGroupLabel
                          count={group.unscheduledItems.length}
                          expanded={!isUnscheduledCollapsed}
                          onToggle={() => handleToggleUnscheduledGroup(group.key)}
                          contentInset={UNSCHEDULED_GROUP_INDENT}
                        />
                        {showUnscheduledItems
                          ? group.unscheduledItems.map((item) => (
                              <AgendaRowLabel
                                key={item.id}
                                item={item}
                                onWorkflowOpen={onWorkflowOpen}
                                contentInset={UNSCHEDULED_ITEM_INDENT}
                              />
                            ))
                          : null}
                      </>
                    ) : null}
                    {group.waitingWithoutReminderItems.length > 0 ? (
                      <>
                        <WaitingWithoutReminderGroupLabel
                          count={group.waitingWithoutReminderItems.length}
                          expanded={!isWaitingWithoutReminderCollapsed}
                          onToggle={() => handleToggleWaitingWithoutReminderGroup(group.key)}
                          contentInset={UNSCHEDULED_GROUP_INDENT}
                        />
                        {showWaitingWithoutReminderItems
                          ? group.waitingWithoutReminderItems.map((item) => (
                              <AgendaRowLabel
                                key={item.id}
                                item={item}
                                onWorkflowOpen={onWorkflowOpen}
                                contentInset={UNSCHEDULED_ITEM_INDENT}
                              />
                            ))
                          : null}
                      </>
                    ) : null}
                  </>
                ) : null}
              </Box>
            ))}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box
              data-testid="agenda-gantt-scroll"
              data-scroll-axis="x"
              onScroll={(event) => setHorizontalScrollLeft(event.currentTarget.scrollLeft)}
              sx={{
                minWidth: 0,
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarGutter: "stable",
              }}
            >
              <Box sx={{ width: timelineWidth, minWidth: timelineWidth }}>
                {visibleGroups.map(
                  ({
                    group,
                    showGroupChildren,
                    showUnscheduledItems,
                    showWaitingWithoutReminderItems,
                    hasVisibleChildren,
                  }) => (
                  <Box
                    key={group.key}
                sx={{
                  ml: 0,
                  mr: 1,
                  my: 0.9,
                  border: "1px solid",
                  borderLeft: "none",
                  borderColor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.34 : 0.32),
                  borderRadius: `0 ${theme.appShape.md}px ${theme.appShape.md}px 0`,
                  overflow: "hidden",
                  bgcolor: (resolvedTheme) =>
                    alpha(resolvedTheme.palette.text.primary, resolvedTheme.palette.mode === "dark" ? 0.08 : 0.035),
                }}
              >
                    <Box
                      sx={{
                        borderBottom: hasVisibleChildren ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <ProjectHeaderFill />
                    </Box>

                    {showGroupChildren ? (
                      <>
                        {group.scheduledItems.map((item) => (
                          <AgendaRowTimeline
                            key={item.id}
                            item={item}
                            model={model}
                            dragState={dragState}
                            setDragState={setDragState}
                            onDragFinish={handleBarPointerFinish}
                            onExecutionDateChange={onExecutionDateChange}
                            onWaitingReminderChange={onWaitingReminderChange}
                          />
                        ))}
                        {group.unscheduledItems.length > 0 ? (
                          <>
                            <UnscheduledGroupTimeline model={model} />
                            {showUnscheduledItems
                              ? group.unscheduledItems.map((item) => (
                                  <AgendaRowTimeline
                                    key={item.id}
                                    item={item}
                                    model={model}
                                    dragState={dragState}
                                    setDragState={setDragState}
                                    onDragFinish={handleBarPointerFinish}
                                    onExecutionDateChange={onExecutionDateChange}
                                    onWaitingReminderChange={onWaitingReminderChange}
                                  />
                                ))
                              : null}
                          </>
                        ) : null}
                        {group.waitingWithoutReminderItems.length > 0 ? (
                          <>
                            <WaitingWithoutReminderGroupTimeline model={model} />
                            {showWaitingWithoutReminderItems
                              ? group.waitingWithoutReminderItems.map((item) => (
                                  <AgendaRowTimeline
                                    key={item.id}
                                    item={item}
                                    model={model}
                                    dragState={dragState}
                                    setDragState={setDragState}
                                    onDragFinish={handleBarPointerFinish}
                                    onExecutionDateChange={onExecutionDateChange}
                                    onWaitingReminderChange={onWaitingReminderChange}
                                  />
                                ))
                              : null}
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
