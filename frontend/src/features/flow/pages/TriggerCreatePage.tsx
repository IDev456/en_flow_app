import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createTrigger, startWorkflow } from "../api";
import { TriggerTypePicker } from "../components/TriggerTypePicker";
import { WizardStepper } from "../components/WizardStepper";
import type { TriggerPriority } from "../types";

const wizardSteps = ["Disparador", "Detalles", "Primer paso"];

export function TriggerCreatePage() {
  const [step, setStep] = useState(1);
  const [triggerType, setTriggerType] = useState("incidente");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<TriggerPriority>("media");
  const [creadoPor, setCreadoPor] = useState("operador");
  const [objetivoFinal, setObjetivoFinal] = useState("");
  const [resolucionEsperada, setResolucionEsperada] = useState("");
  const [primerPasoNombre, setPrimerPasoNombre] = useState("Diagnostico inicial");
  const [primerPasoDescripcion, setPrimerPasoDescripcion] = useState("");
  const [primerPasoAsignadoA, setPrimerPasoAsignadoA] = useState("Usuario 1");
  const [primerPasoFecha, setPrimerPasoFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const canContinue =
    step === 1
      ? Boolean(triggerType)
      : step === 2
        ? titulo.trim().length > 0 && creadoPor.trim().length > 0
        : primerPasoNombre.trim().length > 0;

  async function handleCreate() {
    try {
      setSubmitting(true);
      setError(null);
      const trigger = await createTrigger({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        tipo: triggerType,
        prioridad,
        creado_por: creadoPor.trim(),
        metadata: null
      });
      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: objetivoFinal.trim() || `Resolver ${titulo.trim()}`,
        resolucion_esperada: resolucionEsperada.trim() || "Flujo resuelto y verificado",
        primer_paso: {
          nombre: primerPasoNombre.trim(),
          descripcion: primerPasoDescripcion.trim() || null,
          asignado_a: primerPasoAsignadoA.trim() || null,
          fecha_vencimiento: primerPasoFecha || null
        }
      });
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el workflow");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="wizard-page">
      <div className="wizard-shell">
        <Link className="back-link" to="/triggers">
          Volver
        </Link>
        <h1>Nuevo requerimiento</h1>
        <p className="page-subtitle">
          Elegi el disparador, completa las propiedades y deja listo el primer paso del flujo.
        </p>

        <WizardStepper current={step} items={wizardSteps} />

        <div className="wizard-stage">
          {step === 1 && <TriggerTypePicker selected={triggerType} onSelect={setTriggerType} />}

          {step === 2 && (
            <div className="wizard-form">
              <label>
                Titulo del requerimiento
                <input value={titulo} onChange={(event) => setTitulo(event.target.value)} />
              </label>
              <label>
                Descripcion
                <textarea rows={4} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
              </label>
              <div className="wizard-grid">
                <label>
                  Prioridad
                  <select value={prioridad} onChange={(event) => setPrioridad(event.target.value as TriggerPriority)}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Critica</option>
                  </select>
                </label>
                <label>
                  Creado por
                  <input value={creadoPor} onChange={(event) => setCreadoPor(event.target.value)} />
                </label>
              </div>
              <div className="wizard-grid">
                <label>
                  Objetivo final
                  <input value={objetivoFinal} onChange={(event) => setObjetivoFinal(event.target.value)} />
                </label>
                <label>
                  Resolucion esperada
                  <input value={resolucionEsperada} onChange={(event) => setResolucionEsperada(event.target.value)} />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-form">
              <div className="hint-card">
                El workflow se crea automaticamente con la plantilla base. Aqui puedes personalizar el primer paso.
              </div>
              <label>
                Titulo del primer paso
                <input value={primerPasoNombre} onChange={(event) => setPrimerPasoNombre(event.target.value)} />
              </label>
              <label>
                Descripcion del primer paso
                <textarea
                  rows={4}
                  value={primerPasoDescripcion}
                  onChange={(event) => setPrimerPasoDescripcion(event.target.value)}
                />
              </label>
              <div className="wizard-grid">
                <label>
                  Asignado a
                  <input value={primerPasoAsignadoA} onChange={(event) => setPrimerPasoAsignadoA(event.target.value)} />
                </label>
                <label>
                  Fecha limite
                  <input type="date" value={primerPasoFecha} onChange={(event) => setPrimerPasoFecha(event.target.value)} />
                </label>
              </div>
            </div>
          )}
        </div>

        {error && <p className="inline-error">{error}</p>}

        <div className="wizard-footer">
          <Link className="ghost-link" to="/triggers">
            Cancelar
          </Link>
          <div className="wizard-actions">
            {step > 1 && (
              <button type="button" className="secondary-action" onClick={() => setStep((current) => current - 1)}>
                Atras
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="primary-action"
                onClick={() => setStep((current) => current + 1)}
                disabled={!canContinue}
              >
                Continuar
              </button>
            ) : (
              <button type="button" className="primary-action" onClick={() => void handleCreate()} disabled={submitting}>
                {submitting ? "Creando..." : "Crear requerimiento"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

