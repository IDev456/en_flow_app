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
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import type { Attachment, AttachmentInput, Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
import { buildJournalItems, formatDate, stepStatusOptions } from "../utils";
import { StatusBadge } from "./StatusBadge";

type JournalProps = {
  step: Step;
  comments: StepComment[];
  history: StepHistoryEntry[];
  canChangeStatus: boolean;
  selectedStatus: "" | "espera" | "problema";
  onSelectedStatusChange: (status: "" | "espera" | "problema") => void;
  composerExpanded: boolean;
  onComposerExpandedChange: (expanded: boolean) => void;
  focusRequestToken: number;
  onSubmitEntry: (input: StepJournalEntryInput) => Promise<void>;
  showComposer?: boolean;
};

type DraftAttachment = AttachmentInput & {
  local_id: string;
  preview_url: string;
};

const MAX_CHARS = 1000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const SHAPE_RADIUS = 1.1;

type StatusOptionValue = "espera" | "problema";

function getStatusToggleSx(status: StatusOptionValue) {
  return (theme: Theme) => {
    const accent = status === "espera" ? theme.palette.warning.main : theme.palette.error.main;
    return {
      borderRadius: SHAPE_RADIUS,
      borderColor: alpha(accent, 0.42),
      backgroundColor: alpha(accent, 0.08),
      color: theme.palette.text.primary,
      textTransform: "none",
      fontWeight: 700,
      px: 1.75,
      py: 0.8,
      "&:hover": {
        borderColor: accent,
        backgroundColor: alpha(accent, 0.2),
      },
      "&.Mui-selected": {
        borderColor: accent,
        backgroundColor: alpha(accent, theme.palette.mode === "dark" ? 0.34 : 0.24),
        color: theme.palette.text.primary,
      },
      "&.Mui-selected:hover": {
        borderColor: accent,
        backgroundColor: alpha(accent, theme.palette.mode === "dark" ? 0.4 : 0.3),
      },
    };
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
  showComposer = true,
}: JournalProps) {
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToastOpen, setSavedToastOpen] = useState(false);
  const items = useMemo(() => buildJournalItems(history, comments), [history, comments]);
  const visibleItems = useMemo(() => {
    const hasAlternativeItem = items.some((item) => {
      const normalized = item.body.trim().toLowerCase();
      return normalized.length > 0 && !normalized.includes("tarea creada desde cierre");
    });

    return items.filter((item) => {
      const body = item.body.trim();
      if (!body && item.attachments.length === 0) {
        return false;
      }
      if (hasAlternativeItem && body.toLowerCase().includes("tarea creada desde cierre")) {
        return false;
      }
      return true;
    });
  }, [items]);
  const commentTrimmed = text.trim();
  const canComment = step.puede_tener_comentarios;
  const hasAttachments = attachments.length > 0;
  const missingComment = selectedStatus !== "" ? commentTrimmed.length === 0 : commentTrimmed.length === 0 && !hasAttachments;
  const insufficientLength = selectedStatus !== "" && commentTrimmed.length < 3;

  useEffect(() => {
    if (focusRequestToken > 0) {
      onComposerExpandedChange(true);
      textareaRef.current?.focus();
    }
  }, [focusRequestToken, onComposerExpandedChange]);

  useEffect(() => {
    if (!composerExpanded) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!composerRef.current?.contains(event.target as Node)) {
        if (!text.trim() && attachments.length === 0 && !submitting) {
          onComposerExpandedChange(false);
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [attachments.length, composerExpanded, onComposerExpandedChange, submitting, text]);

  const canSubmit = canComment && !missingComment && !insufficientLength && !submitting;

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
      setError("Debes registrar un avance o adjuntar al menos un archivo.");
      return;
    }

    if (!canComment) {
      setError("Esta tarea no admite registros.");
      return;
    }

    if (selectedStatus && (!comentario || comentario.length < 3)) {
      setError("El registro debe justificar el cambio de estado.");
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
      });
      setText("");
      setAttachments([]);
      onSelectedStatusChange("");
      onComposerExpandedChange(false);
      setSavedToastOpen(true);
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
    if (selectedStatus) {
      return "Guardar avance y cambiar estado";
    }
    return "Guardar avance";
  }

  function getCommentPlaceholder() {
    if (selectedStatus === "espera") {
      return "Qué estás esperando para poder continuar...";
    }
    if (selectedStatus === "problema") {
      return "Qué impide avanzar...";
    }
    return "Registrá qué pasó o qué cambió...";
  }

  function handleOpenComposer() {
    onComposerExpandedChange(true);
    setError(null);
  }

  function handleCancelComposer() {
    if (submitting) return;
    setText("");
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setError(null);
    onSelectedStatusChange("");
    onComposerExpandedChange(false);
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
      {showComposer ? (
        <Box ref={composerRef}>
          <Stack spacing={2}>
            <Typography variant="h6">Agregar registro</Typography>

            {composerExpanded ? (
              <Stack spacing={2}>
                <TextField
                  inputRef={textareaRef}
                  label="Registrar avance"
                  multiline
                  minRows={4}
                  placeholder={getCommentPlaceholder()}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(event) => void handlePaste(event)}
                  slotProps={{ htmlInput: { maxLength: MAX_CHARS } }}
                  disabled={!canComment || submitting}
                  helperText={`${text.length} / ${MAX_CHARS}`}
                />

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
              </Stack>
            ) : (
              <Button type="button" variant="contained" onClick={handleOpenComposer} disabled={!canComment}>
                Agregar registro
              </Button>
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
                onChange={(_, value: "" | "espera" | "problema" | null) => {
                  onSelectedStatusChange(value ?? "");
                  setError(null);
                }}
                sx={{
                  flexWrap: "wrap",
                  gap: 1,
                  p: 0.75,
                  borderRadius: SHAPE_RADIUS,
                  backgroundColor: (theme) =>
                    alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.42 : 0.72),
                }}
              >
                {stepStatusOptions.map((option) => (
                  <ToggleButton
                    key={option.value}
                    value={option.value}
                    disabled={submitting}
                    sx={getStatusToggleSx(option.value as StatusOptionValue)}
                  >
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {composerExpanded && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
            >
              <Stack direction="row" spacing={1}>
                <Button type="button" variant="contained" onClick={() => void handleSubmit()} disabled={!canSubmit}>
                  {submitting ? "Guardando..." : getSubmitLabel()}
                </Button>
                <Button type="button" variant="text" color="inherit" onClick={handleCancelComposer} disabled={submitting}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Box>
      ) : null}

      {showComposer && <Divider />}

      <Snackbar
        open={savedToastOpen}
        autoHideDuration={2200}
        onClose={() => setSavedToastOpen(false)}
        message="Avance guardado"
      />

      <Stack spacing={1.5}>
        {visibleItems.length === 0 ? (
          <Alert severity="info">Sin registros todavia. Cuando registres avances, adjuntos o cambios de estado apareceran aqui en orden cronologico.</Alert>
        ) : (
          visibleItems.map((item) => {
            const body = item.body.trim();
            return (
            <Card key={item.id} variant="outlined">
              <CardContent sx={{ display: "grid", gap: 1, p: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.date)}
                  </Typography>
                  {item.kind === "status" && (
                    <Box sx={{ "& .MuiChip-root": { height: 22, fontSize: "0.72rem" } }}>
                      <StatusBadge value={item.status} />
                    </Box>
                  )}
                </Stack>
                {body ? (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {body}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Adjuntos
                  </Typography>
                )}
                {item.attachments.length > 0 && <AttachmentList attachments={item.attachments} />}
              </CardContent>
            </Card>
            );
          })
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
                  backgroundColor: (theme) =>
                    alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1),
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
