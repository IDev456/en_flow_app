import type { ChangeEvent, ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import AttachmentRoundedIcon from "@mui/icons-material/AttachmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { Attachment, AttachmentInput, Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
import { buildJournalItems, formatDate, stepStatusOptions } from "../utils";
import { StatusBadge } from "./StatusBadge";

type JournalProps = {
  step: Step;
  comments: StepComment[];
  history: StepHistoryEntry[];
  canChangeStatus: boolean;
  selectedStatus: "" | "espera" | "problema" | "completado";
  onSelectedStatusChange: (status: "" | "espera" | "problema" | "completado") => void;
  composerExpanded: boolean;
  onComposerExpandedChange: (expanded: boolean) => void;
  focusRequestToken: number;
  onSubmitEntry: (input: StepJournalEntryInput) => Promise<void>;
};

type DraftAttachment = AttachmentInput & {
  local_id: string;
  preview_url: string;
};

const MAX_CHARS = 1000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const SHAPE_RADIUS = 1.1;

type StatusOptionValue = "espera" | "problema" | "completado";

const STATUS_ACCENTS: Record<StatusOptionValue, string> = {
  espera: "#f59e0b",
  problema: "#f43f5e",
  completado: "#22c55e",
};

function getStatusToggleSx(status: StatusOptionValue) {
  const accent = STATUS_ACCENTS[status];
  return {
    borderRadius: SHAPE_RADIUS,
    borderColor: alpha(accent, 0.4),
    backgroundColor: alpha(accent, 0.08),
    textTransform: "none",
    fontWeight: 700,
    px: 1.75,
    py: 0.8,
    "&:hover": {
      borderColor: accent,
      backgroundColor: alpha(accent, 0.24),
      color: "#ffffff",
    },
    "&.Mui-selected": {
      borderColor: accent,
      backgroundColor: alpha(accent, 0.3),
      color: "#ffffff",
    },
    "&.Mui-selected:hover": {
      borderColor: accent,
      backgroundColor: alpha(accent, 0.36),
      color: "#ffffff",
    },
  };
}

export function Journal({
  step,
  comments,
  history,
  canChangeStatus,
  selectedStatus,
  onSelectedStatusChange,
  composerExpanded,
  onComposerExpandedChange,
  focusRequestToken,
  onSubmitEntry,
}: JournalProps) {
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [completionMode, setCompletionMode] = useState<"next" | "finish">("next");
  const [nextStepName, setNextStepName] = useState("");
  const [nextStepDescription, setNextStepDescription] = useState("");
  const [showNextStepDescription, setShowNextStepDescription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => buildJournalItems(history, comments), [history, comments]);
  const isCompleting = selectedStatus === "completado";
  const commentTrimmed = text.trim();
  const canComment = step.puede_tener_comentarios;
  const hasAttachments = attachments.length > 0;
  const missingComment = selectedStatus !== "" ? commentTrimmed.length === 0 : commentTrimmed.length === 0 && !hasAttachments;
  const missingNextStep = isCompleting && completionMode === "next" && nextStepName.trim().length === 0;
  const insufficientLength = selectedStatus !== "" && commentTrimmed.length < 3;

  useEffect(() => {
    if (focusRequestToken > 0) {
      textareaRef.current?.focus();
    }
  }, [focusRequestToken]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!composerRef.current?.contains(event.target as Node)) {
        onComposerExpandedChange(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onComposerExpandedChange]);

  const canSubmit = canComment && !missingComment && !missingNextStep && !insufficientLength && !submitting;

  async function readFileAsAttachment(file: File): Promise<DraftAttachment> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
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
      local_id: createLocalId(),
      nombre: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      content_base64: contentBase64,
      preview_url: dataUrl,
    };
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    try {
      const nextAttachments = await Promise.all(files.map((file) => readFileAsAttachment(file)));
      setAttachments((current) => [...current, ...nextAttachments]);
      setError(null);
      onComposerExpandedChange(true);
      textareaRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron adjuntar los archivos");
    }
  }

  async function handleSubmit() {
    const comentario = commentTrimmed || null;
    if (!comentario && attachments.length === 0) {
      setError("Debes escribir un comentario o adjuntar al menos un archivo.");
      return;
    }

    if (!canComment) {
      setError("Este paso no admite comentarios.");
      return;
    }

    if (selectedStatus && (!comentario || comentario.length < 3)) {
      setError("El comentario debe justificar el cambio de estado.");
      return;
    }

    if (isCompleting && completionMode === "next" && !nextStepName.trim()) {
      setError("Debes indicar cual sera el siguiente paso antes de completar.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmitEntry({
        comentario,
        estado: selectedStatus || null,
        attachments: attachments.map((item) => ({
          nombre: item.nombre,
          content_type: item.content_type,
          size_bytes: item.size_bytes,
          content_base64: item.content_base64,
        })),
        siguiente_paso:
          isCompleting && completionMode === "next"
            ? {
                nombre: nextStepName.trim(),
                descripcion: nextStepDescription.trim() || null,
              }
            : null,
        finalizar_workflow: isCompleting && completionMode === "finish",
      });
      setText("");
      setAttachments([]);
      onSelectedStatusChange("");
      setCompletionMode("next");
      setNextStepName("");
      setNextStepDescription("");
      setShowNextStepDescription(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canSubmit) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    await addFiles(imageFiles);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    void addFiles(files);
    event.target.value = "";
  }

  function handleRemoveAttachment(localId: string) {
    setAttachments((current) => current.filter((item) => item.local_id !== localId));
  }

  function getSubmitLabel() {
    if (selectedStatus === "completado" && completionMode === "finish") {
      return "Completar y finalizar";
    }
    if (selectedStatus === "completado") {
      return "Completar y crear siguiente paso";
    }
    if (selectedStatus) {
      return "Guardar comentario y cambiar estado";
    }
    return "Comentar";
  }

  function getCommentPlaceholder() {
    if (selectedStatus === "espera") {
      return "Que se esta esperando para poder continuar...";
    }
    if (selectedStatus === "problema") {
      return "Describe el problema que impide avanzar...";
    }
    if (selectedStatus === "completado") {
      return "Describe que se completo y que resultado se obtuvo...";
    }
    return "Escribe una nota para la bitacora o pega una imagen...";
  }

  return (
    <Stack
      spacing={3}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: SHAPE_RADIUS,
        },
        "& .MuiButton-root": {
          borderRadius: SHAPE_RADIUS,
          textTransform: "none",
          fontWeight: 700,
        },
        "& .MuiCard-root": {
          borderRadius: SHAPE_RADIUS,
        },
        "& .MuiAlert-root": {
          borderRadius: SHAPE_RADIUS,
        },
      }}
    >
      <Box ref={composerRef}>
        <Stack spacing={2}>
          <Typography variant="h6">Bitacora operativa</Typography>

          <TextField
            inputRef={textareaRef}
            label="Agregar comentario"
            multiline
            minRows={4}
            placeholder={getCommentPlaceholder()}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => onComposerExpandedChange(true)}
            onClick={() => onComposerExpandedChange(true)}
            onKeyDown={handleKeyDown}
            onPaste={(event) => void handlePaste(event)}
            slotProps={{ htmlInput: { maxLength: MAX_CHARS } }}
            disabled={!canComment || submitting}
            helperText={`${text.length} / ${MAX_CHARS}`}
          />

          {composerExpanded && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ alignItems: { xs: "stretch", sm: "center" } }}
            >
              <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canComment || submitting}
                startIcon={<AddPhotoAlternateRoundedIcon />}
              >
                Adjuntar archivos
              </Button>
            </Stack>
          )}

          {attachments.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(220px, 1fr))" },
              }}
            >
              {attachments.map((attachment) => (
                <Card key={attachment.local_id} variant="outlined">
                  <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700 }}>
                          {attachment.nombre}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatFileSize(attachment.size_bytes)}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => handleRemoveAttachment(attachment.local_id)}>
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    {attachment.content_type.startsWith("image/") ? (
                      <Box
                        component="img"
                        src={attachment.preview_url}
                        alt={attachment.nombre}
                        sx={{
                          width: "100%",
                          maxHeight: 220,
                          objectFit: "cover",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      />
                    ) : (
                      <Stack
                        spacing={1}
                        sx={{
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 120,
                          borderRadius: 2,
                          border: "1px dashed",
                          borderColor: "divider",
                        }}
                      >
                        <InsertDriveFileRoundedIcon color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Archivo listo para enviar
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}

          {composerExpanded && canChangeStatus && (
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" color="text.secondary">
                Cambiar estado
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={selectedStatus || null}
                onChange={(_, value: "" | "espera" | "problema" | "completado" | null) => {
                  onSelectedStatusChange(value ?? "");
                  setError(null);
                }}
                sx={{
                  flexWrap: "wrap",
                  gap: 1,
                  p: 0.75,
                  borderRadius: SHAPE_RADIUS,
                  backgroundColor: "rgba(8, 20, 44, 0.58)",
                }}
              >
                {stepStatusOptions.map((option) => (
                  <ToggleButton
                    key={option.value}
                    value={option.value}
                    disabled={submitting}
                    sx={getStatusToggleSx(option.value)}
                  >
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}

          {isCompleting && composerExpanded && (
            <Card variant="outlined">
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Al completar este paso
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={completionMode}
                  onChange={(_, value: "next" | "finish" | null) => {
                    if (value) {
                      setCompletionMode(value);
                    }
                  }}
                >
                  <ToggleButton value="next">Crear siguiente paso</ToggleButton>
                  <ToggleButton value="finish">Finalizar flow</ToggleButton>
                </ToggleButtonGroup>

                {completionMode === "next" ? (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Define el proximo paso para que el flujo siga trazable y quede claro que debe hacerse a continuacion.
                    </Typography>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                      <TextField
                        label="Siguiente paso *"
                        value={nextStepName}
                        onChange={(event) => setNextStepName(event.target.value)}
                        placeholder="Ej. Verificacion con el solicitante"
                      />
                      <Button
                        type="button"
                        variant="outlined"
                        color="inherit"
                        onClick={() => setShowNextStepDescription((value) => !value)}
                        sx={{ minWidth: { md: 180 } }}
                      >
                        {showNextStepDescription ? "Ocultar detalle" : "Sumar detalle"}
                      </Button>
                    </Stack>
                    {showNextStepDescription && (
                      <TextField
                        label="Detalle del siguiente paso"
                        multiline
                        minRows={3}
                        value={nextStepDescription}
                        onChange={(event) => setNextStepDescription(event.target.value)}
                        placeholder="Describe que debera hacerse a continuacion..."
                      />
                    )}
                  </Stack>
                ) : (
                  <Alert severity="success">
                    Este paso se cerrara y el workflow quedara finalizado junto con el requerimiento.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
          >
            <Button type="button" variant="contained" onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? "Guardando..." : getSubmitLabel()}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Divider />

      <Stack spacing={1.5}>
        {items.length === 0 ? (
          <Alert severity="info">Sin movimientos todavia. Cuando registres comentarios, adjuntos o cambios de estado apareceran aqui en orden cronologico.</Alert>
        ) : (
          items.map((item) => (
            <Card key={item.id} variant="outlined">
              <CardContent sx={{ display: "grid", gap: 1.25 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(item.date)}
                  </Typography>
                  {item.kind === "status" && <StatusBadge value={item.status} />}
                </Stack>
                {item.body && <Typography variant="body1">{item.body}</Typography>}
                {item.attachments.length > 0 && <AttachmentList attachments={item.attachments} />}
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  );
}

type AttachmentListProps = {
  attachments: Attachment[];
};

function AttachmentList({ attachments }: AttachmentListProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(220px, 1fr))" },
      }}
    >
      {attachments.map((attachment) => {
        const dataUrl = `data:${attachment.content_type};base64,${attachment.content_base64}`;
        const isImage = attachment.content_type.startsWith("image/");
        return (
          <Card
            key={attachment.id}
            variant="outlined"
            component="a"
            href={dataUrl}
            download={attachment.nombre}
            target="_blank"
            rel="noreferrer"
            sx={{ textDecoration: "none" }}
          >
            <CardContent sx={{ display: "grid", gap: 1.25 }}>
              {isImage ? (
                <Box
                  component="img"
                  src={dataUrl}
                  alt={attachment.nombre}
                  sx={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              ) : (
                <Stack
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 120,
                    borderRadius: 2,
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <AttachmentRoundedIcon color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Archivo adjunto
                  </Typography>
                </Stack>
              )}
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{attachment.nombre}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(attachment.size_bytes)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

type HistoryListProps = {
  history: StepHistoryEntry[];
};

export function HistoryList({ history }: HistoryListProps) {
  if (history.length === 0) {
    return <Alert severity="info">Todavia no hay historial registrado.</Alert>;
  }

  return (
    <Stack spacing={1.5}>
      {history.map((entry) => (
        <Card key={entry.id} variant="outlined">
          <CardContent sx={{ display: "grid", gap: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 700 }}>{entry.campo === "estado" ? "Cambio de estado" : entry.campo}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDate(entry.fecha)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              {entry.valor_anterior ? <StatusBadge value={entry.valor_anterior} /> : <Chip label="vacio" variant="outlined" size="small" />}
              <Typography color="text.secondary">→</Typography>
              {entry.valor_nuevo ? <StatusBadge value={entry.valor_nuevo} /> : <Chip label="vacio" variant="outlined" size="small" />}
            </Stack>

            {entry.nota && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderLeft: "3px solid",
                  borderColor: "primary.main",
                  backgroundColor: "rgba(11, 16, 29, 0.62)",
                }}
              >
                <Typography variant="body2">{entry.nota}</Typography>
              </Box>
            )}

            {entry.attachments.length > 0 && <AttachmentList attachments={entry.attachments} />}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const sizeKb = sizeBytes / 1024;
  if (sizeKb < 1024) {
    return `${sizeKb.toFixed(1)} KB`;
  }
  return `${(sizeKb / 1024).toFixed(1)} MB`;
}
