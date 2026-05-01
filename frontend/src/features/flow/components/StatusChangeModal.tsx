import { useEffect, useRef, useState } from "react";

import type { Step, StepStatus } from "../types";
import { stepStatusOptions } from "../utils";

import { StatusBadge } from "./StatusBadge";

type StatusChangeModalProps = {
  open: boolean;
  step: Step | null;
  targetStatus: StepStatus | null;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
};

export function StatusChangeModal({
  open,
  step,
  targetStatus,
  onCancel,
  onConfirm
}: StatusChangeModalProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setSubmitting(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, targetStatus]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open || !step || !targetStatus) {
    return null;
  }

  const option = stepStatusOptions.find((item) => item.value === targetStatus);
  const requiresNote = option?.requiresNote ?? false;
  const isValid = !requiresNote || note.trim().length >= 3;
  const charCount = note.trim().length;

  async function handleConfirm() {
    if (!isValid) return;
    try {
      setSubmitting(true);
      await onConfirm(note.trim());
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && isValid && !submitting) {
      void handleConfirm();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-copy">
          <span className="modal-kicker">
            {targetStatus === "completado" ? "Completar paso" : "Cambiar estado"}
          </span>
          <div className="status-transition">
            <StatusBadge value={step.estado} />
            <span className="status-arrow">→</span>
            <StatusBadge value={targetStatus} />
          </div>
          <p style={{ marginTop: "0.65rem" }}>
            La nota queda registrada en la bitácora del paso.
          </p>
        </div>

        <label className="modal-field">
          {requiresNote ? "Nota del cambio *" : "Nota del cambio (opcional)"}
          <textarea
            ref={textareaRef}
            rows={4}
            placeholder={option?.placeholder ?? "Describe brevemente el motivo del cambio..."}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-invalid={requiresNote && charCount < 3}
          />
          {requiresNote && (
            <span className={`char-counter ${charCount < 3 ? 'error' : 'success'}`}>
              {charCount} / 3 caracteres mínimo
            </span>
          )}
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void handleConfirm()}
            disabled={!isValid || submitting}
          >
            {submitting ? "Guardando..." : targetStatus === "completado" ? "Completar paso" : "Confirmar"}
          </button>
        </div>

        <p className="char-hint" style={{ textAlign: "right", marginTop: "-0.25rem" }}>
          Ctrl + Enter para confirmar
        </p>
      </div>
    </div>
  );
}
