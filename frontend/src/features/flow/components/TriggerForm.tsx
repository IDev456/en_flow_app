import { FormEvent, useState } from "react";

import type { Trigger, TriggerCreateInput, TriggerPriority } from "../types";

type TriggerFormProps = {
  onCreate: (input: TriggerCreateInput) => Promise<Trigger>;
};

const defaultPriority: TriggerPriority = "media";

export function TriggerForm({ onCreate }: TriggerFormProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("incidente");
  const [prioridad, setPrioridad] = useState<TriggerPriority>(defaultPriority);
  const [creadoPor, setCreadoPor] = useState("");
  const [metadataText, setMetadataText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let metadata: Record<string, unknown> | null = null;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText) as Record<string, unknown>;
      } catch {
        setError("Metadata debe ser JSON valido");
        return;
      }
    }

    try {
      setSubmitting(true);
      await onCreate({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        tipo: tipo.trim(),
        prioridad,
        creado_por: creadoPor.trim(),
        metadata
      });
      setTitulo("");
      setDescripcion("");
      setTipo("incidente");
      setPrioridad(defaultPriority);
      setCreadoPor("");
      setMetadataText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el disparador");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <label>
        Titulo
        <input value={titulo} onChange={(event) => setTitulo(event.target.value)} required />
      </label>

      <label>
        Descripcion
        <textarea
          rows={4}
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          placeholder="Contexto del caso"
        />
      </label>

      <div className="form-grid">
        <label>
          Tipo
          <input value={tipo} onChange={(event) => setTipo(event.target.value)} required />
        </label>

        <label>
          Prioridad
          <select value={prioridad} onChange={(event) => setPrioridad(event.target.value as TriggerPriority)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Critica</option>
          </select>
        </label>
      </div>

      <label>
        Creado por
        <input value={creadoPor} onChange={(event) => setCreadoPor(event.target.value)} required />
      </label>

      <label>
        Metadata JSON opcional
        <textarea
          rows={3}
          value={metadataText}
          onChange={(event) => setMetadataText(event.target.value)}
          placeholder='{"canal":"web","cliente":"ACME"}'
        />
      </label>

      {error && <p className="inline-error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : "Crear disparador"}
      </button>
    </form>
  );
}

