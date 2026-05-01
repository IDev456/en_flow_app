import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Panel } from "../../../components/Panel";
import { addStepComment, completeStep, getStep, getStepComments, getStepHistory } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, StepComment, StepHistoryEntry } from "../types";
import { formatDate } from "../utils";

export function StepDetailPage() {
  const { stepId = "" } = useParams();
  const [step, setStep] = useState<Step | null>(null);
  const [comments, setComments] = useState<StepComment[]>([]);
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeUser, setCompleteUser] = useState("");
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [comentarioFinal, setComentarioFinal] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

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

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) {
      return;
    }

    try {
      await completeStep(step.id, {
        usuario: completeUser.trim(),
        resultado: resultado.trim() || null,
        observaciones: observaciones.trim() || null,
        comentario_final: comentarioFinal.trim() || null
      });
      setResultado("");
      setObservaciones("");
      setComentarioFinal("");
      await loadStepData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el paso");
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) {
      return;
    }

    try {
      const created = await addStepComment(step.id, {
        autor: commentAuthor.trim(),
        comentario: commentText.trim()
      });
      setComments((current) => [...current, created]);
      setCommentText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el comentario");
    }
  }

  if (loading) {
    return <p className="status">Cargando paso...</p>;
  }

  if (error && !step) {
    return <p className="inline-error">{error}</p>;
  }

  if (!step) {
    return <p className="status">Paso no encontrado.</p>;
  }

  const canComplete = step.estado === "activo" || step.estado === "en_revision";

  return (
    <div className="page-grid">
      <Panel title={`Paso ${step.orden}: ${step.nombre}`}>
        <div className="entity-card-head">
          <div>
            <p className="muted">Workflow {step.workflow_id}</p>
            <h3>{step.tipo}</h3>
          </div>
          <StatusBadge value={step.estado} />
        </div>
        {step.descripcion && <p>{step.descripcion}</p>}
        <dl className="detail-grid">
          <div>
            <dt>Asignado a</dt>
            <dd>{step.asignado_a ?? "Sin asignar"}</dd>
          </div>
          <div>
            <dt>Creado</dt>
            <dd>{formatDate(step.fecha_creacion)}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{formatDate(step.fecha_inicio)}</dd>
          </div>
          <div>
            <dt>Cierre</dt>
            <dd>{formatDate(step.fecha_cierre)}</dd>
          </div>
          <div>
            <dt>Resultado</dt>
            <dd>{step.resultado ?? "Sin resultado"}</dd>
          </div>
          <div>
            <dt>Observaciones</dt>
            <dd>{step.observaciones ?? "Sin observaciones"}</dd>
          </div>
        </dl>
        <Link className="text-link" to={`/workflows/${step.workflow_id}`}>
          Volver al workflow
        </Link>
      </Panel>

      <Panel title="Completar paso">
        {canComplete ? (
          <form className="entity-form" onSubmit={handleComplete}>
            <label>
              Usuario
              <input value={completeUser} onChange={(event) => setCompleteUser(event.target.value)} required />
            </label>
            <label>
              Resultado
              <textarea rows={3} value={resultado} onChange={(event) => setResultado(event.target.value)} />
            </label>
            <label>
              Observaciones
              <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
            </label>
            <label>
              Comentario final
              <textarea
                rows={3}
                value={comentarioFinal}
                onChange={(event) => setComentarioFinal(event.target.value)}
              />
            </label>
            {error && <p className="inline-error">{error}</p>}
            <button type="submit">Completar paso</button>
          </form>
        ) : (
          <p className="status">El boton de completado solo se habilita para pasos activos o en revision.</p>
        )}
      </Panel>

      <Panel title="Comentarios">
        <form className="entity-form compact-form" onSubmit={handleComment}>
          <label>
            Autor
            <input value={commentAuthor} onChange={(event) => setCommentAuthor(event.target.value)} required />
          </label>
          <label>
            Comentario
            <textarea rows={3} value={commentText} onChange={(event) => setCommentText(event.target.value)} required />
          </label>
          <button type="submit">Agregar comentario</button>
        </form>
        <ul className="simple-list">
          {comments.map((comment) => (
            <li key={comment.id} className="feed-item">
              <strong>{comment.autor}</strong>
              <p>{comment.comentario}</p>
              <span className="muted">{formatDate(comment.fecha_creacion)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Historial">
        <ul className="simple-list">
          {history.map((entry) => (
            <li key={entry.id} className="feed-item">
              <strong>{entry.campo}</strong>
              <p>
                {entry.valor_anterior ?? "vacio"}
                {" -> "}
                {entry.valor_nuevo ?? "vacio"}
              </p>
              <span className="muted">{entry.usuario} - {formatDate(entry.fecha)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
