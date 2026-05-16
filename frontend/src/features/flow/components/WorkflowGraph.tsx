import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Button, ButtonBase, Card, Chip, IconButton, Stack, TextField, Typography } from "@mui/material";

import { getStatusToken } from "../../../theme";
import type { Step } from "../types";
import { formatCalendarDate, formatElapsedTime, formatRelativeCalendarDay, getStatusTone, humanizeStatus } from "../utils";
import type { WorkflowVariant } from "./WorkflowVariantSwitcher";

type WorkflowGraphProps = {
  variant: WorkflowVariant;
  triggerLabel: string;
  steps: Step[];
  workflowClosed: boolean;
  selectedStepId: string | null;
  stepHasRecords?: Record<string, boolean>;
  onSelectStep: (stepId: string) => void;
  onOpenStep: (stepId: string) => void;
  onOpenTrigger: () => void;
  onCompleteStepIntent?: (stepId: string) => void;
  onRenameStep?: (step: Step, nextName: string) => Promise<void>;
  onUpdateStepReminderDate?: (stepId: string, dateInput: string) => Promise<void>;
};

export function WorkflowGraph(props: WorkflowGraphProps) {
  const [editingReminderStepId, setEditingReminderStepId] = useState<string | null>(null);
  const [savingReminderStepId, setSavingReminderStepId] = useState<string | null>(null);
  const [reminderDraftByStepId, setReminderDraftByStepId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editingReminderStepId) return;
    if (props.steps.some((step) => step.id === editingReminderStepId)) return;
    setEditingReminderStepId(null);
  }, [editingReminderStepId, props.steps]);

  function toDateInputValue(value: string | null | undefined) {
    return value ? value.slice(0, 10) : "";
  }

  function startReminderEdit(step: Step) {
    setReminderDraftByStepId((previous) => ({
      ...previous,
      [step.id]: toDateInputValue(step.fecha_vencimiento),
    }));
    setEditingReminderStepId(step.id);
  }

  function cancelReminderEdit(step: Step) {
    setReminderDraftByStepId((previous) => ({
      ...previous,
      [step.id]: toDateInputValue(step.fecha_vencimiento),
    }));
    setEditingReminderStepId((current) => (current === step.id ? null : current));
  }

  async function saveReminderEdit(step: Step) {
    if (!props.onUpdateStepReminderDate) return;
    const originalValue = toDateInputValue(step.fecha_vencimiento);
    const draftValue = (reminderDraftByStepId[step.id] ?? originalValue).trim();
    if (draftValue === originalValue) {
      setEditingReminderStepId((current) => (current === step.id ? null : current));
      return;
    }

    try {
      setSavingReminderStepId(step.id);
      await props.onUpdateStepReminderDate(step.id, draftValue);
      setEditingReminderStepId((current) => (current === step.id ? null : current));
    } finally {
      setSavingReminderStepId((current) => (current === step.id ? null : current));
    }
  }

  if (props.variant === "gitlog") {
    return (
      <GitLogWorkflowGraph
        {...props}
        editingReminderStepId={editingReminderStepId}
        savingReminderStepId={savingReminderStepId}
        reminderDraftByStepId={reminderDraftByStepId}
        onReminderDraftChange={(stepId, value) =>
          setReminderDraftByStepId((previous) => ({
            ...previous,
            [stepId]: value,
          }))
        }
        onStartReminderEdit={startReminderEdit}
        onCancelReminderEdit={cancelReminderEdit}
        onSaveReminderEdit={saveReminderEdit}
      />
    );
  }

  return (
    <VerticalWorkflowGraph
      {...props}
      editingReminderStepId={editingReminderStepId}
      savingReminderStepId={savingReminderStepId}
      reminderDraftByStepId={reminderDraftByStepId}
      onReminderDraftChange={(stepId, value) =>
        setReminderDraftByStepId((previous) => ({
          ...previous,
          [stepId]: value,
        }))
      }
      onStartReminderEdit={startReminderEdit}
      onCancelReminderEdit={cancelReminderEdit}
      onSaveReminderEdit={saveReminderEdit}
    />
  );
}

function formatExpectedExternalEventLabel(expected?: string | null): string | null {
  const trimmed = expected?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("esperando") ? trimmed : `Esperando ${trimmed}`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return "menos de 1 min";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function formatDurationBetween(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const ms = Math.max(0, endMs - startMs);
  return formatDuration(ms);
}

function renderStepTiming(step: Step): React.ReactElement | null {
  const createdElapsed = step.fecha_creacion ? formatElapsedTime(step.fecha_creacion) : null;
  const stateSinceElapsed = step.fecha_estado_actual ? formatElapsedTime(step.fecha_estado_actual) : null;
  const isClosed = step.estado === "completado" || step.estado === "cancelada";
  const stateDuration = formatDurationBetween(step.fecha_estado_actual, isClosed ? step.fecha_cierre : null);
  const totalDuration = isClosed ? formatDurationBetween(step.fecha_creacion, step.fecha_cierre) : null;

  const lines: string[] = [];
  if (createdElapsed) lines.push(`Creada ${createdElapsed}`);
  if (stateSinceElapsed) lines.push(`En este estado desde ${stateSinceElapsed}`);
  if (isClosed && totalDuration) {
    lines.push(`Tiempo total ${totalDuration}`);
  } else if (stateDuration) {
    lines.push(`Tiempo en estado ${stateDuration}`);
  }

  if (lines.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 0.65,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 0.85,
      }}
    >
      {lines.map((line, index) => (
        <Stack
          key={line}
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            minWidth: 0,
            ...(index > 0
              ? {
                  pl: 0.85,
                  position: "relative",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "divider",
                    transform: "translateY(-50%)",
                  },
                }
              : {}),
          }}
        >
          <AccessTimeRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">
            {line}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

function renderStepRecordsIndicator(hasRecords: boolean, onClick: () => void): React.ReactElement {
  return (
    <ButtonBase
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        borderRadius: 999,
        width: "fit-content",
        textAlign: "left",
        px: 0.9,
        py: 0.45,
        backgroundColor: "surfaceContainerLow",
        border: "1px solid",
        borderColor: "outlineVariant",
        transition: (theme) =>
          theme.transitions.create(["background-color", "border-color", "color"], {
            duration: theme.appMotion.short,
          }),
        "&:hover .records-label, &:hover .records-value": {
          textDecoration: "underline",
        },
        "&:hover": {
          backgroundColor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.08 : 0.05),
        },
      }}
    >
      <NotesRoundedIcon sx={{ fontSize: 14 }} />
      <Typography className="records-label" variant="caption" color="text.secondary">
        Registros
      </Typography>
      <Typography className="records-value" variant="caption" color={hasRecords ? "text.primary" : "text.secondary"}>
        {hasRecords ? "Con registros" : "Sin registros"}
      </Typography>
    </ButtonBase>
  );
}

type ReminderEditorProps = {
  step: Step;
  editingReminderStepId: string | null;
  savingReminderStepId: string | null;
  reminderDraftByStepId: Record<string, string>;
  onUpdateStepReminderDate?: (stepId: string, dateInput: string) => Promise<void>;
  onReminderDraftChange: (stepId: string, value: string) => void;
  onStartReminderEdit: (step: Step) => void;
  onCancelReminderEdit: (step: Step) => void;
  onSaveReminderEdit: (step: Step) => Promise<void>;
};

function renderStepReminder({
  step,
  editingReminderStepId,
  savingReminderStepId,
  reminderDraftByStepId,
  onUpdateStepReminderDate,
  onReminderDraftChange,
  onStartReminderEdit,
  onCancelReminderEdit,
  onSaveReminderEdit,
}: ReminderEditorProps): React.ReactElement {
  const reminder = step.fecha_vencimiento;
  const relativeLabel = reminder ? formatRelativeCalendarDay(reminder) : null;
  const absoluteLabel = reminder ? formatCalendarDate(reminder) : null;
  const valueLabel = reminder
    ? relativeLabel && absoluteLabel
      ? `${relativeLabel} · ${absoluteLabel}`
      : relativeLabel ?? absoluteLabel ?? "Sin recordatorio"
    : "Sin recordatorio";
  const isEditing = editingReminderStepId === step.id;
  const isSaving = savingReminderStepId === step.id;
  const originalValue = reminder ? reminder.slice(0, 10) : "";
  const value = reminderDraftByStepId[step.id] ?? originalValue;

  return (
    <Stack spacing={0.45}>
      {isEditing ? (
        <TextField
          type="date"
          size="small"
          value={value}
          autoFocus
          disabled={isSaving}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onReminderDraftChange(step.id, event.target.value);
          }}
          onBlur={() => {
            void onSaveReminderEdit(step);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelReminderEdit(step);
              (event.target as HTMLInputElement).blur();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
          sx={{ maxWidth: 190, "& input": { fontSize: "0.78rem", padding: "4px 8px" } }}
        />
      ) : onUpdateStepReminderDate ? (
        <ButtonBase
          onClick={(event) => {
            event.stopPropagation();
            onStartReminderEdit(step);
          }}
          sx={{
            width: "fit-content",
            borderRadius: 999,
            px: 0.9,
            py: 0.45,
            textAlign: "left",
            backgroundColor: (theme) => theme.palette.status.active.soft,
            border: "1px solid",
            borderColor: (theme) => theme.palette.status.active.border,
            transition: (theme) =>
              theme.transitions.create(["background-color", "border-color", "color"], {
                duration: theme.appMotion.short,
              }),
            "&:hover .reminder-label": {
              textDecoration: "underline",
            },
            "&:hover": {
              backgroundColor: (theme) => theme.palette.status.active.container,
            },
          }}
        >
          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", minWidth: 0 }}>
            <EditCalendarRoundedIcon sx={{ fontSize: 14, color: reminder ? "primary.main" : "text.secondary" }} />
            <Typography className="reminder-label" variant="caption" color="text.secondary">
              Recordatorio
            </Typography>
            <Typography variant="caption" color={reminder ? "text.primary" : "text.secondary"}>
              {valueLabel}
            </Typography>
          </Stack>
        </ButtonBase>
      ) : (
        <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", minWidth: 0 }}>
          <EditCalendarRoundedIcon sx={{ fontSize: 14, color: reminder ? "primary.main" : "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">
            Recordatorio
          </Typography>
          <Typography variant="caption" color={reminder ? "text.primary" : "text.secondary"}>
            {valueLabel}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

type ReminderEditingStateProps = {
  editingReminderStepId: string | null;
  savingReminderStepId: string | null;
  reminderDraftByStepId: Record<string, string>;
  onReminderDraftChange: (stepId: string, value: string) => void;
  onStartReminderEdit: (step: Step) => void;
  onCancelReminderEdit: (step: Step) => void;
  onSaveReminderEdit: (step: Step) => Promise<void>;
};

function getStepStateColors(theme: Theme, status: Step["estado"]) {
  const token = getStatusToken(theme, getStatusTone(status));
  return {
    borderColor: token.border,
    backgroundColor: token.container,
    textColor: token.onContainer,
    lineColor: alpha(token.accent, 0.56),
    accent: token.accent,
  };
}

function canEditStepName(step: Step) {
  return ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado);
}

type StepNameEditorProps = {
  step: Step;
  onRenameStep?: (step: Step, nextName: string) => Promise<void>;
  onEditingChange?: (stepId: string, editing: boolean) => void;
  dense?: boolean;
};

function StepNameEditor({ step, onRenameStep, onEditingChange, dense = false }: StepNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(step.nombre);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allowInlineEdit = canEditStepName(step) && Boolean(onRenameStep);

  useEffect(() => {
    setEditing(false);
    setDraftName(step.nombre);
    setError(null);
    setSaving(false);
  }, [step.id, step.nombre]);

  useEffect(() => {
    onEditingChange?.(step.id, editing);
  }, [editing, onEditingChange, step.id]);

  function handleStartEditing(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!allowInlineEdit || saving) return;
    setDraftName(step.nombre);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const nextName = draftName.trim();
    if (!nextName) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (nextName === step.nombre) {
      setEditing(false);
      setError(null);
      return;
    }
    if (!onRenameStep) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onRenameStep(step, nextName);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saving) return;
    setEditing(false);
    setDraftName(step.nombre);
    setError(null);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSave();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }

  if (editing) {
    return (
      <Stack spacing={0.5} sx={{ mt: dense ? 0 : 1, flex: 1 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
          <TextField
            size="small"
            autoFocus
            fullWidth
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={handleInputKeyDown}
            error={Boolean(error)}
            disabled={saving}
            slotProps={{ htmlInput: { maxLength: 180 } }}
          />
          <IconButton
            size="small"
            color="primary"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleSave();
            }}
            disabled={saving}
            aria-label={`Guardar nombre de ${step.nombre}`}
          >
            <CheckRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="inherit"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCancel();
            }}
            disabled={saving}
            aria-label={`Cancelar edición de ${step.nombre}`}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        {error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        alignItems: "center",
        mt: dense ? 0 : 1,
        "& .step-name-edit-button": {
          opacity: 0,
          visibility: "hidden",
          transition: "opacity 160ms ease",
        },
        "&:hover .step-name-edit-button, &:focus-within .step-name-edit-button": {
          opacity: 1,
          visibility: "visible",
        },
      }}
    >
      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
        {step.nombre}
      </Typography>
      {allowInlineEdit ? (
        <IconButton
          className="step-name-edit-button"
          size="small"
          color="inherit"
          onClick={handleStartEditing}
          aria-label={`Editar nombre de ${step.nombre}`}
        >
          <EditRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ) : null}
    </Stack>
  );
}

function VerticalWorkflowGraph({
  steps,
  workflowClosed,
  selectedStepId,
  stepHasRecords,
  onOpenStep,
  onCompleteStepIntent,
  onRenameStep,
  onUpdateStepReminderDate,
  editingReminderStepId,
  savingReminderStepId,
  reminderDraftByStepId,
  onReminderDraftChange,
  onStartReminderEdit,
  onCancelReminderEdit,
  onSaveReminderEdit,
}: WorkflowGraphProps & ReminderEditingStateProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const [editingNameStepId, setEditingNameStepId] = useState<string | null>(null);
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);
  const handleStepNameEditingChange = useCallback((stepId: string, editing: boolean) => {
    setEditingNameStepId((current) => {
      if (editing) return stepId;
      if (current === stepId) return null;
      return current;
    });
  }, []);

  useEffect(() => {
    if (!viewportRef.current || !selectedCardRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const card = selectedCardRef.current;
    viewport.scrollTo({
      top: Math.max(0, card.offsetTop - 120),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <Box ref={viewportRef} sx={{ maxHeight: "72vh", overflow: "auto", pr: 0.5 }}>
      <Stack spacing={2}>
        {orderedSteps.length > 0 && (
          <Box
            aria-hidden="true"
            sx={{
              width: 2,
              height: 24,
              alignSelf: { xs: "center", md: "flex-start" },
              ml: { md: "59px" },
              borderRadius: 999,
              background: `linear-gradient(180deg, ${alpha(theme.palette.warning.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.3)})`,
            }}
          />
        )}

        <Stack spacing={1.5}>
          {orderedSteps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const stateColors = getStepStateColors(theme, step.estado);
            const isFirst = index === 0;
            const isLast = index === orderedSteps.length - 1;
            const canComplete = !workflowClosed && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado);
            const hasRecords =
              stepHasRecords?.[step.id] ??
              Boolean(step.ultimo_comentario_fecha || step.ultimo_comentario || step.resultado || step.observaciones);
            const isEditingName = editingNameStepId === step.id;
            const isInProgress = step.estado === "activo";
            return (
              <Box
                key={step.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "120px minmax(0, 1fr)" },
                  gap: 2,
                  alignItems: "stretch",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "relative",
                    py: { xs: 0.5, md: 0.75 },
                  }}
                >
                  {!isFirst && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: { xs: -22, md: -26 },
                        height: { xs: 24, md: 28 },
                        width: 2,
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${alpha(theme.palette.text.primary, 0.08)}, ${stateColors.lineColor})`,
                      }}
                    />
                  )}
                  {!isLast && (
                    <Box
                      sx={{
                        position: "absolute",
                        bottom: { xs: -22, md: -26 },
                        height: { xs: 24, md: 28 },
                        width: 2,
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${stateColors.lineColor}, ${alpha(theme.palette.text.primary, 0.08)})`,
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      position: "relative",
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      px: 1,
                      textAlign: "center",
                      border: "1.5px solid",
                      borderColor: stateColors.borderColor,
                      backgroundColor: stateColors.backgroundColor,
                      boxShadow: isSelected ? `0 0 0 3px ${alpha(stateColors.textColor, 0.12)}` : "none",
                      ...(isInProgress
                        ? {
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              inset: -3,
                              borderRadius: "50%",
                              pointerEvents: "none",
                              border: `1px solid ${alpha(stateColors.accent, 0.22)}`,
                            },
                          }
                        : {}),
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1, color: stateColors.textColor }}>
                      Tarea {step.orden}
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: stateColors.textColor }}>
                      {humanizeStatus(step.estado)}
                    </Typography>
                  </Box>
                </Box>

                <Card
                  ref={isSelected ? selectedCardRef : null}
                  variant="outlined"
                  sx={{
                    position: "relative",
                    borderColor: isSelected ? "primary.main" : "outlineVariant",
                    backgroundColor: isSelected ? "surfaceContainerLow" : "surfaceContainerLowest",
                    boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}` : theme.appElevation.surface,
                    borderRadius: 3,
                    transition: theme.transitions.create(["box-shadow", "border-color", "background-color"], {
                      duration: theme.appMotion.short,
                    }),
                    "&:hover .complete-step-button, &:focus-within .complete-step-button": {
                      opacity: 1,
                      visibility: "visible",
                    },
                  }}
                >
                  {canComplete && onCompleteStepIntent && !isEditingName ? (
                    <Button
                      className="complete-step-button"
                      size="small"
                      variant="contained"
                      onClick={(event: MouseEvent<HTMLButtonElement>) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onCompleteStepIntent(step.id);
                      }}
                      onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()}
                      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
                      aria-label={`Completar tarea ${step.nombre}`}
                      sx={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        opacity: 0,
                        visibility: "hidden",
                        transition: theme.transitions.create("opacity", {
                          duration: theme.appMotion.short,
                        }),
                        textTransform: "none",
                        zIndex: 1,
                      }}
                    >
                      Listo
                    </Button>
                  ) : null}
                  <Box sx={{ p: 1.5 }}>
                    <Stack spacing={0.95}>
                      <StepNameEditor
                        step={step}
                        onRenameStep={onRenameStep}
                        onEditingChange={handleStepNameEditingChange}
                      />

                      {renderStepTiming(step)}
                      <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.85 }}>
                        {renderStepReminder({
                          step,
                          editingReminderStepId,
                          savingReminderStepId,
                          reminderDraftByStepId,
                          onUpdateStepReminderDate,
                          onReminderDraftChange,
                          onStartReminderEdit,
                          onCancelReminderEdit,
                          onSaveReminderEdit,
                        })}
                        {renderStepRecordsIndicator(hasRecords, () => onOpenStep(step.id))}
                      </Stack>
                    </Stack>
                  </Box>
                </Card>
              </Box>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}

function GitLogWorkflowGraph({
  steps,
  selectedStepId,
  stepHasRecords,
  onOpenStep,
  onRenameStep,
  onUpdateStepReminderDate,
  editingReminderStepId,
  savingReminderStepId,
  reminderDraftByStepId,
  onReminderDraftChange,
  onStartReminderEdit,
  onCancelReminderEdit,
  onSaveReminderEdit,
}: WorkflowGraphProps & ReminderEditingStateProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);

  useEffect(() => {
    if (!viewportRef.current || !selectedRowRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const row = selectedRowRef.current;
    viewport.scrollTo({
      top: Math.max(0, row.offsetTop - 90),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <Box ref={viewportRef} sx={{ maxHeight: "72vh", overflow: "auto", pr: 0.5 }}>
      <Stack spacing={1.5}>
        {orderedSteps.map((step) => {
          const isSelected = selectedStepId === step.id;
          const hasRecords =
            stepHasRecords?.[step.id] ??
            Boolean(step.ultimo_comentario_fecha || step.ultimo_comentario || step.resultado || step.observaciones);
          return (
            <Card
              key={step.id}
              ref={isSelected ? selectedRowRef : null}
              variant="outlined"
              sx={{
                borderColor: isSelected ? "primary.main" : "outlineVariant",
                backgroundColor: isSelected ? "surfaceContainerLow" : "surfaceContainerLowest",
                boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}` : theme.appElevation.surface,
                borderRadius: 3,
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Stack spacing={0.9}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Chip label={`T${step.orden.toString().padStart(2, "0")}`} size="small" variant="outlined" />
                      <StepNameEditor step={step} onRenameStep={onRenameStep} dense />
                    </Stack>
                  </Stack>
                  {renderStepTiming(step)}
                  <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.85 }}>
                    {renderStepReminder({
                      step,
                      editingReminderStepId,
                      savingReminderStepId,
                      reminderDraftByStepId,
                      onUpdateStepReminderDate,
                      onReminderDraftChange,
                      onStartReminderEdit,
                      onCancelReminderEdit,
                      onSaveReminderEdit,
                    })}
                    {renderStepRecordsIndicator(hasRecords, () => onOpenStep(step.id))}
                  </Stack>
                </Stack>
              </Box>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
