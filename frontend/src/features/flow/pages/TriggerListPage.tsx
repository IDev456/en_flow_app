import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getWorkflow, listTriggers, startWorkflow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Trigger, WorkflowDetail } from "../types";
import { formatDate, formatProgress, priorityLabel } from "../utils";

export function TriggerListPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [workflowDetailsById, setWorkflowDetailsById] = useState<Record<string, WorkflowDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const navigate = useNavigate();

  useEffect(() => {
    void loadTriggers();
  }, []);

  async function loadTriggers() {
    try {
      setLoading(true);
      setError(null);
      const triggerData = await listTriggers();
      setTriggers(triggerData);
      const workflowIds = triggerData
        .map((trigger) => trigger.workflow_activo_id)
        .filter((workflowId): workflowId is string => Boolean(workflowId));
      const details = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));
      setWorkflowDetailsById(Object.fromEntries(details.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los disparadores");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWorkflow(trigger: Trigger) {
    try {
      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: `Resolver ${trigger.titulo}`,
        resolucion_esperada: "Caso resuelto y verificado"
      });
      setTriggers((current) =>
        current.map((item) =>
          item.id === trigger.id
            ? {
                ...item,
                estado_general: "en_proceso",
                workflow_activo_id: workflow.id
              }
            : item
        )
      );
      setWorkflowDetailsById((current) => ({ ...current, [workflow.id]: workflow }));
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el workflow");
    }
  }

  const filteredTriggers = triggers.filter((trigger) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (filter === "active" && trigger.estado_general !== "en_proceso") {
      return false;
    }
    if (filter === "done" && trigger.estado_general !== "resuelto") {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      trigger.titulo.toLowerCase().includes(normalizedQuery) ||
      trigger.id.toLowerCase().includes(normalizedQuery) ||
      trigger.tipo.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <section className="list-page">
      <div className="list-page-head">
        <div>
          <h2>Requerimientos</h2>
          <p className="page-subtitle">
            Disparadores convertidos en flujos operativos con trazabilidad paso a paso.
          </p>
        </div>
        <Link className="primary-action-link" to="/triggers/new">
          Nuevo disparador
        </Link>
      </div>

      <div className="list-toolbar">
        <div className="search-field">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar requerimiento o ID..."
          />
        </div>
        <div className="segmented-control">
          <button
            type="button"
            className={filter === "all" ? "segment active" : "segment"}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          <button
            type="button"
            className={filter === "active" ? "segment active" : "segment"}
            onClick={() => setFilter("active")}
          >
            Activos
          </button>
          <button
            type="button"
            className={filter === "done" ? "segment active" : "segment"}
            onClick={() => setFilter("done")}
          >
            Completados
          </button>
        </div>
      </div>

      <section className="table-shell">
        <div className="table-head">
          <span>ID</span>
          <span>Requerimiento</span>
          <span>Disparador</span>
          <span>Progreso</span>
          <span>Prioridad</span>
          <span>Estado</span>
        </div>
        {loading && <p className="status padded">Cargando disparadores...</p>}
        {error && <p className="inline-error padded">{error}</p>}
        {!loading && filteredTriggers.length === 0 && <p className="status padded">No hay coincidencias.</p>}
        {filteredTriggers.map((trigger) => {
          const workflow = trigger.workflow_activo_id ? workflowDetailsById[trigger.workflow_activo_id] : undefined;
          const doneSteps = workflow?.steps.filter((step) => step.estado === "completado").length ?? 0;
          const totalSteps = workflow?.steps.length ?? 0;
          const progress = formatProgress(doneSteps, totalSteps);

          return (
            <article key={trigger.id} className="table-row">
              <span className="mono">{trigger.id.slice(0, 8)}</span>
              <div className="row-title-block">
                <Link className="row-link" to={trigger.workflow_activo_id ? `/workflows/${trigger.workflow_activo_id}` : `/triggers/${trigger.id}`}>
                  {trigger.titulo}
                </Link>
                <small>{trigger.descripcion ?? "Sin descripcion"}</small>
              </div>
              <span>{trigger.tipo}</span>
              <div className="progress-cell">
                <div className="progress-bar">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <small>
                  {doneSteps}/{totalSteps || 3}
                </small>
              </div>
              <span className="priority-pill">{priorityLabel(trigger.prioridad)}</span>
              <div className="row-status-actions">
                <StatusBadge value={trigger.estado_general} />
                {!trigger.workflow_activo_id && trigger.estado_general !== "resuelto" && (
                  <button type="button" className="mini-action" onClick={() => void handleStartWorkflow(trigger)}>
                    Iniciar
                  </button>
                )}
                {trigger.workflow_activo_id && (
                  <Link className="mini-link" to={`/workflows/${trigger.workflow_activo_id}`}>
                    Abrir
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="footnote">
        {triggers.filter((trigger) => trigger.estado_general === "en_proceso").length} activos ·{" "}
        {triggers.filter((trigger) => trigger.estado_general === "resuelto").length} completados · ultima carga{" "}
        {triggers[0] ? formatDate(triggers[0].fecha_actualizacion) : "sin datos"}
      </p>
    </section>
  );
}
