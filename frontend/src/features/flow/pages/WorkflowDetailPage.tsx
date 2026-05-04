import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  addStepComment,
  completeStep,
  getStepComments,
  getStepHistory,
  getTrigger,
  getWorkflow,
  updateStepStatus
} from "../api";
import { StepDetailPanel } from "../components/StepDetailPanel";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { WorkflowVariantSwitcher, type WorkflowVariant } from "../components/WorkflowVariantSwitcher";
import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput, TriggerDetail, WorkflowDetail } from "../types";
import { DEFAULT_ACTOR, formatDate, humanizeStatus } from "../utils";

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stepComments, setStepComments] = useState<StepComment[]>([]);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [variant, setVariant] = useState<WorkflowVariant>("vertical");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequesterLabel() {
    return trigger?.solicitante?.trim() || "Sin solicitante";
  }

  useEffect(() => {
    void loadWorkflow();
  }, [workflowId]);

  useEffect(() => {
    if (selectedStepId) {
      void loadStepSideData(selectedStepId);
    } else {
      setStepComments([]);
      setStepHistory([]);
    }
  }, [selectedStepId]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelOpen]);

  async function loadWorkflow(preferredStepId?: string) {
    try {
      setLoading(true);
      setError(null);
      const workflowData = await getWorkflow(workflowId);
      setWorkflow(workflowData);
      const stepExistsInWorkflow = workflowData.steps.some((step) => step.id === selectedStepId);
      const nextSelectedStepId =
        preferredStepId ??
        (stepExistsInWorkflow ? selectedStepId : null) ??
        workflowData.steps.find((step) => step.estado === "activo")?.id ??
        workflowData.steps[0]?.id ??
        null;
      setSelectedStepId(nextSelectedStepId);
      setTrigger(await getTrigger(workflowData.trigger_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el workflow");
    } finally {
      setLoading(false);
    }
  }

  async function loadStepSideData(stepId: string) {
    try {
      setPanelError(null);
      const [comments, history] = await Promise.all([getStepComments(stepId), getStepHistory(stepId)]);
      setStepComments(comments);
      setStepHistory(history);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "No se pudo cargar la bitacora del paso");
    }
  }

  async function refreshAfterStepChange(preferredStepId?: string) {
    await loadWorkflow(preferredStepId);
    if (preferredStepId) {
      await loadStepSideData(preferredStepId);
    }
  }

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    if (!selectedStepId) return;

    if (!input.estado) {
      await addStepComment(selectedStepId, {
        autor: DEFAULT_ACTOR,
        comentario: input.comentario,
        attachments: input.attachments ?? []
      });
      await loadStepSideData(selectedStepId);
      return;
    }

    if (input.estado === "completado") {
      await completeStep(selectedStepId, {
        usuario: DEFAULT_ACTOR,
        comentario: input.comentario ?? "",
        resultado: null,
        observaciones: null,
        attachments: input.attachments ?? [],
        siguiente_paso: input.siguiente_paso
          ? {
              nombre: input.siguiente_paso.nombre,
              descripcion: input.siguiente_paso.descripcion ?? null
            }
          : null,
        finalizar_workflow: Boolean(input.finalizar_workflow)
      });
      const currentWorkflow = await getWorkflow(workflowId);
      const nextActiveStep = currentWorkflow.steps.find((step) => step.estado === "activo");
      await refreshAfterStepChange(nextActiveStep?.id ?? selectedStepId);
      return;
    }

    await updateStepStatus(selectedStepId, {
      estado: input.estado,
      usuario: DEFAULT_ACTOR,
      nota: input.comentario,
      attachments: input.attachments ?? []
    });
    await refreshAfterStepChange(selectedStepId);
  }

  function handleSelectStep(stepId: string) {
    setSelectedStepId(stepId);
  }

  function handleOpenStep(stepId: string) {
    setSelectedStepId(stepId);
    setPanelOpen(true);
  }

  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner" />
        Cargando workflow...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <span>!</span>
        {error}
      </div>
    );
  }

  if (!workflow) {
    return <p className="status">Workflow no encontrado.</p>;
  }

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? workflow.steps[0] ?? null;

  return (
    <div className="workflow-page">
      <div className="view-breadcrumbs">
        <Link className="text-link" to="/triggers">Requerimientos</Link>
        <span className="bc-sep">{">"}</span>
        <Link className="text-link" to={`/triggers/${workflow.trigger_id}`}>
          {getPrimaryRequirementLabel()}
        </Link>
        <span className="bc-sep">{">"}</span>
        <strong>Workflow</strong>
      </div>

      <section className="workflow-topbar">
        <div>
          <div className="workflow-breadcrumb">
            <span>{workflow.workflow_template_nombre}</span>
            <span className="workflow-breadcrumb-sep">·</span>
            <span className="workflow-state-inline">{humanizeStatus(workflow.estado)}</span>
          </div>
          <h2>{getPrimaryRequirementLabel()}</h2>
          <p className="page-subtitle">Solicitante: {getSecondaryRequesterLabel()}</p>
        </div>
      </section>

      <section className="workflow-meta-strip">
        <div>
          <span>Paso actual</span>
          <strong>{workflow.paso_actual ?? "Finalizado"}</strong>
        </div>
        <div>
          <span>Inicio</span>
          <strong>{formatDate(workflow.fecha_inicio)}</strong>
        </div>
        <div>
          <span>Cierre</span>
          <strong>{formatDate(workflow.fecha_fin)}</strong>
        </div>
        <div>
          <span>Objetivo</span>
          <strong>{workflow.objetivo_final ?? "Sin definir"}</strong>
        </div>
      </section>

      <section className={panelOpen && selectedStep ? "workflow-stage open" : "workflow-stage"}>
        {panelOpen && selectedStep && (
          <StepDetailPanel
            workflowId={workflow.id}
            step={selectedStep}
            comments={stepComments}
            history={stepHistory}
            drawer
            error={panelError}
            onClose={() => setPanelOpen(false)}
            onSubmitJournal={handleSubmitJournal}
          />
        )}

        <div className="surface-panel workflow-canvas" onPointerDown={() => panelOpen && setPanelOpen(false)}>
          <div className="panel-header-row">
            <div>
              <h3>Flujo</h3>
              <p className="muted">Vista secuencial de los pasos habilitados por este requerimiento.</p>
            </div>
            <WorkflowVariantSwitcher value={variant} onChange={setVariant} />
          </div>

          <WorkflowGraph
            variant={variant}
            triggerLabel={getPrimaryRequirementLabel()}
            steps={workflow.steps}
            workflowClosed={workflow.estado === "finalizado"}
            selectedStepId={selectedStepId}
            onSelectStep={handleSelectStep}
            onOpenStep={handleOpenStep}
            onOpenTrigger={() => navigate(`/triggers/${workflow.trigger_id}`)}
          />
        </div>
      </section>
    </div>
  );
}
