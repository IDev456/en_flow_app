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
    <div className="dashboard-page">
      <section className="hero-panel">
        <div>
          <span className="page-chip">Vista operativa</span>
          <h2>Workflows activos y pasos abiertos</h2>
          <p className="page-subtitle">
            Deteccion rapida de que flujo necesita atencion y en que estado esta cada paso.
          </p>
        </div>

        {loading && (
          <div className="loading-state" style={{ padding: "1.5rem 0 0" }}>
            <span className="spinner" />
            Cargando informacion...
          </div>
        )}
        {error && (
          <div className="error-state" style={{ marginTop: "1rem" }}>
            <span>⚠</span>
            {error}
          </div>
        )}
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

      {!loading && !error && (
        <div className="dashboard-grid">
          <section className="surface-panel">
            <div className="panel-header-row">
              <h3>Workflows activos</h3>
              <Link className="text-link" to="/triggers">Ver todos</Link>
            </div>
            <div className="dashboard-list">
              {workflows.length === 0 ? (
                <p className="status">Todavia no hay workflows activos.</p>
              ) : (
                workflows.map((workflow) => (
                  <article key={workflow.id} className="dashboard-item">
                    <div>
                      <strong>{workflow.workflow_template_nombre}</strong>
                      <p>Paso actual: {workflow.paso_actual ?? "sin paso activo"}</p>
                    </div>
                    <div className="dashboard-item-side">
                      <StatusBadge value={workflow.estado} />
                      <Link className="mini-link" to={`/workflows/${workflow.id}`}>
                        Abrir
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="surface-panel">
            <div className="panel-header-row">
              <h3>Pasos abiertos</h3>
            </div>
            <div className="dashboard-list">
              {steps.length === 0 ? (
                <p className="status">No hay pasos abiertos.</p>
              ) : (
                steps.map((step) => (
                  <article key={step.id} className="dashboard-item">
                    <div>
                      <strong>
                        Paso {step.orden}: {step.nombre}
                      </strong>
                      <p>
                        {step.asignado_a ?? "Sin asignar"} · {formatDate(step.fecha_vencimiento)}
                      </p>
                    </div>
                    <div className="dashboard-item-side">
                      <StatusBadge value={step.estado} />
                      <Link className="mini-link" to={`/steps/${step.id}`}>
                        Revisar
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
