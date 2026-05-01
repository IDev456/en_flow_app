import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { addStepComment, completeStep, getStep, getStepComments, getStepHistory, updateStepStatus } from "../api";
import { StepDetailPanel } from "../components/StepDetailPanel";
import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
import { DEFAULT_ACTOR } from "../utils";

export function StepDetailPage() {
  const { stepId = "" } = useParams();
  const [step, setStep] = useState<Step | null>(null);
  const [comments, setComments] = useState<StepComment[]>([]);
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStepData();
  }, [stepId]);

  async function loadStepData() {
    try {
      setLoading(true);
      setError(null);
      const [stepData, commentsData, historyData] = await Promise.all([
        getStep(stepId),
        getStepComments(stepId),
        getStepHistory(stepId)
      ]);
      setStep(stepData);
      setComments(commentsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el paso");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    if (!step) return;

    if (!input.estado) {
      await addStepComment(step.id, { autor: DEFAULT_ACTOR, comentario: input.comentario });
      await loadStepData();
      return;
    }

    if (input.estado === "completado") {
      await completeStep(step.id, {
        usuario: DEFAULT_ACTOR,
        comentario: input.comentario,
        resultado: null,
        observaciones: null,
        siguiente_paso: input.siguiente_paso
          ? {
              nombre: input.siguiente_paso.nombre,
              descripcion: input.siguiente_paso.descripcion ?? null
            }
          : null,
        finalizar_workflow: Boolean(input.finalizar_workflow)
      });
      await loadStepData();
      return;
    }

    await updateStepStatus(step.id, { estado: input.estado, usuario: DEFAULT_ACTOR, nota: input.comentario });
    await loadStepData();
  }

  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner" />
        Cargando paso...
      </div>
    );
  }

  if (error && !step) {
    return (
      <div className="error-state">
        <span>⚠</span>
        {error}
      </div>
    );
  }

  return (
    <div className="step-detail-page">
      <div className="view-breadcrumbs">
        <Link className="text-link" to="/triggers">Requerimientos</Link>
        {step && (
          <>
            <span className="bc-sep">›</span>
            <Link className="text-link" to={`/workflows/${step.workflow_id}`}>
              Workflow
            </Link>
          </>
        )}
        <span className="bc-sep">›</span>
        <strong>Paso</strong>
      </div>

      <StepDetailPanel
        workflowId={step?.workflow_id ?? ""}
        step={step}
        comments={comments}
        history={history}
        standalone
        error={error}
        onSubmitJournal={handleSubmitJournal}
      />
    </div>
  );
}
