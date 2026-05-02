import { useEffect, useMemo, useRef, useState } from "react";

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
  onSubmitEntry
}: JournalProps) {
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const canSubmit =
    canComment &&
    !missingComment &&
    !missingNextStep &&
    !insufficientLength &&
    !submitting;

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
      preview_url: dataUrl
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
          content_base64: item.content_base64
        })),
        siguiente_paso:
          isCompleting && completionMode === "next"
            ? {
                nombre: nextStepName.trim(),
                descripcion: nextStepDescription.trim() || null
              }
            : null,
        finalizar_workflow: isCompleting && completionMode === "finish"
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canSubmit) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    <div className="journal">
      <div ref={composerRef} className="journal-composer">
        <label htmlFor="step-comment">Agregar comentario</label>

        <textarea
          ref={textareaRef}
          id="step-comment"
          rows={4}
          placeholder={getCommentPlaceholder()}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => onComposerExpandedChange(true)}
          onClick={() => onComposerExpandedChange(true)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => void handlePaste(event)}
          maxLength={MAX_CHARS}
          disabled={!canComment || submitting}
        />

        <div className="attachment-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="visually-hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="secondary-action"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canComment || submitting}
          >
            Adjuntar archivos
          </button>
          <span className="attachment-hint">Tambien puedes pegar una imagen desde el portapapeles.</span>
        </div>

        {attachments.length > 0 && (
          <div className="attachment-draft-list">
            {attachments.map((attachment) => (
              <article key={attachment.local_id} className="attachment-draft-card">
                <div className="attachment-draft-head">
                  <strong>{attachment.nombre}</strong>
                  <button type="button" className="text-action" onClick={() => handleRemoveAttachment(attachment.local_id)}>
                    Quitar
                  </button>
                </div>
                {attachment.content_type.startsWith("image/") ? (
                  <img className="attachment-preview-image" src={attachment.preview_url} alt={attachment.nombre} />
                ) : (
                  <p className="muted">{formatFileSize(attachment.size_bytes)}</p>
                )}
              </article>
            ))}
          </div>
        )}

        {composerExpanded && canChangeStatus && (
          <div className="journal-status-actions">
            <span className="composer-section-label">Cambiar estado</span>
            <div className="status-chip-row">
              {stepStatusOptions.map((option) => {
                const active = selectedStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={active ? "status-chip active" : "status-chip"}
                    onClick={() => {
                      onSelectedStatusChange(active ? "" : option.value);
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    <span className={`status-dot ${option.value}`} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isCompleting && composerExpanded && (
          <div className="completion-config">
            <span className="composer-section-label">Al completar este paso</span>
            <div className="completion-choice-group">
              <label className={completionMode === "next" ? "completion-choice active" : "completion-choice"}>
                <input
                  type="radio"
                  name="completion-mode"
                  value="next"
                  checked={completionMode === "next"}
                  onChange={() => setCompletionMode("next")}
                />
                <span>Crear siguiente paso</span>
              </label>
              <label className={completionMode === "finish" ? "completion-choice active" : "completion-choice"}>
                <input
                  type="radio"
                  name="completion-mode"
                  value="finish"
                  checked={completionMode === "finish"}
                  onChange={() => setCompletionMode("finish")}
                />
                <span>Finalizar flow</span>
              </label>
            </div>

            {completionMode === "next" ? (
              <div className="completion-next-step">
                <div className="completion-next-step-main">
                  <label>
                    Siguiente paso *
                    <input
                      type="text"
                      value={nextStepName}
                      onChange={(event) => setNextStepName(event.target.value)}
                      placeholder="Ej: Verificacion con el solicitante"
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={() => setShowNextStepDescription((value) => !value)}
                  >
                    {showNextStepDescription ? "Ocultar detalle" : "Sumar detalle"}
                  </button>
                </div>
                {showNextStepDescription && (
                  <label className="completion-next-step-detail">
                    Detalle del siguiente paso
                    <textarea
                      rows={2}
                      value={nextStepDescription}
                      onChange={(event) => setNextStepDescription(event.target.value)}
                      placeholder="Describe que debera hacerse a continuacion..."
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="completion-finish-card">
                <strong>Finalizar workflow</strong>
                <p>Este paso se cerrara y el requerimiento quedara resuelto.</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="inline-error">{error}</p>}

        <div className="journal-composer-footer composer-footer">
          <button type="button" className="primary-action" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? "Guardando..." : getSubmitLabel()}
          </button>
        </div>
      </div>

      <div className="journal-list">
        {items.length === 0 ? (
          <div className="journal-empty">
            <strong>Sin movimientos todavia</strong>
            <p>Los comentarios, archivos y cambios de estado mas recientes apareceran primero.</p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="journal-item">
              <div className="journal-item-head">
                <span>{formatDate(item.date)}</span>
                {item.kind === "status" && <StatusBadge value={item.status} />}
              </div>
              {item.body && <p>{item.body}</p>}
              {item.attachments.length > 0 && <AttachmentList attachments={item.attachments} />}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type AttachmentListProps = {
  attachments: Attachment[];
};

function AttachmentList({ attachments }: AttachmentListProps) {
  return (
    <div className="attachment-list">
      {attachments.map((attachment) => {
        const dataUrl = `data:${attachment.content_type};base64,${attachment.content_base64}`;
        const isImage = attachment.content_type.startsWith("image/");
        return (
          <a
            key={attachment.id}
            className={isImage ? "attachment-card image" : "attachment-card"}
            href={dataUrl}
            download={attachment.nombre}
            target="_blank"
            rel="noreferrer"
          >
            {isImage ? (
              <img className="attachment-preview-image" src={dataUrl} alt={attachment.nombre} />
            ) : (
              <div className="attachment-file-icon">FILE</div>
            )}
            <div className="attachment-meta">
              <strong>{attachment.nombre}</strong>
              <span>{formatFileSize(attachment.size_bytes)}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

type HistoryListProps = {
  history: StepHistoryEntry[];
};

export function HistoryList({ history }: HistoryListProps) {
  if (history.length === 0) {
    return <p className="status">Todavia no hay historial registrado.</p>;
  }

  return (
    <div className="history-list">
      {history.map((entry) => (
        <article key={entry.id} className="history-item">
          <div className="history-item-head">
            <strong>{entry.campo === "estado" ? "Cambio de estado" : entry.campo}</strong>
            <span>{formatDate(entry.fecha)}</span>
          </div>
          <div className="status-transition" style={{ marginTop: "0.4rem" }}>
            {entry.valor_anterior ? <StatusBadge value={entry.valor_anterior} /> : <span className="ghost-badge">vacio</span>}
            <span className="status-arrow">-&gt;</span>
            {entry.valor_nuevo ? <StatusBadge value={entry.valor_nuevo} /> : <span className="ghost-badge">vacio</span>}
          </div>
          {entry.nota && <blockquote>{entry.nota}</blockquote>}
          {entry.attachments.length > 0 && <AttachmentList attachments={entry.attachments} />}
        </article>
      ))}
    </div>
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
