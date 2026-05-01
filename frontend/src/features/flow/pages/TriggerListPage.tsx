import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getWorkflow, listTriggers } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Trigger, WorkflowDetail } from "../types";
import { formatDate } from "../utils";

export function TriggerListPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const triggerData = await listTriggers();
      setTriggers(triggerData);

      const workflowIds = triggerData
        .map((trigger) => trigger.workflow_activo_id)
        .filter((workflowId): workflowId is string => Boolean(workflowId));
      const details = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));
      setWorkflowsById(Object.fromEntries(details.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los requerimientos");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(trigger: Trigger) {
    if (trigger.workflow_activo_id) {
      navigate(`/workflows/${trigger.workflow_activo_id}`);
      return;
    }

    navigate(`/triggers/${trigger.id}`);
  }

  function getWorkflowForTrigger(trigger: Trigger) {
    return trigger.workflow_activo_id ? workflowsById[trigger.workflow_activo_id] : undefined;
  }

  function getDisplayStatus(trigger: Trigger) {
    const workflow = getWorkflowForTrigger(trigger);
    if (!workflow) return trigger.estado_general;

    if (workflow.estado === "finalizado" || workflow.estado === "cancelado") {
      return workflow.estado;
    }

    if (workflow.estado === "en_proceso") {
      const currentStep = workflow.steps.find((s) => s.estado !== "completado");
      if (currentStep?.estado === "problema") return "problema";
      if (currentStep?.estado === "espera") return "espera";
    }

    return workflow.estado;
  }

  const ACTIVE_DISPLAY_STATES = new Set(["en_proceso", "espera", "problema", "activo"]);

  const filtered = triggers.filter((trigger) => {
    const displayStatus = getDisplayStatus(trigger);

    if (filter === "active" && !ACTIVE_DISPLAY_STATES.has(displayStatus)) {
      return false;
    }
    if (filter === "done" && displayStatus !== "finalizado" && displayStatus !== "resuelto") {
      return false;
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    const haystack = `${trigger.id} ${trigger.solicitante ?? ""} ${trigger.descripcion ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });

  const activeCount = triggers.filter((trigger) => ACTIVE_DISPLAY_STATES.has(getDisplayStatus(trigger))).length;
  const completedCount = triggers.filter((trigger) => {
    const displayStatus = getDisplayStatus(trigger);
    return displayStatus === "finalizado" || displayStatus === "resuelto";
  }).length;
  const withoutWorkflowCount = triggers.filter(
    (trigger) => !trigger.workflow_activo_id && trigger.estado_general !== "resuelto"
  ).length;
  const totalCreatedSteps = triggers.reduce((sum, trigger) => sum + (getWorkflowForTrigger(trigger)?.steps.length ?? 0), 0);

  return (
    <section className="requirements-page">
      <section className="kpi-topbar">
        <div className="kpi-cluster">
          <article className="kpi-card">
            <span>Activos</span>
            <strong>{activeCount}</strong>
            <small>Requerimientos con flujo en curso</small>
          </article>
          <article className="kpi-card">
            <span>Completados</span>
            <strong>{completedCount}</strong>
            <small>Casos cerrados correctamente</small>
          </article>
          <article className="kpi-card">
            <span>Sin flujo</span>
            <strong>{withoutWorkflowCount}</strong>
            <small>Requieren definir paso inicial</small>
          </article>
          <article className="kpi-card">
            <span>Pasos creados</span>
            <strong>{totalCreatedSteps}</strong>
            <small>Total de pasos generados entre todos los requerimientos</small>
          </article>
        </div>
      </section>

      <div className="page-heading">
        <div>
          <h2>Requerimientos</h2>
          <p className="page-subtitle">
            {activeCount} activos | {completedCount} completados
          </p>
        </div>
        <button type="button" className="primary-action-link" onClick={() => setSearchParams({ modal: "new" })}>
          Nuevo requerimiento
        </button>
      </div>

      <div className="page-toolbar">
        <div className="search-field">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por ID, solicitante o descripcion..."
          />
        </div>
        <div className="segmented-control">
          <button type="button" className={filter === "all" ? "segment active" : "segment"} onClick={() => setFilter("all")}>
            Todos
          </button>
          <button
            type="button"
            className={filter === "active" ? "segment active" : "segment"}
            onClick={() => setFilter("active")}
          >
            Activos
          </button>
          <button type="button" className={filter === "done" ? "segment active" : "segment"} onClick={() => setFilter("done")}>
            Completados
          </button>
        </div>
      </div>

      <section className="table-shell">
        <div className="table-head requirements-table">
          <span>ID</span>
          <span>Solicitante</span>
          <span>Descripcion</span>
          <span>Pasos</span>
          <span className="align-right">Estado</span>
        </div>

        {loading && <p className="status padded">Cargando requerimientos...</p>}
        {error && <p className="inline-error padded">{error}</p>}
        {!loading && filtered.length === 0 && <p className="status padded">No hay requerimientos que coincidan.</p>}

        {filtered.map((trigger) => {
          const workflow = getWorkflowForTrigger(trigger);
          const stepCount = workflow?.steps.length ?? 0;
          const displayStatus = getDisplayStatus(trigger);

          return (
            <article key={trigger.id} className="table-row requirements-table clickable-row" onClick={() => void handleOpen(trigger)}>
              <span className="mono">{trigger.id.slice(0, 8)}</span>
              <strong className="truncate-text">{trigger.solicitante || "sin solicitante"}</strong>
              <span className="muted truncate-text">{trigger.descripcion || "-"}</span>
              <span className="muted">{stepCount === 1 ? "1 paso" : `${stepCount} pasos`}</span>
              <div className="row-status-actions align-right">
                <StatusBadge value={displayStatus} />
                {!trigger.workflow_activo_id && trigger.estado_general !== "resuelto" && <span className="ghost-badge">sin flujo</span>}
              </div>
            </article>
          );
        })}
      </section>

      <p className="footnote">Ultima actualizacion: {triggers[0] ? formatDate(triggers[0].fecha_actualizacion) : "sin datos"}</p>
    </section>
  );
}
