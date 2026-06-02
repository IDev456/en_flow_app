import type { ChangeEvent, ClipboardEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
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
  Dialog,
  DialogContent,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import type { Attachment, AttachmentInput, Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
import { buildJournalItems, formatDate, formatElapsedTime, stepStatusOptions } from "../utils";
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
  canEditEntries?: boolean;
  onEditEntry?: (commentId: string, comentario: string | null) => Promise<void>;
};

type DraftAttachment = AttachmentInput & {
  local_id: string;
  preview_url: string;
};

type ImagePreview = {
  name: string;
  src: string;
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

function renderInlineMarkdown(text: string) {
  const fragments: ReactNode[] = [];
  const matcher = /(\*\*[^*]+\*\*)/g;
  const parts = text.split(matcher);

  parts.forEach((part, index) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      fragments.push(<Box key={`bold-${index}`} component="strong" sx={{ fontWeight: 800 }}>{part.slice(2, -2)}</Box>);
      return;
    }
    fragments.push(<Box key={`text-${index}`} component="span">{part}</Box>);
  });

  return fragments;
}

function renderMarkdownContent(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: Array<{ text: string; indent: number }> = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <Stack key={`list-${blocks.length}`} spacing={0.45} sx={{ py: 0.15 }}>
        {listItems.map((item, index) => (
          <Box key={`item-${index}`} sx={{ display: "flex", alignItems: "flex-start", gap: 0.9, pl: item.indent * 2 }}>
            <Typography component="span" variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
              •
            </Typography>
            <Typography component="div" variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {renderInlineMarkdown(item.text)}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
    listItems = [];
  }

  lines.forEach((line) => {
    const listMatch = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (listMatch) {
      listItems.push({
        indent: Math.floor((listMatch[1] ?? "").length / 2),
        text: listMatch[2] ?? "",
      });
      return;
    }

    flushList();
    if (!line.trim()) {
      blocks.push(<Box key={`space-${blocks.length}`} sx={{ height: 6 }} />);
      return;
    }

    blocks.push(
      <Typography key={`paragraph-${blocks.length}`} component="div" variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {renderInlineMarkdown(line)}
      </Typography>
    );
  });

  flushList();
  return blocks;
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
  canEditEntries = false,
  onEditEntry,
}: JournalProps) {
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedToastOpen, setSavedToastOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImagePreview | null>(null);
  const items = useMemo(() => buildJournalItems(history, comments), [history, comments]);
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const body = item.body.trim();
      return body.length > 0 || item.attachments.length > 0;
    });
  }, [items]);
  const commentTrimmed = text.trim();
  const isEditing = editingCommentId !== null;
  const canComment = step.puede_tener_comentarios;
  const hasAttachments = attachments.length > 0;
  const missingComment = selectedStatus !== "" ? commentTrimmed.length === 0 : commentTrimmed.length === 0 && !hasAttachments;
  const insufficientLength = selectedStatus !== "" && commentTrimmed.length < 3;

  useEffect(() => {
    if (focusRequestToken > 0) {
      onComposerExpandedChange(true);
      setEditingCommentId(null);
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
      if (isEditing) {
        if (!editingCommentId || !onEditEntry) {
          throw new Error("No se pudo identificar el registro a editar.");
        }
        await onEditEntry(editingCommentId, comentario);
      } else {
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
      }
      setText("");
      setAttachments([]);
      setEditingCommentId(null);
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
    if (isEditing) {
      return "Guardar cambios";
    }
    if (selectedStatus) {
      return "Guardar avance y cambiar estado";
    }
    return "Guardar avance";
  }

  function getCommentPlaceholder() {
    if (isEditing) {
      return "Editá el registro...";
    }
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

  function handleStartEditing(commentId: string, body: string) {
    setEditingCommentId(commentId);
    setText(body);
    setAttachments([]);
    onSelectedStatusChange("");
    setError(null);
    onComposerExpandedChange(true);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleCancelComposer() {
    if (submitting) return;
    setText("");
    setAttachments([]);
    setEditingCommentId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setError(null);
    onSelectedStatusChange("");
    onComposerExpandedChange(false);
  }

  function updateTextSelection(
    transform: (value: string, start: number, end: number) => { nextValue: string; nextStart: number; nextEnd: number }
  ) {
    const input = textareaRef.current;
    const currentValue = text;
    const selectionStart = input?.selectionStart ?? currentValue.length;
    const selectionEnd = input?.selectionEnd ?? currentValue.length;
    const { nextValue, nextStart, nextEnd } = transform(currentValue, selectionStart, selectionEnd);
    setText(nextValue);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextStart, nextEnd);
    }, 0);
  }

  function handleApplyBold() {
    updateTextSelection((value, start, end) => {
      const selected = value.slice(start, end) || "texto";
      const wrapped = `**${selected}**`;
      return {
        nextValue: `${value.slice(0, start)}${wrapped}${value.slice(end)}`,
        nextStart: start + 2,
        nextEnd: start + 2 + selected.length,
      };
    });
  }

  function handleApplyIndentList() {
    updateTextSelection((value, start, end) => {
      const selected = value.slice(start, end) || "Nuevo punto";
      const nextBlock = selected
        .split(/\r?\n/)
        .map((line) => (line.trim().length > 0 ? `  - ${line}` : line))
        .join("\n");
      return {
        nextValue: `${value.slice(0, start)}${nextBlock}${value.slice(end)}`,
        nextStart: start,
        nextEnd: start + nextBlock.length,
      };
    });
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
            {composerExpanded ? (
              <Stack spacing={2}>
                <TextField
                  inputRef={textareaRef}
                  label={isEditing ? "Editar registro" : "Registrar avance"}
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
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    flexWrap: "wrap",
                    borderRadius: SHAPE_RADIUS,
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "surfaceContainerLow",
                    px: 1.15,
                    py: 0.9,
                  }}
                >
                  <Button size="small" color="inherit" onClick={handleApplyBold} disabled={submitting}>
                    Negrita
                  </Button>
                  <Button size="small" color="inherit" onClick={handleApplyIndentList} disabled={submitting}>
                    Sangría / lista
                  </Button>
                </Stack>

                {!isEditing ? <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} /> : null}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.25}
                  sx={{
                    alignItems: "stretch",
                    borderRadius: SHAPE_RADIUS,
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "surfaceContainerLow",
                    px: { xs: 1.1, sm: 1.25 },
                    py: { xs: 1, sm: 1.1 },
                  }}
                >
                  {!isEditing ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
                      <Tooltip title="Adjuntar archivos">
                        <span>
                          <IconButton
                            type="button"
                            color="inherit"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!canComment || submitting}
                            aria-label="Adjuntar archivos"
                            sx={{
                              border: "1px solid",
                              borderColor: "outline",
                              backgroundColor: "background.paper",
                              "&:hover": {
                                backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.06),
                              },
                            }}
                          >
                            <AddPhotoAlternateRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                      Editando solo el texto del registro
                    </Typography>
                  )}

                  <Stack
                    direction={{ xs: "row", sm: "row" }}
                    spacing={1}
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      alignItems: "center",
                      justifyContent: { xs: "space-between", sm: "flex-end" },
                      flexWrap: "wrap",
                      flex: 1,
                    }}
                  >
                    <Button
                      type="button"
                      variant="text"
                      color="inherit"
                      onClick={handleCancelComposer}
                      disabled={submitting}
                      sx={{ order: { xs: 1, sm: 1 }, alignSelf: { xs: "stretch", sm: "auto" } }}
                    >
                      {isEditing ? "Cancelar edición" : "Cancelar"}
                    </Button>
                    <Button
                      type="button"
                      variant="contained"
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit}
                      sx={{
                        order: { xs: 2, sm: 2 },
                        flex: { xs: 1, sm: "0 0 auto" },
                        minWidth: { xs: 0, sm: 220 },
                        px: 2.2,
                        boxShadow: 0,
                        "&.Mui-disabled": {
                          backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16),
                          color: (theme) => alpha(theme.palette.primary.contrastText, 0.88),
                        },
                      }}
                    >
                      {submitting ? "Guardando..." : getSubmitLabel()}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            ) : (
              <Button type="button" variant="contained" onClick={handleOpenComposer} disabled={!canComment}>
                Agregar registro
              </Button>
            )}

            {composerExpanded && attachments.length > 0 && (
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
        </Stack>
        </Box>
      ) : null}

      <Snackbar
        open={savedToastOpen}
        autoHideDuration={2200}
        onClose={() => setSavedToastOpen(false)}
        message="Avance guardado"
      />
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} fullWidth maxWidth="lg">
        <DialogContent
          sx={{
            position: "relative",
            p: { xs: 1.5, md: 2 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: { xs: 240, md: 380 },
          }}
        >
          <IconButton
            onClick={() => setPreviewImage(null)}
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 1,
              backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.9),
              "&:hover": {
                backgroundColor: (theme) => alpha(theme.palette.background.paper, 1),
              },
            }}
            aria-label="Cerrar vista de imagen"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
          {previewImage && (
            <Box
              component="img"
              src={previewImage.src}
              alt={previewImage.name}
              sx={{
                width: "100%",
                maxWidth: "min(1200px, 92vw)",
                maxHeight: "82vh",
                objectFit: "contain",
                borderRadius: 1,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Stack spacing={1.1}>
        {visibleItems.length === 0 ? (
          <Card variant="outlined" sx={{ borderColor: "divider" }}>
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Sin registros todavía.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Los comentarios, adjuntos y cambios aparecerán acá.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          visibleItems.map((item) => {
            const body = item.body.trim();
            const secondaryText = item.secondaryText?.trim() ?? "";
            const elapsed = formatElapsedTime(item.date);
            const canEditItem =
              item.kind === "comment" && item.editable && Boolean(item.commentId) && canEditEntries && Boolean(onEditEntry);
            const dateLabel = elapsed ? `${formatDate(item.date)} · ${elapsed}` : formatDate(item.date);
            return (
            <Card key={item.id} variant="outlined" sx={{ borderColor: (theme) => alpha(theme.palette.divider, 0.85) }}>
              <CardContent sx={{ display: "grid", gap: 0.9, p: 1.35 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {dateLabel}
                  </Typography>
                  {canEditItem ? (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => handleStartEditing(item.commentId as string, item.body)}
                      disabled={submitting}
                      sx={{ minWidth: 0, px: 0.75, py: 0.2, fontSize: 12 }}
                    >
                      Editar
                    </Button>
                  ) : null}
                </Stack>

                {item.kind === "status" ? (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {body}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      {item.previousStatus ? <StatusBadge value={item.previousStatus} /> : <Chip label="Tarea creada" size="small" variant="outlined" />}
                      <Typography color="text.secondary">→</Typography>
                      {item.nextStatus ? <StatusBadge value={item.nextStatus} /> : <Chip label="sin dato" size="small" variant="outlined" />}
                    </Stack>
                    {secondaryText ? <Box>{renderMarkdownContent(secondaryText)}</Box> : null}
                  </>
                ) : null}

                {item.kind === "rename" ? (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {body}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      "{item.previousName}" → "{item.nextName}"
                    </Typography>
                    {secondaryText ? <Box>{renderMarkdownContent(secondaryText)}</Box> : null}
                  </>
                ) : null}

                {item.kind === "comment" ? (
                  <>
                    {body ? (
                      <Box>{renderMarkdownContent(body)}</Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Adjunto agregado
                      </Typography>
                    )}
                    {secondaryText ? <Box>{renderMarkdownContent(secondaryText)}</Box> : null}
                  </>
                ) : null}

                {item.attachments.length > 0 && (
                  <AttachmentList
                    attachments={item.attachments}
                    onOpenImage={(attachment) =>
                      setPreviewImage({
                        name: attachment.nombre,
                        src: `data:${attachment.content_type};base64,${attachment.content_base64}`,
                      })
                    }
                  />
                )}
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
  onOpenImage?: (attachment: Attachment) => void;
};

function AttachmentList({ attachments, onOpenImage }: AttachmentListProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(200px, 1fr))" },
      }}
    >
      {attachments.map((attachment) => {
        const dataUrl = `data:${attachment.content_type};base64,${attachment.content_base64}`;
        const isImage = attachment.content_type.startsWith("image/");
        const canPreviewImage = isImage && Boolean(onOpenImage);
        return (
          <Card
            key={attachment.id}
            variant="outlined"
            sx={{ textDecoration: "none", borderColor: (theme) => alpha(theme.palette.divider, 0.85) }}
            {...(canPreviewImage
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: () => onOpenImage?.(attachment),
                  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenImage?.(attachment);
                    }
                  },
                }
              : {
                  component: "a",
                  href: dataUrl,
                  download: attachment.nombre,
                  target: "_blank",
                  rel: "noreferrer",
                })}
          >
            <CardContent sx={{ display: "grid", gap: 1, p: 1.25 }}>
              {isImage ? (
                <Box
                  component="img"
                  src={dataUrl}
                  alt={attachment.nombre}
                  sx={{
                    width: "100%",
                    maxHeight: 170,
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
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {attachment.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
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
