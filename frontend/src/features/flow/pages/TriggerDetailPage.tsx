import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getTrigger, startWorkflow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail } from "../types";
import { DEFAULT_ACTOR, formatDate } from "../utils";

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [firstDescription, setFirstDescription] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    void loadTrigger();
  }, [triggerId]);

  async function loadTrigger() {
    try {
      setLoading(true);
      setError(null);
      setStartError(null);
      setTrigger(await getTrigger(triggerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el disparador");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWorkflow() {
    if (!trigger) return;

    if (!firstDescription.trim()) {
      setStartError("Debes definir la descripcion del primer paso");
      return;
    }

    try {
      setStartError(null);
      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: trigger.descripcion ?? `Gestionar requerimiento ${trigger.id.slice(0, 8)}`,
        resolucion_esperada: "Flujo completado con validacion final",
        primer_paso: {
          nombre: "Paso inicial",
          descripcion: firstDescription.trim() || null,
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null
        }
      });
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "No se pudo iniciar el workflow");
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner" />
        Cargando requerimiento...
      </div>
    );
  }

  if (error && !trigger) {
    return (
      <div className="error-state">
        <span>⚠</span>
        {error}
      </div>
    );
  }

  if (!trigger) {
    return <p className="status">Requerimiento no encontrado.</p>;
  }

  return (
    <div className="detail-page">
      <div className="view-breadcrumbs detail-breadcrumbs">
        <Link className="text-link" to="/triggers">Requerimientos</Link>
        <span className="bc-sep">›</span>
        <strong>{trigger.solicitante ?? "Requerimiento"}</strong>
      </div>

      <section className="surface-panel">
        <span className="page-chip">Disparador</span>
        <div className="entity-card-head">
          <div>
            <p className="mono muted">{trigger.id.slice(0, 8)}</p>
            <h2>{trigger.solicitante ?? "Sin solicitante"}</h2>
          </div>
          <StatusBadge value={trigger.estado_general} />
        </div>
        <p className="page-subtitle">{trigger.descripcion ?? "Sin descripcion"}</p>
        <dl className="detail-grid">
          <div>
            <dt>Tipo</dt>
            <dd>{trigger.tipo}</dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>{trigger.creado_por}</dd>
          </div>
          <div>
            <dt>Creado</dt>
            <dd>{formatDate(trigger.fecha_creacion)}</dd>
          </div>
          <div>
            <dt>Actualizado</dt>
            <dd>{formatDate(trigger.fecha_actualizacion)}</dd>
          </div>
        </dl>
        {trigger.metadata && <pre className="code-block">{JSON.stringify(trigger.metadata, null, 2)}</pre>}
      </section>

      <section className="surface-panel">
        <div className="panel-header-row">
          <h3>Workflow asociado</h3>
        </div>

        {trigger.workflow_activo_id ? (
          <div className="stack">
            <p className="muted">Hay un workflow activo asociado a este requerimiento.</p>
            <Link className="primary-action-link" to={`/workflows/${trigger.workflow_activo_id}`}>
              Abrir workflow →
            </Link>
          </div>
        ) : (
          <div className="stack">
            <p className="status">Todavia no hay workflow activo. Define el primer paso para iniciarlo.</p>
            {trigger.estado_general !== "resuelto" && (
              <>
                <label>
                  Descripcion del primer paso *
                  <textarea rows={4} value={firstDescription} onChange={(event) => setFirstDescription(event.target.value)} />
                </label>
                <button type="button" className="primary-action" onClick={() => void handleStartWorkflow()}>
                  Iniciar workflow
                </button>
                {startError && <p className="inline-error">{startError}</p>}
              </>
            )}
          </div>
        )}

        {trigger.workflow_ids.length > 0 && (
          <div className="stack" style={{ marginTop: "1rem" }}>
            <h3>Historial de workflows</h3>
            <ul className="simple-list">
              {trigger.workflow_ids.map((workflowId) => (
                <li key={workflowId}>
                  <Link className="text-link" to={`/workflows/${workflowId}`}>
                    <code>{workflowId.slice(0, 8)}</code>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
