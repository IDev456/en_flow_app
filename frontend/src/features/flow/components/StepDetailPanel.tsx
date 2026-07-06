import type { ClipboardEvent } from "react";
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

import { updateStep, updateStepWaitingReminder } from "../api";
import { AttachmentDraftGrid } from "./AttachmentDraftGrid";
import { ReminderDateField } from "./ReminderDateField";
import type {
  ExternalEventCreateInput,
  ExternalResponseDecisionInput,
  Step,
  StepComment,
  StepCommentUpdateInput,
  StepCompleteInput,
  StepHistoryEntry,
  StepJournalEntryInput,
  StepTransitionType,
  WorkflowStatus,
} from "../types";
import {
  buildJournalItems,
  DEFAULT_ACTOR,
  formatCalendarDate,
  toCalendarDateInputValue,
  formatDateOnly,
  formatElapsedTime,
  getTodayLocalDateInput,
  isPastCalendarDateInput,
  isWaitingStepStatus,
  openNativeDateInputPicker,
  toCalendarDateUtcIso,
} from "../utils";
import {
  extractImageFilesFromClipboardData,
  readFilesAsLocalAttachments,
  type LocalAttachmentDraft,
} from "../utils/attachments";
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
  onEditJournalComment?: (commentId: string, input: StepCommentUpdateInput) => Promise<void>;
  onCompleteTask: (stepId: string, input: StepCompleteInput) => Promise<void>;
  onStepUpdated?: (step: Step) => Promise<void> | void;
  onRegisterExternalEvent?: (input: ExternalEventCreateInput) => Promise<void>;
  onResolveExternalResponse?: (stepId: string, input: ExternalResponseDecisionInput) => Promise<void>;
  workflowStatus?: WorkflowStatus | null;
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
  workflowStatus = null,
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
  const [externalAttachments, setExternalAttachments] = useState<LocalAttachmentDraft[]>([]);
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
  const [resolveAttachments, setResolveAttachments] = useState<LocalAttachmentDraft[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveAdvancedOpen, setResolveAdvancedOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(false);
  const [stepDraftName, setStepDraftName] = useState("");
  const [stepDraftDescription, setStepDraftDescription] = useState("");
  const [stepDraftExecutionDate, setStepDraftExecutionDate] = useState("");
  const [stepDraftWaitingWhat, setStepDraftWaitingWhat] = useState("");
  const [stepDraftWaitingFrom, setStepDraftWaitingFrom] = useState("");
  const [stepDraftWaitingReference, setStepDraftWaitingReference] = useState("");
  const [stepEditError, setStepEditError] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [stepToastOpen, setStepToastOpen] = useState(false);
  const [isExecutionDateEditing, setIsExecutionDateEditing] = useState(false);
  const [executionDateDraft, setExecutionDateDraft] = useState("");
  const [savingExecutionDate, setSavingExecutionDate] = useState(false);
  const executionDateInputRef = useRef<HTMLInputElement | null>(null);
  const [isWaitingReminderEditing, setIsWaitingReminderEditing] = useState(false);
  const [waitingReminderDraft, setWaitingReminderDraft] = useState("");
  const [savingWaitingReminder, setSavingWaitingReminder] = useState(false);

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
    setStepDraftWaitingWhat(step.expected_external_event ?? "");
    setStepDraftWaitingFrom(step.esperando_de ?? "");
    setStepDraftWaitingReference(step.external_reference ?? "");
    setIsExecutionDateEditing(false);
    setExecutionDateDraft(toCalendarDateInputValue(step.fecha_ejecucion_estimada));
    setSavingExecutionDate(false);
    setIsWaitingReminderEditing(false);
    setWaitingReminderDraft(toCalendarDateInputValue(step.fecha_recordatorio_espera));
    setSavingWaitingReminder(false);
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
            <Typography color="text.secondary">Seleccioná un paso para ver sus registros y fechas operativas.</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const canChangeStatus = !operationLocked && ["activo", "espera", "problema"].includes(step.estado);
  const canAddManualRecords = !operationLocked && !["completado", "cancelada"].includes(step.estado);
  const canEditLastComment =
    !operationLocked &&
    workflowStatus !== null &&
    !["finalizado", "cancelado"].includes(workflowStatus) &&
    Boolean(onEditJournalComment);
  const isWaitingExternal = step.estado === "esperando_respuesta";
  const isWaitingStep = isWaitingStepStatus(step.estado);
  const showWaitingReminder = isWaitingStep || Boolean(step.fecha_recordatorio_espera);
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
  const waitingReminderCurrentValue = toCalendarDateInputValue(step.fecha_recordatorio_espera);

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

  async function handleAttachmentSelection(files: FileList | null, target: "external" | "resolve") {
    if (!files || files.length === 0) return;
    try {
      const parsed = await readFilesAsLocalAttachments(Array.from(files));
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

  function handleRemoveAttachment(target: "external" | "resolve", localId: string) {
    if (target === "external") {
      setExternalAttachments((current) => current.filter((item) => item.local_id !== localId));
      return;
    }
    setResolveAttachments((current) => current.filter((item) => item.local_id !== localId));
  }

  async function handlePasteAttachments(event: ClipboardEvent<HTMLDivElement>, target: "external" | "resolve") {
    const imageFiles = extractImageFilesFromClipboardData(event.clipboardData);
    if (imageFiles.length === 0) {
      return;
    }
    event.preventDefault();
    if (target === "external") {
      setExternalAdvancedOpen(true);
    } else {
      setResolveAdvancedOpen(true);
    }
    try {
      const parsed = await readFilesAsLocalAttachments(imageFiles);
      if (target === "external") {
        setExternalAttachments((current) => [...current, ...parsed]);
        setExternalError(null);
      } else {
        setResolveAttachments((current) => [...current, ...parsed]);
        setResolveError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron adjuntar archivos";
      if (target === "external") {
        setExternalError(message);
      } else {
        setResolveError(message);
      }
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
        attachments: externalAttachments.map((item) => ({
          nombre: item.nombre,
          content_type: item.content_type,
          size_bytes: item.size_bytes,
          content_base64: item.content_base64,
        })),
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

    if (resolveTransition === "next_task" && isPastCalendarDateInput(resolveNextTaskDueDate, todayLocalDateInput)) {
      setResolveError("La fecha de ejecucion no puede ser una fecha pasada.");
      return;
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
                fecha_ejecucion_estimada: toCalendarDateUtcIso(resolveNextTaskDueDate),
              }
            : null,
        finish_data:
          resolveTransition === "finish_flow"
            ? {
                resultado_final: resultTrimmed,
                motivo_cierre: resolveFinishReason.trim() || null,
                attachments: resolveAttachments.map((item) => ({
                  nombre: item.nombre,
                  content_type: item.content_type,
                  size_bytes: item.size_bytes,
                  content_base64: item.content_base64,
                })),
              }
            : null,
        attachments: resolveAttachments.map((item) => ({
          nombre: item.nombre,
          content_type: item.content_type,
          size_bytes: item.size_bytes,
          content_base64: item.content_base64,
        })),
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
    setStepDraftWaitingWhat(step.expected_external_event ?? "");
    setStepDraftWaitingFrom(step.esperando_de ?? "");
    setStepDraftWaitingReference(step.external_reference ?? "");
    setStepEditError(null);
    setEditingStep(true);
  }

  function handleCancelStepEdit() {
    if (!step) return;
    setStepDraftName(step.nombre);
    setStepDraftDescription(step.descripcion ?? "");
    setStepDraftExecutionDate(toCalendarDateInputValue(step.fecha_ejecucion_estimada));
    setStepDraftWaitingWhat(step.expected_external_event ?? "");
    setStepDraftWaitingFrom(step.esperando_de ?? "");
    setStepDraftWaitingReference(step.external_reference ?? "");
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
    const nextExecutionDate = isWaitingExternal ? step.fecha_ejecucion_estimada : toCalendarDateUtcIso(stepDraftExecutionDate);
    const nextWaitingWhat = stepDraftWaitingWhat.trim();
    const nextWaitingFrom = stepDraftWaitingFrom.trim();
    const nextWaitingReference = stepDraftWaitingReference.trim();
    const hasMetadataChanges =
      nextName !== step.nombre ||
      nextDescription !== (step.descripcion ?? "") ||
      (!isWaitingExternal && nextExecutionDate !== step.fecha_ejecucion_estimada) ||
      nextWaitingWhat !== (step.expected_external_event ?? "") ||
      nextWaitingFrom !== (step.esperando_de ?? "") ||
      nextWaitingReference !== (step.external_reference ?? "");

    if (!nextName) {
      setStepEditError("Debes indicar el nombre de la tarea.");
      return;
    }
    if (!hasMetadataChanges) {
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
          fecha_ejecucion_estimada: isWaitingExternal ? undefined : nextExecutionDate,
          expected_external_event: isWaitingExternal ? nextWaitingWhat || null : undefined,
          esperando_de: isWaitingExternal ? nextWaitingFrom || null : undefined,
          external_reference: isWaitingExternal ? nextWaitingReference || null : undefined,
          external_wait_reason: isWaitingExternal ? (nextDescription || null) : undefined,
        });
      }
      setStepDraftName(updatedStep.nombre);
      setStepDraftDescription(updatedStep.descripcion ?? "");
      setStepDraftExecutionDate(toCalendarDateInputValue(updatedStep.fecha_ejecucion_estimada));
      setStepDraftWaitingWhat(updatedStep.expected_external_event ?? "");
      setStepDraftWaitingFrom(updatedStep.esperando_de ?? "");
      setStepDraftWaitingReference(updatedStep.external_reference ?? "");
      await onStepUpdated?.(updatedStep);
      setEditingStep(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setSavingStep(false);
    }
  }

  function startExecutionDateEdit() {
    if (operationLocked) return;
    if (!step) return;
    const currentValue = toCalendarDateInputValue(step.fecha_ejecucion_estimada);
    setExecutionDateDraft(currentValue);
    setStepEditError(null);
    setIsExecutionDateEditing(true);
  }

  function openExecutionDateEditorAndPicker() {
    if (operationLocked || !step) return;
    flushSync(() => {
      startExecutionDateEdit();
    });
    openNativeDateInputPicker(executionDateInputRef.current);
  }

  function cancelExecutionDateEdit() {
    if (!step) return;
    const currentValue = toCalendarDateInputValue(step.fecha_ejecucion_estimada);
    setExecutionDateDraft(currentValue);
    setStepEditError(null);
    setIsExecutionDateEditing(false);
  }

  async function saveExecutionDateEdit() {
    if (!step) return;
    if (operationLocked) {
      setStepEditError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }
    const currentValue = toCalendarDateInputValue(step.fecha_ejecucion_estimada);
    const nextDraft = executionDateDraft.trim();
    if (nextDraft === currentValue) {
      setIsExecutionDateEditing(false);
      return;
    }
    if (isPastCalendarDateInput(nextDraft, todayLocalDateInput)) {
      setStepEditError("La fecha de ejecucion no puede ser una fecha pasada.");
      return;
    }

    const nextExecutionDate = toCalendarDateUtcIso(nextDraft);

    try {
      setSavingExecutionDate(true);
      setStepEditError(null);
      const updatedStep = await updateStep(step.id, { fecha_ejecucion_estimada: nextExecutionDate });
      setStepDraftExecutionDate(toCalendarDateInputValue(updatedStep.fecha_ejecucion_estimada));
      setExecutionDateDraft(toCalendarDateInputValue(updatedStep.fecha_ejecucion_estimada));
      await onStepUpdated?.(updatedStep);
      setIsExecutionDateEditing(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setSavingExecutionDate(false);
    }
  }

  function startWaitingReminderEdit() {
    if (operationLocked || !step || !isWaitingStep) return;
    setWaitingReminderDraft(waitingReminderCurrentValue);
    setStepEditError(null);
    setIsWaitingReminderEditing(true);
  }

  function cancelWaitingReminderEdit() {
    setWaitingReminderDraft(waitingReminderCurrentValue);
    setStepEditError(null);
    setIsWaitingReminderEditing(false);
  }

  async function saveWaitingReminderEdit() {
    if (!step) return;
    if (operationLocked) {
      setStepEditError(operationLockMessage ?? "El flow está en modo solo lectura.");
      return;
    }
    if (!isWaitingStep) {
      setStepEditError("Solo puedes editar el recordatorio en tareas en espera.");
      return;
    }
    if (waitingReminderDraft === waitingReminderCurrentValue) {
      setIsWaitingReminderEditing(false);
      return;
    }
    if (isPastCalendarDateInput(waitingReminderDraft, todayLocalDateInput)) {
      setStepEditError("El recordatorio no puede ser una fecha pasada.");
      return;
    }

    try {
      setSavingWaitingReminder(true);
      setStepEditError(null);
      const updatedStep = await updateStepWaitingReminder(step.id, {
        fecha_recordatorio_espera: toCalendarDateUtcIso(waitingReminderDraft),
        usuario: DEFAULT_ACTOR,
      });
      setWaitingReminderDraft(toCalendarDateInputValue(updatedStep.fecha_recordatorio_espera));
      await onStepUpdated?.(updatedStep);
      setIsWaitingReminderEditing(false);
      setStepToastOpen(true);
    } catch (err) {
      setStepEditError(err instanceof Error ? err.message : "No se pudo actualizar el recordatorio de espera");
    } finally {
      setSavingWaitingReminder(false);
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
                  {!isWaitingExternal ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Fecha de ejecucion
                      </Typography>
                      {step.fecha_ejecucion_estimada && !isExecutionDateEditing ? (
                        <Button
                          variant="text"
                          color="inherit"
                          size="small"
                          onClick={openExecutionDateEditorAndPicker}
                          sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}
                        >
                          {formatCalendarDate(step.fecha_ejecucion_estimada)}
                        </Button>
                      ) : (
                        <IconButton
                          size="small"
                          color="inherit"
                          onClick={isExecutionDateEditing ? () => void saveExecutionDateEdit() : openExecutionDateEditorAndPicker}
                          disabled={savingExecutionDate || operationLocked}
                          aria-label={step.fecha_ejecucion_estimada ? "Editar fecha de ejecucion" : "Agregar fecha de ejecucion"}
                        >
                          <EditCalendarRoundedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  ) : null}
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
              {isExecutionDateEditing && !isWaitingExternal ? (
                <TextField
                  value={executionDateDraft}
                  onChange={(event) => setExecutionDateDraft(event.target.value)}
                  disabled={savingExecutionDate || operationLocked}
                  autoFocus
                  inputRef={executionDateInputRef}
                  type="date"
                  label=""
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  onBlur={() => {
                    void saveExecutionDateEdit();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      cancelExecutionDateEdit();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === "Enter") {
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  sx={{ maxWidth: 210 }}
                />
              ) : null}
              {showWaitingReminder ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Recordatorio de espera
                        </Typography>
                        {isWaitingStep && !isWaitingReminderEditing ? (
                          <Button
                            variant="text"
                            color="inherit"
                            size="small"
                            onClick={startWaitingReminderEdit}
                            disabled={savingWaitingReminder || operationLocked}
                          >
                            {step.fecha_recordatorio_espera ? "Editar" : "Agregar"}
                          </Button>
                        ) : null}
                      </Stack>
                      {isWaitingReminderEditing ? (
                        <Stack spacing={1}>
                          <ReminderDateField
                            value={waitingReminderDraft}
                            onChange={(value) => {
                              setWaitingReminderDraft(value);
                              setStepEditError(null);
                            }}
                            label="Recordatorio de espera"
                            helperText="Opcional. Fecha para revisar o retomar esta espera."
                            disabled={savingWaitingReminder || operationLocked}
                            compact
                          />
                          <Stack direction="row" spacing={1}>
                            <Button variant="text" color="inherit" onClick={cancelWaitingReminderEdit} disabled={savingWaitingReminder}>
                              Cancelar
                            </Button>
                            <Button variant="contained" onClick={() => void saveWaitingReminderEdit()} disabled={savingWaitingReminder}>
                              {savingWaitingReminder ? "Guardando..." : "Guardar"}
                            </Button>
                          </Stack>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color={step.fecha_recordatorio_espera ? "text.primary" : "text.secondary"}>
                          {step.fecha_recordatorio_espera ? formatCalendarDate(step.fecha_recordatorio_espera) : "Sin fecha definida"}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
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
                      {!isWaitingExternal ? (
                      <TextField
                        label="Fecha"
                        type="date"
                        value={stepDraftExecutionDate}
                        onChange={(event) => setStepDraftExecutionDate(event.target.value)}
                        helperText="Posible fecha de ejecución"
                        slotProps={{ inputLabel: { shrink: true } }}
                        disabled={savingStep}
                      />
                      ) : null}
                      {isWaitingExternal ? (
                        <>
                          <TextField
                            label="Que se espera"
                            value={stepDraftWaitingWhat}
                            onChange={(event) => setStepDraftWaitingWhat(event.target.value)}
                            disabled={savingStep}
                          />
                          <TextField
                            label="De quien"
                            value={stepDraftWaitingFrom}
                            onChange={(event) => setStepDraftWaitingFrom(event.target.value)}
                            disabled={savingStep}
                          />
                          <TextField
                            label="Referencia"
                            value={stepDraftWaitingReference}
                            onChange={(event) => setStepDraftWaitingReference(event.target.value)}
                            disabled={savingStep}
                          />
                        </>
                      ) : null}
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

              {isExecutionDateEditing ? (
              <Card variant="outlined" sx={{ display: isExecutionDateEditing ? undefined : "none" }}>
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
                    {isWaitingStep ? (
                      <Stack spacing={0.25}>
                        <Typography variant="body2" color="text.secondary">
                          En espera desde
                        </Typography>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 500, color: "text.primary", lineHeight: 1.25 }}>
                          {formatElapsedTime(step.fecha_estado_actual) ?? "En espera"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCalendarDate(step.fecha_estado_actual)}
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Fecha operativa
                        </Typography>
                        <Typography variant="body2" color={step.fecha_ejecucion_estimada ? "text.primary" : "text.secondary"}>
                          {step.fecha_ejecucion_estimada ? formatDateOnly(step.fecha_ejecucion_estimada) : "Sin fecha definida"}
                        </Typography>
                      </Stack>
                    )}
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Fecha de ejecucion
                      </Typography>
                      <Typography variant="body2" color={step.fecha_ejecucion_estimada ? "text.primary" : "text.secondary"}>
                        {step.fecha_ejecucion_estimada ? formatCalendarDate(step.fecha_ejecucion_estimada) : "Sin fecha definida"}
                      </Typography>
                    </Stack>
                    {showWaitingReminder ? (
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Recordatorio de espera
                        </Typography>
                        <Typography variant="body2" color={step.fecha_recordatorio_espera ? "text.primary" : "text.secondary"}>
                          {step.fecha_recordatorio_espera ? formatCalendarDate(step.fecha_recordatorio_espera) : "Sin fecha definida"}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
              ) : null}

              {isWaitingStep ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1.75 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Alert severity="info" sx={{ flex: 1 }}>
                          {isWaitingExternal ? "Esperando respuesta externa" : "Tarea en espera"}
                        </Alert>
                        {isWaitingStep && !isWaitingReminderEditing ? (
                          <Button variant="text" color="inherit" onClick={startWaitingReminderEdit} disabled={savingWaitingReminder || operationLocked}>
                            {step.fecha_recordatorio_espera ? "Editar recordatorio" : "Agregar recordatorio"}
                          </Button>
                        ) : null}
                      </Stack>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" color="text.secondary">
                          En espera desde
                        </Typography>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 500, color: "text.primary", lineHeight: 1.25 }}>
                          {formatElapsedTime(step.fecha_estado_actual) ?? "En espera"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCalendarDate(step.fecha_estado_actual)}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.35}>
                        <Typography variant="body2" color="text.secondary">
                          Recordatorio de espera
                        </Typography>
                        {isWaitingReminderEditing ? (
                          <Stack spacing={1}>
                            <ReminderDateField
                              value={waitingReminderDraft}
                              onChange={(value) => {
                                setWaitingReminderDraft(value);
                                setStepEditError(null);
                              }}
                              label="Recordatorio de espera"
                              helperText="Opcional. Fecha para revisar o retomar esta espera."
                              disabled={savingWaitingReminder || operationLocked}
                              compact
                            />
                            <Stack direction="row" spacing={1}>
                              <Button variant="text" color="inherit" onClick={cancelWaitingReminderEdit} disabled={savingWaitingReminder}>
                                Cancelar
                              </Button>
                              <Button variant="contained" onClick={() => void saveWaitingReminderEdit()} disabled={savingWaitingReminder}>
                                {savingWaitingReminder ? "Guardando..." : "Guardar"}
                              </Button>
                            </Stack>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color={step.fecha_recordatorio_espera ? "text.primary" : "text.secondary"}>
                            {step.fecha_recordatorio_espera ? formatCalendarDate(step.fecha_recordatorio_espera) : "Sin fecha definida"}
                          </Typography>
                        )}
                      </Stack>
                      {step.expected_external_event && (
                        <Typography variant="body2" color="text.secondary">
                          Qué se espera: {step.expected_external_event}
                        </Typography>
                      )}
                      {step.esperando_de && (
                        <Typography variant="body2" color="text.secondary">
                          De quien: {step.esperando_de}
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
            canEditEntries={canEditLastComment}
            selectedStatus={selectedStatus}
            onSelectedStatusChange={setSelectedStatus}
            composerExpanded={composerExpanded}
            onComposerExpandedChange={setComposerExpanded}
            focusRequestToken={focusRequestToken}
            onSubmitEntry={handleSubmitJournal}
            onEditEntry={
              onEditJournalComment
                ? async (commentId, input) => {
                    await onEditJournalComment(commentId, input);
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
            <TextField
              label="¿Qué respuesta llegó? *"
              multiline
              minRows={3}
              value={externalComment}
              onChange={(event) => setExternalComment(event.target.value)}
              onPaste={(event) => void handlePasteAttachments(event, "external")}
              disabled={registeringExternal}
            />
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
                <AttachmentDraftGrid attachments={externalAttachments} onRemove={(localId) => handleRemoveAttachment("external", localId)} />
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
              onPaste={(event) => void handlePasteAttachments(event, "resolve")}
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
                      helperText="Fecha de ejecucion"
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
                <AttachmentDraftGrid attachments={resolveAttachments} onRemove={(localId) => handleRemoveAttachment("resolve", localId)} />
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
