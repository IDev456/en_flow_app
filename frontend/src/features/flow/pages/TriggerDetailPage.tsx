import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getTrigger, startWorkflow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail } from "../types";
import { formatDate } from "../utils";

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void loadTrigger();
  }, [triggerId]);

  async function loadTrigger() {
    try {
      setLoading(true);
      setError(null);
      setTrigger(await getTrigger(triggerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el disparador");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWorkflow() {
    if (!trigger) {
      return;
    }

    try {
      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: `Resolver ${trigger.titulo}`,
        resolucion_esperada: "Flujo completado con validacion final"
      });
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el workflow");
    }
  }

  if (loading) {
    return <p className="status">Cargando disparador...</p>;
  }

  if (error) {
    return <p className="inline-error">{error}</p>;
  }

  if (!trigger) {
    return <p className="status">Disparador no encontrado.</p>;
  }

  return (
    <div className="detail-page">
      <section className="surface-panel">
        <div className="entity-card-head">
          <div>
            <p className="mono muted">{trigger.id.slice(0, 8)}</p>
            <h2>{trigger.titulo}</h2>
          </div>
          <StatusBadge value={trigger.estado_general} />
        </div>
        <p className="page-subtitle">{trigger.descripcion ?? "Sin descripcion"}</p>
        <dl className="detail-grid">
          <div>
            <dt>Prioridad</dt>
            <dd>{trigger.prioridad}</dd>
          </div>
          <div>
            <dt>Creado por</dt>
            <dd>{trigger.creado_por}</dd>
          </div>
          <div>
            <dt>Fecha de creacion</dt>
            <dd>{formatDate(trigger.fecha_creacion)}</dd>
          </div>
          <div>
            <dt>Ultima actualizacion</dt>
            <dd>{formatDate(trigger.fecha_actualizacion)}</dd>
          </div>
        </dl>
        {trigger.metadata && (
          <>
            <h3>Metadata</h3>
            <pre className="code-block">{JSON.stringify(trigger.metadata, null, 2)}</pre>
          </>
        )}
      </section>

      <section className="surface-panel">
        <div className="panel-header-row">
          <h3>Workflow asociado</h3>
        </div>
        {trigger.workflow_activo_id ? (
          <div className="stack">
            <p className="muted">Workflow activo: {trigger.workflow_activo_id}</p>
            <Link className="text-link" to={`/workflows/${trigger.workflow_activo_id}`}>
              Abrir workflow actual
            </Link>
          </div>
        ) : (
          <div className="stack">
            <p className="status">Todavia no hay workflow activo para este disparador.</p>
            {trigger.estado_general !== "resuelto" && (
              <button type="button" className="primary-action" onClick={() => void handleStartWorkflow()}>
                Generar workflow base de 3 pasos
              </button>
            )}
          </div>
        )}

        {trigger.workflow_ids.length > 0 && (
          <>
            <h3>Historial de workflows</h3>
            <ul className="simple-list">
              {trigger.workflow_ids.map((workflowId) => (
                <li key={workflowId}>
                  <Link className="text-link" to={`/workflows/${workflowId}`}>
                    {workflowId}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
