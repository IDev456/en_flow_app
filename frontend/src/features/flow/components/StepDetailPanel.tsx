import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

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
import { DEFAULT_ACTOR } from "../utils";
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
  onCompleteTask: (stepId: string, input: StepCompleteInput) => Promise<void>;
  openCompleteDialog?: boolean;
  onCompleteDialogOpened?: () => void;
  onRegisterExternalEvent?: (input: ExternalEventCreateInput) => Promise<void>;
  onResolveExternalResponse?: (stepId: string, input: ExternalResponseDecisionInput) => Promise<void>;
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
  onCompleteTask,
  openCompleteDialog,
  onCompleteDialogOpened,
  onRegisterExternalEvent,
  onResolveExternalResponse,
}: StepDetailPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<"" | "espera" | "problema">("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [focusRequestToken, setFocusRequestToken] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTransition, setCompleteTransition] = useState<StepTransitionType>("next_task");
  const [completeResult, setCompleteResult] = useState("");
  const [completeObservations, setCompleteObservations] = useState("");
  const [nextTaskName, setNextTaskName] = useState("");
  const [nextTaskDescription, setNextTaskDescription] = useState("");
  const [nextTaskAssignee, setNextTaskAssignee] = useState("");
  const [nextTaskDueDate, setNextTaskDueDate] = useState("");
  const [waitExpected, setWaitExpected] = useState("");
  const [waitSource, setWaitSource] = useState("");
  const [waitDetail, setWaitDetail] = useState("");
  const [waitReference, setWaitReference] = useState("");
  const [finishReason, setFinishReason] = useState("");
  const [completeAttachments, setCompleteAttachments] = useState<AttachmentInput[]>([]);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeAdvancedOpen, setCompleteAdvancedOpen] = useState(false);

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

  useEffect(() => {
    if (!step) {
      return;
    }
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);

    setCompleteDialogOpen(false);
    setCompleteTransition("next_task");
    setCompleteResult("");
    setCompleteObservations("");
    setNextTaskName("");
    setNextTaskDescription("");
    setNextTaskAssignee("");
    setNextTaskDueDate("");
    setWaitExpected(step.expected_external_event ?? "");
    setWaitSource("");
    setWaitDetail(step.external_wait_reason ?? "");
    setWaitReference(step.external_reference ?? "");
    setFinishReason("");
    setCompleteAttachments([]);
    setCompleteError(null);
    setCompleteAdvancedOpen(false);

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
  }, [step?.id, step?.estado, step?.expected_external_event, step?.external_reference, step?.external_wait_reason]);

  if (!step) {
    return (
      <Card
        sx={{
          ...(drawer ? { position: { xl: "sticky" }, top: { xl: 96 } } : {}),
          ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5">Sin tarea seleccionada</Typography>
            <Typography color="text.secondary">
              Selecciona una tarea del flow para revisar su registro, entender el contexto y decidir qué sigue.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const canChangeStatus = ["activo", "espera", "problema"].includes(step.estado);
  const canCompleteTask = ["activo", "espera", "problema"].includes(step.estado);
  const isWaitingExternal = step.estado === "esperando_respuesta";
  const latestMessage = step.ultimo_comentario?.trim() || (step.orden === 1 && step.descripcion?.trim() ? step.descripcion.trim() : "Sin registros todavia");

  useEffect(() => {
    if (openCompleteDialog && canCompleteTask) {
      setCompleteDialogOpen(true);
      onCompleteDialogOpened?.();
    }
  }, [canCompleteTask, onCompleteDialogOpened, openCompleteDialog]);

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    await onSubmitJournal(input);
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
  }

  function handleStatusIntent(status: "" | "espera" | "problema") {
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
      if (target === "complete") setCompleteAttachments((current) => [...current, ...parsed]);
      if (target === "external") setExternalAttachments((current) => [...current, ...parsed]);
      if (target === "resolve") setResolveAttachments((current) => [...current, ...parsed]);
      setCompleteError(null);
      setExternalError(null);
      setResolveError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron adjuntar archivos";
      if (target === "complete") setCompleteError(message);
      if (target === "external") setExternalError(message);
      if (target === "resolve") setResolveError(message);
    }
  }

  async function handleCompleteTask() {
    const currentStep = step;
    if (!currentStep) return;
    const resultTrimmed = completeResult.trim();
    if (resultTrimmed.length < 3) {
      setCompleteError("Debes indicar el resultado de la tarea.");
      return;
    }
    if (completeTransition === "next_task" && !nextTaskName.trim()) {
      setCompleteError("Debes indicar el nombre de la proxima tarea.");
      return;
    }
    if (completeTransition === "wait_external" && !waitExpected.trim()) {
      setCompleteError("Debes indicar que respuesta externa se espera.");
      return;
    }

    try {
      setCompleting(true);
      setCompleteError(null);
      await onCompleteTask(currentStep.id, {
        usuario: DEFAULT_ACTOR,
        resultado_cierre: resultTrimmed,
        comentario: resultTrimmed,
        observaciones: completeObservations.trim() || null,
        transition_type: completeTransition,
        next_task:
          completeTransition === "next_task"
            ? {
                nombre: nextTaskName.trim(),
                descripcion: nextTaskDescription.trim() || null,
                asignado_a: nextTaskAssignee.trim() || null,
                fecha_vencimiento: nextTaskDueDate || null,
              }
            : null,
        external_wait:
          completeTransition === "wait_external"
            ? {
                que_se_espera: waitExpected.trim(),
                origen: waitSource.trim() || "externo",
                detalle: waitDetail.trim() || null,
                referencia_externa: waitReference.trim() || null,
                attachments: completeAttachments,
              }
            : null,
        finish_data:
          completeTransition === "finish_flow"
            ? {
                resultado_final: resultTrimmed,
                motivo_cierre: finishReason.trim() || null,
                attachments: completeAttachments,
              }
            : null,
        attachments: completeAttachments,
      });
      setCompleteDialogOpen(false);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "No se pudo completar la tarea");
    } finally {
      setCompleting(false);
    }
  }

  async function handleRegisterExternalEvent() {
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
    if (!onResolveExternalResponse) return;
    const currentStep = step;
    if (!currentStep) return;
    const resultTrimmed = resolveResult.trim();
    if (resultTrimmed.length < 3) {
      setResolveError("Debes indicar el resultado de cierre de la tarea.");
      return;
    }
    if (resolveTransition === "next_task" && !resolveNextTaskName.trim()) {
      setResolveError("Debes indicar el nombre de la proxima tarea.");
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
                fecha_vencimiento: resolveNextTaskDueDate || null,
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

  return (
    <Card
      sx={{
        minWidth: 0,
        ...(drawer ? { position: { xl: "sticky" }, top: { xl: 96 } } : {}),
        ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box>
                <Typography variant="overline" color="primary.light">
                  Tarea {step.orden}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.25 }}>
                  {step.nombre}
                </Typography>
                {step.descripcion && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {step.descripcion}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                {canCompleteTask && (
                  <Button variant="contained" onClick={() => setCompleteDialogOpen(true)} sx={{ textTransform: "none" }}>
                    Completar tarea
                  </Button>
                )}
                {isWaitingExternal && onRegisterExternalEvent && (
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
                {drawer && onClose && (
                  <IconButton onClick={onClose} aria-label="Cerrar detalle de la tarea">
                    <CloseRoundedIcon />
                  </IconButton>
                )}
              </Stack>
            </Stack>

            <Card variant="outlined">
              <CardContent sx={{ p: 1.75 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Estado operativo
                  </Typography>
                  <StatusBadge value={step.estado} />
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Ultimo registro
                    </Typography>
                    <Typography variant="body2" color={latestMessage === "Sin registros todavia" ? "text.secondary" : "text.primary"}>
                      {latestMessage}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {isWaitingExternal ? (
              <Card variant="outlined">
                <CardContent sx={{ p: 1.75 }}>
                  <Stack spacing={1}>
                    <Alert severity="info">Esperando respuesta externa</Alert>
                    {step.expected_external_event && (
                      <Typography variant="body2" color="text.secondary">
                        Que se espera: {step.expected_external_event}
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
        </Box>

        <Divider />

        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Journal
            step={step}
            comments={comments}
            history={history}
            canChangeStatus={canChangeStatus}
            selectedStatus={selectedStatus}
            onSelectedStatusChange={setSelectedStatus}
            composerExpanded={composerExpanded}
            onComposerExpandedChange={setComposerExpanded}
            focusRequestToken={focusRequestToken}
            onSubmitEntry={handleSubmitJournal}
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

        {standalone && (
          <>
            <Divider />
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2.25 }}>
              <Button component={RouterLink} to={`/workflows/${workflowId}`} variant="text" color="inherit">
                Volver al flow
              </Button>
            </Box>
          </>
        )}
      </CardContent>

      <Dialog open={completeDialogOpen} onClose={completing ? undefined : () => setCompleteDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Completar tarea</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="¿Qué pasó? *"
              multiline
              minRows={3}
              value={completeResult}
              onChange={(event) => setCompleteResult(event.target.value)}
              disabled={completing}
            />

            <Typography variant="subtitle2" color="text.secondary">
              ¿Qué sigue?
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={completeTransition}
              onChange={(_, value: StepTransitionType | null) => {
                if (!value) return;
                setCompleteTransition(value);
                setCompleteAdvancedOpen(false);
              }}
              fullWidth
            >
              <ToggleButton value="next_task">Crear próxima tarea</ToggleButton>
              <ToggleButton value="wait_external">Esperar respuesta externa</ToggleButton>
              <ToggleButton value="finish_flow">Finalizar flow</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary">
              {completeTransition === "next_task" && "Hay algo más para hacer."}
              {completeTransition === "wait_external" && "Queda pendiente una respuesta o dato externo."}
              {completeTransition === "finish_flow" && "El tema ya quedó resuelto."}
            </Typography>

            {completeTransition === "next_task" && (
              <Stack spacing={1.5}>
                <TextField label="Nombre de la próxima tarea *" value={nextTaskName} onChange={(event) => setNextTaskName(event.target.value)} />
              </Stack>
            )}

            {completeTransition === "wait_external" && (
              <Stack spacing={1.5}>
                <TextField label="Que se esta esperando *" value={waitExpected} onChange={(event) => setWaitExpected(event.target.value)} />
              </Stack>
            )}

            <Button variant="text" color="inherit" onClick={() => setCompleteAdvancedOpen((value) => !value)}>
              {completeAdvancedOpen ? "Ocultar opciones avanzadas" : "Más detalle (opcional)"}
            </Button>

            <Collapse in={completeAdvancedOpen}>
              <Stack spacing={1.5}>
                <TextField
                  label="Observaciones"
                  multiline
                  minRows={2}
                  value={completeObservations}
                  onChange={(event) => setCompleteObservations(event.target.value)}
                  disabled={completing}
                />

                {completeTransition === "next_task" && (
                  <>
                    <TextField label="Detalle / contexto" multiline minRows={2} value={nextTaskDescription} onChange={(event) => setNextTaskDescription(event.target.value)} />
                    <TextField label="Asignado a" value={nextTaskAssignee} onChange={(event) => setNextTaskAssignee(event.target.value)} />
                    <TextField
                      label="Fecha de vencimiento"
                      type="datetime-local"
                      value={nextTaskDueDate}
                      onChange={(event) => setNextTaskDueDate(event.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </>
                )}

                {completeTransition === "wait_external" && (
                  <>
                    <TextField label="Origen / proveedor / persona" value={waitSource} onChange={(event) => setWaitSource(event.target.value)} />
                    <TextField label="Detalle de la espera" multiline minRows={2} value={waitDetail} onChange={(event) => setWaitDetail(event.target.value)} />
                    <TextField label="Referencia externa" value={waitReference} onChange={(event) => setWaitReference(event.target.value)} />
                  </>
                )}

                {completeTransition === "finish_flow" && (
                  <TextField label="Motivo de cierre" multiline minRows={2} value={finishReason} onChange={(event) => setFinishReason(event.target.value)} />
                )}

                <Button component="label" variant="outlined" color="inherit" disabled={completing}>
                  Adjuntar archivos (opcional)
                  <input hidden multiple type="file" onChange={(event) => void handleAttachmentSelection(event.target.files, "complete")} />
                </Button>
                {completeAttachments.length > 0 && (
                  <Stack spacing={0.5}>
                    {completeAttachments.map((item, index) => (
                      <Typography key={`${item.nombre}-${index}`} variant="body2" color="text.secondary">
                        {item.nombre} ({Math.round(item.size_bytes / 1024)} KB)
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Collapse>

            {completeError && <Alert severity="error">{completeError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)} disabled={completing} color="inherit">
            Cancelar
          </Button>
          <Button onClick={() => void handleCompleteTask()} disabled={completing} variant="contained">
            {completing ? "Guardando..." : "Guardar decisión"}
          </Button>
        </DialogActions>
      </Dialog>

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
              {resolveTransition === "next_task" && "Hay algo mas para hacer."}
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
                    <TextField
                      label="Fecha de vencimiento"
                      type="datetime-local"
                      value={resolveNextTaskDueDate}
                      onChange={(event) => setResolveNextTaskDueDate(event.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
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
