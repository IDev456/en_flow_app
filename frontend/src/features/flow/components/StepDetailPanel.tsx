import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { flushSync } from "react-dom";
import { Link as RouterLink } from "react-router-dom";

import { updateStep, updateStepDate } from "../api";
import { ReminderDateField } from "./ReminderDateField";
import type {
  AttachmentInput,
  ExternalEventCreateInput,
  ExternalResponseDecisionInput,
  Step,
  StepComment,
  StepCompleteInput,
  StepHistoryEntry,
  StepJournalEntryInput,
  StepTransitionType,
} from "../types";
import {
  buildJournalItems,
  DEFAULT_ACTOR,
  formatCalendarDate,
  toCalendarDateInputValue,
  formatDateOnly,
  formatRelativeCalendarDay,
  getReminderDateError,
  getTodayLocalDateInput,
  openNativeDateInputPicker,
  toCalendarDateUtcIso,
} from "../utils";
import { AmbitoChip } from "./AmbitoChip";
import { Journal } from "./Journal";
import { StatusBadge } from "./StatusBadge";

type StepDetailPanelProps = {
  workflowId: string;
  step: Step | null;
  comments: StepComment[];
  history: StepHistoryEntry[];
  standalone?: boolean;
  drawer?: boolean;
  onClose?: () => void;
  error?: string | null;
  onSubmitJournal: (input: StepJournalEntryInput) => Promise<void>;
  onEditJournalComment?: (commentId: string, comentario: string | null) => Promise<void>;
  onCompleteTask: (stepId: string, input: StepCompleteInput) => Promise<void>;
  onStepUpdated?: (step: Step) => Promise<void> | void;
  onRegisterExternalEvent?: (input: ExternalEventCreateInput) => Promise<void>;
  onResolveExternalResponse?: (stepId: string, input: ExternalResponseDecisionInput) => Promise<void>;
  operationLocked?: boolean;
  operationLockMessage?: string | null;
  showStandaloneBack?: boolean;
  standaloneBackLabel?: string;
  onStandaloneBack?: () => void;
};

export function StepDetailPanel({
  workflowId,
  step,
  comments,
  history,
  standalone = false,
  drawer = false,
  onClose,
  error,
  onSubmitJournal,
  onEditJournalComment,
  onStepUpdated,
  onRegisterExternalEvent,
  onResolveExternalResponse,
  operationLocked = false,
  operationLockMessage = null,
  showStandaloneBack = true,
  standaloneBackLabel = "Volver al flow",
  onStandaloneBack,
}: StepDetailPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<"" | "espera" | "problema">("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [focusRequestToken, setFocusRequestToken] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [externalComment, setExternalComment] = useState("");
  const [externalSource, setExternalSource] = useState("manual");
  const [externalAttachments, setExternalAttachments] = useState<AttachmentInput[]>([]);
  const [registeringExternal, setRegisteringExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalAdvancedOpen, setExternalAdvancedOpen] = useState(false);

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveTransition, setResolveTransition] = useState<"next_task" | "finish_flow">("next_task");
  const [resolveResult, setResolveResult] = useState("");
  const [resolveNextTaskName, setResolveNextTaskName] = useState("");
  const [resolveNextTaskDescription, setResolveNextTaskDescription] = useState("");
  const [resolveNextTaskAssignee, setResolveNextTaskAssignee] = useState("");
  const [resolveNextTaskDueDate, setResolveNextTaskDueDate] = useState("");
  const [resolveFinishReason, setResolveFinishReason] = useState("");
  const [resolveAttachments, setResolveAttachments] = useState<AttachmentInput[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveAdvancedOpen, setResolveAdvancedOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(false);
  const [stepDraftName, setStepDraftName] = useState("");
  const [stepDraftDescription, setStepDraftDescription] = useState("");
  const [stepDraftExecutionDate, setStepDraftExecutionDate] = useState("");
  const [stepDraftReminderDate, setStepDraftReminderDate] = useState("");
  const [stepEditError, setStepEditError] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [stepToastOpen, setStepToastOpen] = useState(false);
  const [isReminderEditing, setIsReminderEditing] = useState(false);
  const [reminderDraft, setReminderDraft] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!step) {
      return;
    }
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);

    setExternalDialogOpen(false);
    setExternalComment("");
    setExternalSource("manual");
    setExternalAttachments([]);
    setExternalError(null);
    setExternalAdvancedOpen(false);

    setResolveDialogOpen(false);
    setResolveTransition("next_task");
    setResolveResult("");
    setResolveNextTaskName("");
    setResolveNextTaskDescription("");
    setResolveNextTaskAssignee("");
    setResolveNextTaskDueDate("");
    setResolveFinishReason("");
    setResolveAttachments([]);
    setResolveError(null);
    setResolveAdvancedOpen(false);
    setEditingStep(false);
    setStepDraftName(step.nombre);
    setStepDraftDescription(step.descripcion ?? "");
    setStepDraftExecutionDate(toCalendarDateInputValue(step.fecha_ejecucion_estimada));
    setStepDraftReminderDate(toCalendarDateInputValue(step.fecha_vencimiento));
    setIsReminderEditing(false);
    setReminderDraft(toCalendarDateInputValue(step.fecha_vencimiento));
    setSavingReminder(false);
    setStepEditError(null);
    setStepToastOpen(false);
  }, [step?.id, step?.estado, step?.expected_external_event, step?.external_reference, step?.external_wait_reason]);

  if (!step) {
    return (
      <Card
        sx={{
          ...(drawer ? { position: { lg: "sticky" }, top: { lg: 96 } } : {}),
          ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5">Sin tarea seleccionada</Typography>
            <Typography color="text.secondary">Seleccioná un paso para ver sus registros y recordatorios.</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const canChangeStatus = !operationLocked && ["activo", "espera", "problema"].includes(step.estado);
  const canAddManualRecords = !operationLocked && !["completado", "cancelada"].includes(step.estado);
  const isWaitingExternal = step.estado === "esperando_respuesta";
  const latestJournalItem = buildJournalItems(history, comments).find(
    (item) => item.body.trim().length > 0 || item.attachments.length > 0
  );
  const latestMessage =
    latestJournalItem?.secondaryText?.trim() ||
    latestJournalItem?.body.trim() ||
    step.ultimo_comentario?.trim() ||
    (step.orden === 1 && step.descripcion?.trim() ? step.descripcion.trim() : "Sin registros todavía");
  const displayStepName = stepDraftName.trim() || step.nombre;
  const displayStepDescription = stepDraftDescription.trim();
  const todayLocalDateInput = getTodayLocalDateInput();

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    if (operationLocked) {
      return;
    }
    await onSubmitJournal(input);
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
  }

  function handleStatusIntent(status: "" | "espera" | "problema") {
    if (operationLocked) return;
    setSelectedStatus(status);
    setComposerExpanded(true);
    setMenuAnchor(null);
    setFocusRequestToken((value) => value + 1);
  }

  async function readFileAsAttachment(file: File): Promise<AttachmentInput> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`El archivo "${file.name}" supera el limite de 5 MB`);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}"`));
      reader.readAsDataURL(file);
    });
    const [, contentBase64 = ""] = dataUrl.split(",", 2);
    return {
      nombre: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      content_base64: contentBase64,
    };
  }

  async function handleAttachmentSelection(files: FileList | null, target: "complete" | "external" | "resolve") {
    if (!files || files.length === 0) return;
    try {
      const parsed = await Promise.all(Array.from(files).map((file) => readFileAsAttachment(file)));
      if (target === "external") setExternalAttachments((current) => [...current, ...parsed]);
      if (target === "resolve") setResolveAttachments((current) => [...current, ...parsed]);
      setExternalError(null);
      setResolveError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron adjuntar archivos";
      if (target === "external") setExternalError(message);
      if (target === "resolve") setResolveError(message);
    }
  }

  async function handleRegisterExternalEvent() {
    if (operationLocked) {
      setExternalError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }
    if (!onRegisterExternalEvent) return;
    if (externalComment.trim().length < 3) {
      setExternalError("Debes indicar qué respuesta llegó.");
      return;
    }

    try {
      setRegisteringExternal(true);
      setExternalError(null);
      await onRegisterExternalEvent({
        event_type: "respuesta_externa_recibida",
        comentario: externalComment.trim() || null,
        source: externalSource.trim() || "manual",
        registrado_por: DEFAULT_ACTOR,
        attachments: externalAttachments,
      });
      setExternalDialogOpen(false);
      setResolveDialogOpen(true);
      setResolveResult(externalComment.trim() || "Respuesta externa recibida");
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : "No se pudo registrar la respuesta externa");
    } finally {
      setRegisteringExternal(false);
    }
  }

  async function handleResolveAfterExternal() {
    if (operationLocked) {
      setResolveError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }
    if (!onResolveExternalResponse) return;
    const currentStep = step;
    if (!currentStep) return;
    const resultTrimmed = resolveResult.trim();
    if (resultTrimmed.length < 3) {
      setResolveError("Debes indicar el resultado de cierre de la tarea.");
      return;
    }
    if (resolveTransition === "next_task" && !resolveNextTaskName.trim()) {
      setResolveError("Debes indicar el nombre de la próxima tarea.");
      return;
    }

    if (resolveTransition === "next_task") {
      const reminderError = getReminderDateError(resolveNextTaskDueDate);
      if (reminderError) {
        setResolveError(reminderError);
        return;
      }
    }

    try {
      setResolving(true);
      setResolveError(null);
      await onResolveExternalResponse(currentStep.id, {
        usuario: DEFAULT_ACTOR,
        resultado_cierre: resultTrimmed,
        comentario: resultTrimmed,
        transition_type: resolveTransition,
        next_task:
          resolveTransition === "next_task"
            ? {
                nombre: resolveNextTaskName.trim(),
                descripcion: resolveNextTaskDescription.trim() || null,
                asignado_a: resolveNextTaskAssignee.trim() || null,
                fecha_vencimiento: toCalendarDateUtcIso(resolveNextTaskDueDate),
              }
            : null,
        finish_data:
          resolveTransition === "finish_flow"
            ? {
                resultado_final: resultTrimmed,
                motivo_cierre: resolveFinishReason.trim() || null,
                attachments: resolveAttachments,
              }
            : null,
        attachments: resolveAttachments,
      });
      setResolveDialogOpen(false);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "No se pudo resolver la tarea en espera externa");
    } finally {
      setResolving(false);
    }
  }

  function handleStartStepEdit() {
    if (operationLocked) return;
    if (!step) return;
    setStepDraftName(step.nombre);
    setStepDraftDescription(step.descripcion ?? "");
    setStepDraftExecutionDate(toCalendarDateInputValue(step.fecha_ejecucion_estimada));
    setStepDraftReminderDate(toCalendarDateInputValue(step.fecha_vencimiento));
    setStepEditError(null);
    setEditingStep(true);
  }

  function handleCancelStepEdit() {
    if (!step) return;
    setStepDraftName(step.nombre);
    setStepDraftDescription(step.descripcion ?? "");
    setStepDraftExecutionDate(toCalendarDateInputValue(step.fecha_ejecucion_estimada));
    setStepDraftReminderDate(toCalendarDateInputValue(step.fecha_vencimiento));
    setStepEditError(null);
    setEditingStep(false);
  }

  async function handleSaveStepEdit() {
    if (!step) return;
    if (operationLocked) {
      setStepEditError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }

    const nextName = stepDraftName.trim();
    const nextDescription = stepDraftDescription.trim();
    const nextExecutionDate = toCalendarDateUtcIso(stepDraftExecutionDate);
    const nextReminderDate = toCalendarDateUtcIso(stepDraftReminderDate);
    const currentReminderInput = toCalendarDateInputValue(step.fecha_vencimiento);
    const hasMetadataChanges =
      nextName !== step.nombre ||
      nextDescription !== (step.descripcion ?? "") ||
      nextExecutionDate !== step.fecha_ejecucion_estimada;
    const hasReminderChanges = stepDraftReminderDate !== currentReminderInput;

    if (!nextName) {
      setStepEditError("Debes indicar el nombre de la tarea.");
      return;
    }
    const reminderError = getReminderDateError(stepDraftReminderDate, todayLocalDateInput);
    if (reminderError) {
      setStepEditError(reminderError);
      return;
    }

    if (!hasMetadataChanges && !hasReminderChanges) {
      setEditingStep(false);
      setStepEditError(null);
      return;
    }

    try {
      setSavingStep(true);
      setStepEditError(null);
      let updatedStep: Step = step;
      if (hasMetadataChanges) {
        updatedStep = await updateStep(step.id, {
          nombre: nextName,
          descripcion: nextDescription || null,
          fecha_ejecucion_estimada: nextExecutionDate,
        });
      }
      if (hasReminderChanges) {
        updatedStep = await updateStepDate(step.id, {
          fecha_vencimiento: nextReminderDate,
        });
      }
      setStepDraftName(updatedStep.nombre);
      setStepDraftDescription(updatedStep.descripcion ?? "");
      setStepDraftExecutionDate(toCalendarDateInputValue(updatedStep.fecha_ejecucion_estimada));
      setStepDraftReminderDate(toCalendarDateInputValue(updatedStep.fecha_vencimiento));
      await onStepUpdated?.(updatedStep);
      setEditingStep(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setSavingStep(false);
    }
  }

  function startReminderEdit() {
    if (operationLocked) return;
    if (!step) return;
    const currentValue = toCalendarDateInputValue(step.fecha_vencimiento);
    setReminderDraft(currentValue);
    setStepEditError(null);
    setIsReminderEditing(true);
  }

  function openReminderEditorAndPicker() {
    if (operationLocked || !step) return;
    flushSync(() => {
      startReminderEdit();
    });
    openNativeDateInputPicker(reminderInputRef.current);
  }

  function cancelReminderEdit() {
    if (!step) return;
    const currentValue = toCalendarDateInputValue(step.fecha_vencimiento);
    setReminderDraft(currentValue);
    setStepEditError(null);
    setIsReminderEditing(false);
  }

  async function saveReminderEdit() {
    if (!step) return;
    if (operationLocked) {
      setStepEditError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }
    const currentValue = toCalendarDateInputValue(step.fecha_vencimiento);
    const nextDraft = reminderDraft.trim();
    if (nextDraft === currentValue) {
      setIsReminderEditing(false);
      return;
    }
    const reminderError = getReminderDateError(nextDraft, todayLocalDateInput);
    if (reminderError) {
      setStepEditError(reminderError);
      return;
    }

    const nextReminderDate = toCalendarDateUtcIso(nextDraft);

    try {
      setSavingReminder(true);
      setStepEditError(null);
      const updatedStep = await updateStepDate(step.id, { fecha_vencimiento: nextReminderDate });
      setStepDraftReminderDate(toCalendarDateInputValue(updatedStep.fecha_vencimiento));
      setReminderDraft(toCalendarDateInputValue(updatedStep.fecha_vencimiento));
      await onStepUpdated?.(updatedStep);
      setIsReminderEditing(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setSavingReminder(false);
    }
  }

  async function handleReminderShortcutSelect(value: string) {
    if (!step) return;
    if (operationLocked) {
      setStepEditError(operationLockMessage ?? "El flow estÃ¡ en modo solo lectura.");
      return;
    }

    const currentValue = toCalendarDateInputValue(step.fecha_vencimiento);
    if (value === currentValue) {
      setReminderDraft(value);
      setIsReminderEditing(false);
      return;
    }

    const reminderError = getReminderDateError(value, todayLocalDateInput);
    if (reminderError) {
      setStepEditError(reminderError);
      return;
    }

    const nextReminderDate = toCalendarDateUtcIso(value);

    try {
      setSavingReminder(true);
      setStepEditError(null);
      const updatedStep = await updateStepDate(step.id, { fecha_vencimiento: nextReminderDate });
      setStepDraftReminderDate(toCalendarDateInputValue(updatedStep.fecha_vencimiento));
      setReminderDraft(toCalendarDateInputValue(updatedStep.fecha_vencimiento));
      await onStepUpdated?.(updatedStep);
      setIsReminderEditing(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setSavingReminder(false);
    }
  }

  return (
    <Card
      sx={{
        minWidth: 0,
        ...(drawer ? { position: { lg: "sticky" }, top: { lg: 96 } } : {}),
        ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Snackbar
        open={stepToastOpen}
        autoHideDuration={2600}
        onClose={() => setStepToastOpen(false)}
        message="Tarea actualizada."
      />
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: { xs: 2.75, md: 3.25 } }}>
          {drawer ? (
            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h6" sx={{ letterSpacing: "-0.01em" }}>Registro de la tarea</Typography>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    Recordatorio
                  </Typography>
                  {step.fecha_vencimiento && !isReminderEditing ? (
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={openReminderEditorAndPicker}
                      sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}
                    >
                      {formatCalendarDate(step.fecha_vencimiento)}
                    </Button>
                  ) : (
                    <IconButton
                      size="small"
                      color="inherit"
                      onClick={isReminderEditing ? () => void saveReminderEdit() : openReminderEditorAndPicker}
                      disabled={savingReminder || operationLocked}
                      aria-label={step.fecha_vencimiento ? "Editar recordatorio" : "Agregar recordatorio"}
                    >
                      <EditCalendarRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onClose ? (
                    <IconButton onClick={onClose} aria-label="Cerrar panel de registros">
                      <CloseRoundedIcon />
                    </IconButton>
                  ) : null}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="body2" color="text.secondary">
                  Ámbito
                </Typography>
                <AmbitoChip ambito={step.ambito} />
              </Stack>
              {isReminderEditing ? (
                <ReminderDateField
                  value={reminderDraft}
                  onChange={setReminderDraft}
                  onShortcutSelect={(value) => {
                    void handleReminderShortcutSelect(value);
                  }}
                  disabled={savingReminder || operationLocked}
                  autoFocus
                  inputRef={reminderInputRef}
                  compact
                  label=""
                  helperText={null}
                  minDate={todayLocalDateInput}
                  onBlur={() => {
                    void saveReminderEdit();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      cancelReminderEdit();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === "Enter") {
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  sx={{ maxWidth: 210 }}
                />
              ) : null}
              {operationLocked && operationLockMessage && <Alert severity="warning">{operationLockMessage}</Alert>}
              {stepEditError && <Alert severity="error">{stepEditError}</Alert>}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box>
                  <Typography variant="overline" color="primary.light">
                    Tarea {step.orden}
                  </Typography>
                  {editingStep ? (
                    <Stack spacing={1.25} sx={{ mt: 0.75, minWidth: { xs: "100%", sm: 360 } }}>
                      <TextField
                        label="Nombre de la tarea"
                        value={stepDraftName}
                        onChange={(event) => setStepDraftName(event.target.value)}
                        disabled={savingStep}
                        autoFocus
                      />
                      <TextField
                        label="Descripción"
                        multiline
                        minRows={2}
                        value={stepDraftDescription}
                        onChange={(event) => setStepDraftDescription(event.target.value)}
                        disabled={savingStep}
                      />
                      <TextField
                        label="Fecha"
                        type="date"
                        value={stepDraftExecutionDate}
                        onChange={(event) => setStepDraftExecutionDate(event.target.value)}
                        helperText="Posible fecha de ejecución"
                        slotProps={{ inputLabel: { shrink: true } }}
                        disabled={savingStep}
                      />
                      <ReminderDateField
                        value={stepDraftReminderDate}
                        onChange={setStepDraftReminderDate}
                        helperText="Fecha recordatorio"
                        disabled={savingStep}
                        minDate={todayLocalDateInput}
                        shortcutVariant="chips"
                      />
                    </Stack>
                  ) : (
                    <>
                      <Typography variant="h5" sx={{ mt: 0.25 }}>
                        {displayStepName}
                      </Typography>
                      {displayStepDescription && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                          {displayStepDescription}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {editingStep ? (
                    <>
                      <Button variant="text" color="inherit" onClick={handleCancelStepEdit} disabled={savingStep}>
                        Cancelar
                      </Button>
                      <Button variant="contained" onClick={() => void handleSaveStepEdit()} disabled={savingStep}>
                        {savingStep ? "Guardando..." : "Guardar"}
                      </Button>
                    </>
                  ) : !operationLocked ? (
                    <Button variant="text" color="inherit" onClick={handleStartStepEdit}>
                      Editar
                    </Button>
                  ) : null}
                  {!operationLocked && isWaitingExternal && onRegisterExternalEvent && (
                    <Button variant="contained" color="info" onClick={() => setExternalDialogOpen(true)} sx={{ textTransform: "none" }}>
                      Registrar respuesta recibida
                    </Button>
                  )}
                  {canChangeStatus && (
                    <>
                      <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} aria-label="Cambiar estado">
                        <MoreHorizRoundedIcon />
                      </IconButton>
                      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                        <MenuItem onClick={() => handleStatusIntent("espera")}>Pausar tarea</MenuItem>
                        <MenuItem onClick={() => handleStatusIntent("problema")}>Registrar problema</MenuItem>
                      </Menu>
                    </>
                  )}
                </Stack>
              </Stack>

              {stepEditError && <Alert severity="error">{stepEditError}</Alert>}
              {operationLocked && operationLockMessage && <Alert severity="warning">{operationLockMessage}</Alert>}

              {isReminderEditing ? (
              <Card variant="outlined" sx={{ display: isReminderEditing ? undefined : "none" }}>
                <CardContent sx={{ p: 1.75 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Estado operativo
                    </Typography>
                    <StatusBadge value={step.estado} />
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Último registro
                      </Typography>
                      <Typography variant="body2" color={latestMessage === "Sin registros todavía" ? "text.secondary" : "text.primary"}>
                        {latestMessage}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Fecha operativa
                      </Typography>
                      <Typography variant="body2" color={step.fecha_ejecucion_estimada ? "text.primary" : "text.secondary"}>
                        {step.fecha_ejecucion_estimada ? formatDateOnly(step.fecha_ejecucion_estimada) : "Sin fecha definida"}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Recordatorio
                      </Typography>
                      <Typography variant="body2" color={step.fecha_vencimiento ? "text.primary" : "text.secondary"}>
                        {step.fecha_vencimiento
                          ? `${formatRelativeCalendarDay(step.fecha_vencimiento) ?? formatCalendarDate(step.fecha_vencimiento)} · ${formatCalendarDate(step.fecha_vencimiento)}`
                          : "Sin recordatorio"}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
              ) : null}

              {isWaitingExternal ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1.75 }}>
                    <Stack spacing={1}>
                      <Alert severity="info">Esperando respuesta externa</Alert>
                      {step.expected_external_event && (
                        <Typography variant="body2" color="text.secondary">
                          Qué se espera: {step.expected_external_event}
                        </Typography>
                      )}
                      {step.external_wait_reason && (
                        <Typography variant="body2" color="text.secondary">
                          Detalle: {step.external_wait_reason}
                        </Typography>
                      )}
                      {step.external_reference && (
                        <Typography variant="body2" color="text.secondary">
                          Referencia: {step.external_reference}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ) : (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1.75 }}>
                    <Stack spacing={0.9}>
                      <Typography variant="subtitle2" color="text.secondary">
                        ¿Qué sigue?
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Al cerrar esta tarea vas a decidir cómo continúa el flow.
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Box>

        {!drawer && <Divider />}

        <Box sx={{ p: { xs: 2.75, md: 3.25 } }}>
          {!drawer && (
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Registro de la tarea
            </Typography>
          )}
          <Journal
            step={step}
            comments={comments}
            history={history}
            canChangeStatus={!drawer && canChangeStatus}
            showComposer={canAddManualRecords}
            canEditEntries={canAddManualRecords}
            selectedStatus={selectedStatus}
            onSelectedStatusChange={setSelectedStatus}
            composerExpanded={composerExpanded}
            onComposerExpandedChange={setComposerExpanded}
            focusRequestToken={focusRequestToken}
            onSubmitEntry={handleSubmitJournal}
            onEditEntry={
              onEditJournalComment
                ? async (commentId, comentario) => {
                    await onEditJournalComment(commentId, comentario);
                  }
                : undefined
            }
          />
        </Box>

        {error && (
          <>
            <Divider />
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          </>
        )}

        {standalone && showStandaloneBack && (
          <>
            <Divider />
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2.25 }}>
              {onStandaloneBack ? (
                <Button onClick={onStandaloneBack} variant="text" color="inherit">
                  {standaloneBackLabel}
                </Button>
              ) : (
                <Button component={RouterLink} to={`/workflows/${workflowId}`} variant="text" color="inherit">
                  {standaloneBackLabel}
                </Button>
              )}
            </Box>
          </>
        )}
      </CardContent>

      <Dialog open={externalDialogOpen} onClose={registeringExternal ? undefined : () => setExternalDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar respuesta recibida</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="¿Qué respuesta llegó? *" multiline minRows={3} value={externalComment} onChange={(event) => setExternalComment(event.target.value)} disabled={registeringExternal} />
            <Button variant="text" color="inherit" onClick={() => setExternalAdvancedOpen((value) => !value)}>
              {externalAdvancedOpen ? "Ocultar opciones avanzadas" : "Más detalle (opcional)"}
            </Button>
            <Collapse in={externalAdvancedOpen}>
              <Stack spacing={1.5}>
                <TextField label="Origen" value={externalSource} onChange={(event) => setExternalSource(event.target.value)} disabled={registeringExternal} />
                <Button component="label" variant="outlined" color="inherit" disabled={registeringExternal}>
                  Adjuntar archivos (opcional)
                  <input hidden multiple type="file" onChange={(event) => void handleAttachmentSelection(event.target.files, "external")} />
                </Button>
                {externalAttachments.length > 0 && (
                  <Stack spacing={0.5}>
                    {externalAttachments.map((item, index) => (
                      <Typography key={`${item.nombre}-${index}`} variant="body2" color="text.secondary">
                        {item.nombre} ({Math.round(item.size_bytes / 1024)} KB)
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Collapse>
            {externalError && <Alert severity="error">{externalError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExternalDialogOpen(false)} disabled={registeringExternal} color="inherit">
            Cancelar
          </Button>
          <Button onClick={() => void handleRegisterExternalEvent()} disabled={registeringExternal} variant="contained">
            {registeringExternal ? "Registrando..." : "Registrar respuesta"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resolveDialogOpen} onClose={resolving ? undefined : () => setResolveDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>¿Qué sigue ahora?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Resultado de la tarea *"
              multiline
              minRows={3}
              value={resolveResult}
              onChange={(event) => setResolveResult(event.target.value)}
            />
            <ToggleButtonGroup
              exclusive
              value={resolveTransition}
              onChange={(_, value: "next_task" | "finish_flow" | null) => {
                if (!value) return;
                setResolveTransition(value);
                setResolveAdvancedOpen(false);
              }}
              fullWidth
            >
              <ToggleButton value="next_task">Crear próxima tarea</ToggleButton>
              <ToggleButton value="finish_flow">Finalizar flow</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary">
              {resolveTransition === "next_task" && "Hay algo más para hacer."}
              {resolveTransition === "finish_flow" && "El tema ya quedo resuelto."}
            </Typography>

            {resolveTransition === "next_task" && (
              <Stack spacing={1.5}>
                <TextField label="Nombre de la próxima tarea *" value={resolveNextTaskName} onChange={(event) => setResolveNextTaskName(event.target.value)} />
              </Stack>
            )}

            <Button variant="text" color="inherit" onClick={() => setResolveAdvancedOpen((value) => !value)}>
              {resolveAdvancedOpen ? "Ocultar opciones avanzadas" : "Más detalle (opcional)"}
            </Button>

            <Collapse in={resolveAdvancedOpen}>
              <Stack spacing={1.5}>
                {resolveTransition === "next_task" && (
                  <>
                    <TextField label="Detalle / contexto" multiline minRows={2} value={resolveNextTaskDescription} onChange={(event) => setResolveNextTaskDescription(event.target.value)} />
                    <TextField label="Asignado a" value={resolveNextTaskAssignee} onChange={(event) => setResolveNextTaskAssignee(event.target.value)} />
                    <ReminderDateField
                      value={resolveNextTaskDueDate}
                      onChange={setResolveNextTaskDueDate}
                      helperText="Fecha recordatorio"
                      disabled={resolving}
                      minDate={todayLocalDateInput}
                      shortcutVariant="chips"
                    />
                  </>
                )}

                {resolveTransition === "finish_flow" && (
                  <TextField label="Motivo de cierre" multiline minRows={2} value={resolveFinishReason} onChange={(event) => setResolveFinishReason(event.target.value)} />
                )}

                <Button component="label" variant="outlined" color="inherit" disabled={resolving}>
                  Adjuntar archivos (opcional)
                  <input hidden multiple type="file" onChange={(event) => void handleAttachmentSelection(event.target.files, "resolve")} />
                </Button>
                {resolveAttachments.length > 0 && (
                  <Stack spacing={0.5}>
                    {resolveAttachments.map((item, index) => (
                      <Typography key={`${item.nombre}-${index}`} variant="body2" color="text.secondary">
                        {item.nombre} ({Math.round(item.size_bytes / 1024)} KB)
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Collapse>
            {resolveError && <Alert severity="error">{resolveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)} disabled={resolving} color="inherit">
            Cancelar
          </Button>
          <Button onClick={() => void handleResolveAfterExternal()} disabled={resolving} variant="contained">
            {resolving ? "Guardando..." : "Guardar decision"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
