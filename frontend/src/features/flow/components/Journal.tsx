import { useEffect, useMemo, useRef, useState } from "react";

import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
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
  const [text, setText] = useState("");
  const [completionMode, setCompletionMode] = useState<"next" | "finish">("next");
  const [nextStepName, setNextStepName] = useState("");
  const [nextStepDescription, setNextStepDescription] = useState("");
  const [showNextStepDescription, setShowNextStepDescription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const items = useMemo(() => buildJournalItems(history, comments), [history, comments]);
  const MAX_CHARS = 1000;
  const isCompleting = selectedStatus === "completado";
  const canComment = step.puede_tener_comentarios;
  const missingComment = text.trim().length === 0;
  const missingNextStep = isCompleting && completionMode === "next" && nextStepName.trim().length === 0;

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
    !submitting;

  async function handleSubmit() {
    const comentario = text.trim();
    if (!comentario) {
      setError("Debes escribir un comentario para registrarlo en la bitacora.");
      return;
    }

    if (!canComment) {
      setError("Este paso no admite comentarios.");
      return;
    }

    if (selectedStatus && comentario.length < 3) {
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
      onSelectedStatusChange("");
      setCompletionMode("next");
      setNextStepName("");
      setNextStepDescription("");
      setShowNextStepDescription(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && text.trim() && !submitting) {
      void handleSubmit();
    }
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
    return "Escribe una nota para la bitacora...";
  }

  return (
    <div className="journal">
      <div ref={composerRef} className="journal-composer">
        <label htmlFor="step-comment">Agregar comentario</label>
        <textarea
          ref={textareaRef}
          id="step-comment"
          rows={3}
          placeholder={getCommentPlaceholder()}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => onComposerExpandedChange(true)}
          onClick={() => onComposerExpandedChange(true)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_CHARS}
          disabled={!canComment || submitting}
        />

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
                      onSelectedStatusChange(active ? "" : (option.value as "" | "espera" | "problema" | "completado"));
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
            <p>Los comentarios y cambios de estado mas recientes apareceran primero.</p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="journal-item">
              <div className="journal-item-head">
                <span>{formatDate(item.date)}</span>
                {item.kind === "status" && <StatusBadge value={item.status} />}
              </div>
              <p>{item.body}</p>
            </article>
          ))
        )}
      </div>
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
          <small style={{ display: "block", marginTop: "0.4rem" }}>{entry.usuario}</small>
          {entry.nota && <blockquote>{entry.nota}</blockquote>}
        </article>
      ))}
    </div>
  );
}
