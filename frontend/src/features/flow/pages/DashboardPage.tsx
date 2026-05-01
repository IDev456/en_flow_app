import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listActiveWorkflows, listPendingSteps } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, WorkflowSummary } from "../types";
import { formatDate } from "../utils";

export function DashboardPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const [workflowData, stepData] = await Promise.all([listActiveWorkflows(), listPendingSteps()]);
      setWorkflows(workflowData);
      setSteps(stepData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <section className="hero-panel">
        <div>
          <p className="section-eyebrow">Vista operativa</p>
          <h2>Workflows en marcha y pasos abiertos.</h2>
          <p className="page-subtitle">
            Seguimiento rapido del frente activo para decidir sobre que flujo intervenir ahora.
          </p>
        </div>
        {loading && <p className="status">Cargando informacion...</p>}
        {error && <p className="inline-error">{error}</p>}
        {!loading && !error && (
          <div className="stats-row">
            <article className="stat-card">
              <strong>{workflows.length}</strong>
              <span>Workflows activos</span>
            </article>
            <article className="stat-card">
              <strong>{steps.length}</strong>
              <span>Pasos abiertos</span>
            </article>
          </div>
        )}
      </section>

      <section className="surface-panel">
        <div className="panel-header-row">
          <h3>Workflows activos</h3>
        </div>
        {workflows.length === 0 && !loading ? (
          <p className="status">Todavia no hay workflows activos.</p>
        ) : (
          <ul className="card-stack">
            {workflows.map((workflow) => (
              <li key={workflow.id} className="flow-card">
                <div className="entity-card-head">
                  <div>
                    <h3>{workflow.workflow_template_nombre}</h3>
                    <p className="muted">Paso actual: {workflow.paso_actual ?? "sin paso activo"}</p>
                  </div>
                  <StatusBadge value={workflow.estado} />
                </div>
                <p className="muted">Inicio: {formatDate(workflow.fecha_inicio)}</p>
                <Link className="text-link" to={`/workflows/${workflow.id}`}>
                  Abrir workflow
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-panel">
        <div className="panel-header-row">
          <h3>Pasos pendientes o activos</h3>
        </div>
        {steps.length === 0 && !loading ? (
          <p className="status">No hay pasos abiertos.</p>
        ) : (
          <ul className="card-stack">
            {steps.map((step) => (
              <li key={step.id} className="flow-card compact-card">
                <div className="entity-card-head">
                  <div>
                    <h3>
                      Paso {step.orden}: {step.nombre}
                    </h3>
                    <p className="muted">Workflow: {step.workflow_id}</p>
                  </div>
                  <StatusBadge value={step.estado} />
                </div>
                <Link className="text-link" to={`/steps/${step.id}`}>
                  Revisar paso
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
