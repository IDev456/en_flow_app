import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { completeStep, getTrigger, getWorkflow } from "../api";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { WorkflowInspector } from "../components/WorkflowInspector";
import { WorkflowVariantSwitcher, type WorkflowVariant } from "../components/WorkflowVariantSwitcher";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import { formatDate } from "../utils";

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [variant, setVariant] = useState<WorkflowVariant>("vertical");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadWorkflow();
  }, [workflowId]);

  async function loadWorkflow() {
    try {
      setLoading(true);
      setError(null);
      const workflowData = await getWorkflow(workflowId);
      setWorkflow(workflowData);
      setSelectedStepId((current) => current ?? workflowData.steps.find((step) => step.estado === "activo")?.id ?? workflowData.steps[0]?.id ?? null);
      setTrigger(await getTrigger(workflowData.trigger_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el workflow");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteStep(payload: {
    usuario: string;
    resultado: string | null;
    observaciones: string | null;
    comentario_final: string | null;
  }) {
    if (!selectedStepId) {
      return;
    }

    await completeStep(selectedStepId, payload);
    const updatedWorkflow = await getWorkflow(workflowId);
    setWorkflow(updatedWorkflow);
    const activeStep = updatedWorkflow.steps.find((step) => step.estado === "activo");
    setSelectedStepId(activeStep?.id ?? selectedStepId);
    setTrigger(await getTrigger(updatedWorkflow.trigger_id));
  }

  if (loading) {
    return <p className="status">Cargando workflow...</p>;
  }

  if (error) {
    return <p className="inline-error">{error}</p>;
  }

  if (!workflow) {
    return <p className="status">Workflow no encontrado.</p>;
  }

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? workflow.steps[0] ?? null;

  return (
    <div className="workflow-page">
      <section className="workflow-header">
        <div className="workflow-heading">
          <div className="workflow-heading-meta">
            <code>{workflow.id.slice(0, 8)}</code>
            <span>{workflow.workflow_template_nombre}</span>
          </div>
          <div>
            <h2>{trigger?.titulo ?? `Trigger ${workflow.trigger_id}`}</h2>
            <p className="page-subtitle">{trigger?.descripcion ?? workflow.resolucion_esperada ?? "Workflow en ejecucion"}</p>
          </div>
        </div>
        <div className="workflow-heading-actions">
          <StatusBadge value={workflow.estado} />
          <Link className="text-link" to={`/triggers/${workflow.trigger_id}`}>
            Ver disparador origen
          </Link>
        </div>
      </section>

      <section className="workflow-meta-bar">
        <div>
          <span>Paso actual</span>
          <strong>{workflow.paso_actual ?? "Finalizado"}</strong>
        </div>
        <div>
          <span>Inicio</span>
          <strong>{formatDate(workflow.fecha_inicio)}</strong>
        </div>
        <div>
          <span>Fin</span>
          <strong>{formatDate(workflow.fecha_fin)}</strong>
        </div>
        <div>
          <span>Objetivo final</span>
          <strong>{workflow.objetivo_final ?? "No definido"}</strong>
        </div>
      </section>

      <section className="workflow-content-grid">
        <div className="surface-panel workflow-surface">
          <div className="panel-header-row split">
            <h3>Visualizacion del flujo</h3>
            <WorkflowVariantSwitcher value={variant} onChange={setVariant} />
          </div>
          <WorkflowGraph
            variant={variant}
            triggerLabel={trigger?.tipo ?? "disparador"}
            steps={workflow.steps}
            workflowClosed={workflow.estado === "finalizado"}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
          />
        </div>

        <WorkflowInspector workflowId={workflow.id} step={selectedStep} onComplete={handleCompleteStep} />
      </section>
    </div>
  );
}
