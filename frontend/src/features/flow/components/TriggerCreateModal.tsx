import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createTrigger, startWorkflow } from "../api";
import { DEFAULT_ACTOR } from "../utils";

type TriggerCreateModalProps = {
  onClose: () => void;
};

export function TriggerCreateModal({ onClose }: TriggerCreateModalProps) {
  const [solicitante, setSolicitante] = useState("");
  const [description, setDescription] = useState("");
  const [firstDescription, setFirstDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const solicitanteRef = useRef<HTMLInputElement>(null);
  const canSubmit = firstDescription.trim().length > 0;

  useEffect(() => {
    setTimeout(() => solicitanteRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Debes definir la descripcion del primer paso");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const descriptionText = description.trim();
      const trigger = await createTrigger({
        solicitante: solicitante.trim() || null,
        descripcion: descriptionText || null,
        tipo: "requerimiento",
        metadata: null
      });

      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: descriptionText || `Gestionar requerimiento ${trigger.id.slice(0, 8)}`,
        resolucion_esperada: "Workflow resuelto y validado",
        primer_paso: {
          nombre: "Paso inicial",
          descripcion: firstDescription.trim() || null,
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null
        }
      });

      onClose();
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el requerimiento");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card create-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="create-heading compact">
          <span className="page-chip">Nuevo requerimiento</span>
          <h1>Iniciar un flujo</h1>
          <p>Define el primer paso para arrancar. Solicitante y descripcion son opcionales.</p>
        </div>

        <div className="surface-panel form-panel">
          <label>
            Solicitante
            <input
              ref={solicitanteRef}
              value={solicitante}
              onChange={(event) => setSolicitante(event.target.value)}
              placeholder="Ej. Cliente A, Sector Operaciones, Juan Perez..."
            />
          </label>

          <label>
            Descripcion
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="De que se trata este requerimiento?"
            />
          </label>
        </div>

        <section className="surface-panel form-panel">
          <div className="panel-header-row">
            <div>
              <h3>Primer paso</h3>
              <p className="muted">Todo flujo arranca con un paso. Describe que hay que hacer para comenzar.</p>
            </div>
          </div>

          <label>
            Descripcion del paso *
            <textarea
              rows={4}
              value={firstDescription}
              onChange={(event) => setFirstDescription(event.target.value)}
              placeholder="Ej. Preguntarle a Orlando quien es Orlando."
            />
          </label>
        </section>

        {error && <p className="inline-error">{error}</p>}

        <div className="create-actions">
          <button type="button" className="ghost-link" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Creando..." : "Crear requerimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
