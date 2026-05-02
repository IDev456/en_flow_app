import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";

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
  onSubmitJournal
}: StepDetailPanelProps) {
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [selectedStatus, setSelectedStatus] = useState<"" | "espera" | "problema" | "completado">("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [focusRequestToken, setFocusRequestToken] = useState(0);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!step) {
      return;
    }
    setSelectedStatus("");
    setComposerExpanded(false);
    setStatusMenuOpen(false);
  }, [step?.id]);

  if (!step) {
    return (
      <section className={getPanelClassName(standalone, drawer)}>
        <div className="step-panel-empty">
          <h3>Sin paso seleccionado</h3>
          <p>Selecciona un paso del flujo para revisar su bitacora y propiedades.</p>
        </div>
      </section>
    );
  }

  const noteCount = history.filter((entry) => entry.campo === "estado" && entry.nota).length;
  const canChangeStatus = ["activo", "espera", "problema"].includes(step.estado);

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    await onSubmitJournal(input);
    setSelectedStatus("");
    setComposerExpanded(false);
    setStatusMenuOpen(false);
  }

  function handleStatusIntent(status: "" | "espera" | "problema" | "completado") {
    setSelectedStatus(status);
    setComposerExpanded(true);
    setStatusMenuOpen(false);
    setFocusRequestToken((value) => value + 1);
  }

  return (
    <section className={getPanelClassName(standalone, drawer)} onPointerDown={(event) => event.stopPropagation()}>
      <div className="step-panel-head">
        <div className="step-panel-head-row">
          <div className="step-panel-breadcrumb">
            <code>{workflowId.slice(0, 8)}</code>
            <span> / </span>
            <code>{step.id.slice(0, 8)}</code>
          </div>
          {drawer && onClose && (
            <button type="button" className="step-panel-close" onClick={onClose} aria-label="Cerrar detalle del paso">
              ×
            </button>
          )}
        </div>
        <h3>{step.nombre}</h3>
        {step.descripcion && <p>{step.descripcion}</p>}
        <div className="step-panel-badges">
          <div ref={statusMenuRef} className="status-badge-menu">
            <button
              type="button"
              className="status-badge-button"
              onClick={() => canChangeStatus && setStatusMenuOpen((value) => !value)}
              disabled={!canChangeStatus}
              aria-haspopup="menu"
              aria-expanded={statusMenuOpen}
            >
              <StatusBadge value={step.estado} />
            </button>
            {statusMenuOpen && canChangeStatus && (
              <div className="status-popover" role="menu">
                <button type="button" className="status-popover-item" onClick={() => handleStatusIntent("espera")}>
                  En espera
                </button>
                <button type="button" className="status-popover-item" onClick={() => handleStatusIntent("problema")}>
                  Problema
                </button>
                <button type="button" className="status-popover-item" onClick={() => handleStatusIntent("completado")}>
                  Completado
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="step-panel-tabs">
        <span className="step-tab active">
          {noteCount + comments.length > 0 ? `Bitacora (${noteCount + comments.length})` : "Bitacora"}
        </span>
      </div>

      <div className="step-panel-body">
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
      </div>

      {error && (
        <div className="error-state" style={{ margin: "0.75rem 1.15rem" }}>
          <span>!</span>
          {error}
        </div>
      )}

      {standalone && (
        <div className="step-panel-links">
          <Link className="text-link" to={`/workflows/${workflowId}`}>
            {"<-"} Volver al workflow
          </Link>
        </div>
      )}
    </section>
  );
}

function getPanelClassName(standalone: boolean, drawer: boolean) {
  if (standalone) {
    return "step-panel standalone";
  }
  if (drawer) {
    return "step-panel drawer";
  }
  return "step-panel";
}
