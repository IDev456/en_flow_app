import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import type { Step } from "../types";
import { formatDate, DEFAULT_ACTOR } from "../utils";
import { StatusBadge } from "./StatusBadge";

type WorkflowInspectorProps = {
  workflowId: string;
  step: Step | null;
  onComplete: (payload: {
    usuario: string;
    resultado: string | null;
    observaciones: string | null;
    comentario_final: string | null;
  }) => Promise<void>;
};

export function WorkflowInspector({ workflowId, step, onComplete }: WorkflowInspectorProps) {
  const [usuario, setUsuario] = useState(DEFAULT_ACTOR);
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [comentarioFinal, setComentarioFinal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onComplete({
        usuario: usuario.trim(),
        resultado: resultado.trim() || null,
        observaciones: observaciones.trim() || null,
        comentario_final: comentarioFinal.trim() || null
      });
      setResultado("");
      setObservaciones("");
      setComentarioFinal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el paso");
    } finally {
      setSubmitting(false);
    }
  }

  if (!step) {
    return (
      <section 
        className="detail-rail empty" 
        style={{ 
          marginLeft: "auto", 
          borderLeft: "1px solid var(--border-color, #e0e0e0)", 
          borderRight: "none" 
        }}
      >
        <h3>Sin paso seleccionado</h3>
        <p>Selecciona un paso del flujo para ver sus propiedades y operar sobre el.</p>
      </section>
    );
  }

  const canComplete = step.estado === "activo" || step.estado === "espera" || step.estado === "problema";

  return (
    <section 
      className="detail-rail" 
      style={{ 
        marginLeft: "auto", 
        borderLeft: "1px solid var(--border-color, #e0e0e0)", 
        borderRight: "none" 
      }}
    >
      <div className="detail-rail-head">
        <code>{workflowId}</code>
        <h3>{step.nombre}</h3>
        <p>{step.descripcion ?? "Sin descripcion"}</p>
        <div className="detail-badges">
          <StatusBadge value={step.estado} />
          <span className="ghost-badge">{step.tipo}</span>
        </div>
      </div>

      <dl className="detail-stack">
        <div>
          <dt>Asignado</dt>
          <dd>{step.asignado_a ?? "Sin asignar"}</dd>
        </div>
        <div>
          <dt>Inicio</dt>
          <dd>{formatDate(step.fecha_inicio)}</dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{formatDate(step.fecha_vencimiento)}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>{step.resultado ?? "Todavia sin resultado"}</dd>
        </div>
      </dl>

      {canComplete ? (
        <form className="inspector-form" onSubmit={handleSubmit}>
          <label>
            Usuario operativo
            <input value={usuario} onChange={(event) => setUsuario(event.target.value)} required />
          </label>
          <label>
            Resultado
            <textarea 
              rows={3} 
              value={resultado} 
              onChange={(event) => setResultado(event.target.value)} 
              placeholder="¿Qué se obtuvo al finalizar este paso?"
            />
          </label>
          <label>
            Observaciones
            <textarea 
              rows={3} 
              value={observaciones} 
              onChange={(event) => setObservaciones(event.target.value)} 
              placeholder="Detalles técnicos o impedimentos encontrados durante la ejecución..."
            />
          </label>
          <label>
            Comentario final
            <textarea 
              rows={3} 
              value={comentarioFinal} 
              onChange={(event) => setComentarioFinal(event.target.value)} 
              placeholder="Nota de cierre para la bitácora general..."
            />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <button type="submit" className="primary-action" disabled={submitting}>
            {submitting ? "Completando..." : "Completar paso"}
          </button>
        </form>
      ) : (
        <div className="inspector-note">
          <p>Este paso no esta listo para completarse desde la vista del workflow.</p>
        </div>
      )}

      <div className="rail-footer-links">
        <Link className="text-link" to={`/steps/${step.id}`}>
          Abrir detalle completo del paso
        </Link>
      </div>
    </section>
  );
}
