import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { AttachmentInput, ExternalEventCreateInput, Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
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
  onRegisterExternalEvent?: (input: ExternalEventCreateInput) => Promise<void>;
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
  onRegisterExternalEvent,
}: StepDetailPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<"" | "espera" | "completado">("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [focusRequestToken, setFocusRequestToken] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [externalEventType, setExternalEventType] = useState("");
  const [externalComment, setExternalComment] = useState("");
  const [externalSource, setExternalSource] = useState("manual");
  const [externalActor, setExternalActor] = useState(DEFAULT_ACTOR);
  const [externalAttachments, setExternalAttachments] = useState<AttachmentInput[]>([]);
  const [registeringExternal, setRegisteringExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  useEffect(() => {
    if (!step) {
      return;
    }
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
    setExternalDialogOpen(false);
    setExternalError(null);
    setExternalEventType(step.expected_external_event ?? "");
    setExternalComment("");
    setExternalSource("manual");
    setExternalActor(DEFAULT_ACTOR);
    setExternalAttachments([]);
  }, [step?.id, step?.expected_external_event, step?.estado]);

  if (!step) {
    return (
      <Card
        sx={{
          ...(drawer
            ? { position: { xl: "sticky" }, top: { xl: 96 } }
            : {}),
          ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={1}>
              <Typography variant="h5">Sin paso seleccionado</Typography>
              <Typography color="text.secondary">
                Selecciona una tarea del flow para revisar su bitacora, entender el contexto y registrar avance.
              </Typography>
            </Stack>
        </CardContent>
      </Card>
    );
  }

  const canChangeStatus = ["activo", "espera", "problema"].includes(step.estado);
  const latestMessage =
    step.ultimo_comentario?.trim() ||
    (step.orden === 1 && step.descripcion?.trim() ? step.descripcion.trim() : "Sin registros todavia");
  const waitsExternal = step.waits_for_external_response || step.action_type === "wait_external";
  const actionLabel = step.action_label?.trim() || humanizeActionType(step.action_type);

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    await onSubmitJournal(input);
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
  }

  function handleStatusIntent(status: "" | "espera" | "completado") {
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

  async function handleExternalFileChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const parsed = await Promise.all(Array.from(files).map((file) => readFileAsAttachment(file)));
      setExternalAttachments((current) => [...current, ...parsed]);
      setExternalError(null);
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : "No se pudieron adjuntar archivos");
    }
  }

  async function handleRegisterExternalEvent() {
    if (!onRegisterExternalEvent) return;
    if (!externalEventType.trim()) {
      setExternalError("Debes indicar el tipo de respuesta externa.");
      return;
    }
    if (!externalActor.trim()) {
      setExternalError("Debes indicar quien registra la respuesta.");
      return;
    }

    try {
      setRegisteringExternal(true);
      setExternalError(null);
      await onRegisterExternalEvent({
        event_type: externalEventType.trim(),
        comentario: externalComment.trim() || null,
        source: externalSource.trim() || "manual",
        registrado_por: externalActor.trim(),
        attachments: externalAttachments,
      });
      setExternalDialogOpen(false);
      setExternalComment("");
      setExternalAttachments([]);
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : "No se pudo registrar la respuesta externa");
    } finally {
      setRegisteringExternal(false);
    }
  }

  return (
    <Card
      sx={{
        minWidth: 0,
        ...(drawer
          ? { position: { xl: "sticky" }, top: { xl: 96 } }
          : {}),
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
                  Paso {step.orden}
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
                {step.estado === "esperando_respuesta" && onRegisterExternalEvent && (
                  <Button
                    variant="outlined"
                    color="info"
                    onClick={() => setExternalDialogOpen(true)}
                    sx={{ textTransform: "none" }}
                  >
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
                      <MenuItem onClick={() => handleStatusIntent("completado")}>Completar tarea</MenuItem>
                    </Menu>
                  </>
                )}
                {drawer && onClose && (
                  <IconButton onClick={onClose} aria-label="Cerrar detalle del paso">
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

            <Card variant="outlined">
              <CardContent sx={{ p: 1.75 }}>
                <Stack spacing={0.9}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Accion al completar
                  </Typography>
                  <Typography variant="body2">{actionLabel}</Typography>
                  {waitsExternal ? (
                    <Typography variant="body2" color="text.secondary">
                      El flow quedara detenido hasta registrar la respuesta externa.
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      El flow continuara automaticamente si las dependencias quedan cumplidas.
                    </Typography>
                  )}
                  {step.expected_external_event && (
                    <Typography variant="body2" color="text.secondary">
                      Dato esperado: {step.expected_external_event}
                    </Typography>
                  )}
                  {step.external_wait_reason && (
                    <Typography variant="body2" color="text.secondary">
                      Motivo: {step.external_wait_reason}
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

            {step.estado === "esperando_respuesta" && (
              <Card variant="outlined">
                <CardContent sx={{ p: 1.75 }}>
                  <Stack spacing={1}>
                    <Alert severity="info">Esperando respuesta externa</Alert>
                    {step.expected_external_event && (
                      <Typography variant="body2" color="text.secondary">
                        Dato esperado: {step.expected_external_event}
                      </Typography>
                    )}
                    {step.external_wait_reason && (
                      <Typography variant="body2" color="text.secondary">
                        Motivo: {step.external_wait_reason}
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
                Volver al workflow
              </Button>
            </Box>
          </>
        )}
      </CardContent>

      <Dialog open={externalDialogOpen} onClose={registeringExternal ? undefined : () => setExternalDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar respuesta recibida</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Tipo de respuesta / evento *"
              value={externalEventType}
              onChange={(event) => setExternalEventType(event.target.value)}
              disabled={registeringExternal}
            />
            <TextField
              label="Detalle recibido"
              multiline
              minRows={3}
              value={externalComment}
              onChange={(event) => setExternalComment(event.target.value)}
              disabled={registeringExternal}
            />
            <TextField
              label="Usuario / actor"
              value={externalActor}
              onChange={(event) => setExternalActor(event.target.value)}
              disabled={registeringExternal}
            />
            <TextField
              label="Origen"
              value={externalSource}
              onChange={(event) => setExternalSource(event.target.value)}
              disabled={registeringExternal}
            />
            <Button component="label" variant="outlined" color="inherit" disabled={registeringExternal}>
              Adjuntar archivos (opcional)
              <input hidden multiple type="file" onChange={(event) => void handleExternalFileChange(event.target.files)} />
            </Button>
            {externalAttachments.length > 0 && (
              <Stack spacing={0.5}>
                {externalAttachments.map((item, index) => (
                  <Box
                    key={`${item.nombre}-${index}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1.25,
                      py: 0.8,
                      borderRadius: 1.1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2">{`${item.nombre} (${Math.round(item.size_bytes / 1024)} KB)`}</Typography>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() =>
                        setExternalAttachments((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index)
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
            {externalError && <Alert severity="error">{externalError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExternalDialogOpen(false)} disabled={registeringExternal} color="inherit">
            Cancelar
          </Button>
          <Button onClick={() => void handleRegisterExternalEvent()} disabled={registeringExternal} variant="contained">
            {registeringExternal ? "Registrando..." : "Registrar y continuar flow"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function humanizeActionType(actionType: string | null) {
  const normalized = (actionType ?? "continue").trim().toLowerCase();
  if (normalized === "wait_external") return "Esperar respuesta externa";
  if (normalized === "manual_review") return "Revision manual";
  if (normalized === "finish_flow") return "Finalizar flow";
  if (normalized === "continue") return "Continuar flow";
  return normalized.replaceAll("_", " ");
}
