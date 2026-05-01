import { useEffect, useRef } from "react";

import type { Step } from "../types";
import { formatDate, formatElapsedTime } from "../utils";

import { StatusBadge } from "./StatusBadge";
import type { WorkflowVariant } from "./WorkflowVariantSwitcher";

type WorkflowGraphProps = {
  variant: WorkflowVariant;
  triggerLabel: string;
  steps: Step[];
  workflowClosed: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onOpenStep: (stepId: string) => void;
  onOpenTrigger: () => void;
};

export function WorkflowGraph(props: WorkflowGraphProps) {
  if (props.variant === "gitlog") {
    return <GitLogWorkflowGraph {...props} />;
  }

  return <VerticalWorkflowGraph {...props} />;
}

function VerticalWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  onOpenTrigger
}: WorkflowGraphProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);

  function handleOpenStep(stepId: string) {
    onSelectStep(stepId);
    onOpenStep(stepId);
  }

  useEffect(() => {
    if (!viewportRef.current || !selectedCardRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const card = selectedCardRef.current;
    const topOffset = 120;
    viewport.scrollTo({
      top: Math.max(0, card.offsetTop - topOffset),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  function buildMeta(step: Step) {
    const items: Array<{ label: string; value: string }> = [];
    if (step.asignado_a) {
      items.push({ label: "Asignado", value: step.asignado_a });
    }
    if (step.fecha_vencimiento) {
      items.push({ label: "Vence", value: formatDate(step.fecha_vencimiento) });
    }
    if (step.fecha_inicio) {
      items.push({ label: "Inicio", value: formatDate(step.fecha_inicio) });
    }
    return items;
  }

  return (
    <div ref={viewportRef} className="graph-viewport">
      <div className="flow-vertical">
        <button type="button" className="flow-origin flow-origin-button" onClick={onOpenTrigger}>
          <span className="flow-origin-label">Disparador</span>
          <strong>{triggerLabel}</strong>
        </button>

        {steps.map((step) => {
          const metaItems = buildMeta(step);
          const isSelected = selectedStepId === step.id;
          const waitingElapsed = step.estado === "espera" ? formatElapsedTime(step.fecha_estado_actual) : null;

          return (
          <div key={step.id} className="flow-step-wrap">
            <span className="flow-step-line" />
            <div className="flow-step-grid">
              <button
                type="button"
                className={isSelected ? "flow-step-node selected" : "flow-step-node"}
                onClick={() => onSelectStep(step.id)}
              >
                <span className="flow-step-code">Paso {step.orden}</span>
              </button>

              <button
                ref={isSelected ? selectedCardRef : null}
                type="button"
                className={isSelected ? "flow-step-card selected" : "flow-step-card"}
                onClick={() => handleOpenStep(step.id)}
              >
                <div className="flow-step-card-head">
                  <div>
                    <strong>{step.nombre}</strong>
                    {step.descripcion && <p>{step.descripcion}</p>}
                    {waitingElapsed && <p className="flow-step-note">En espera {waitingElapsed}</p>}
                    {step.ultimo_comentario && (
                      <p className="flow-step-comment">"{step.ultimo_comentario}"</p>
                    )}
                  </div>
                  <StatusBadge value={step.estado} />
                </div>
                {metaItems.length > 0 && (
                  <div className="flow-step-card-props">
                    {metaItems.map((item) => (
                      <div key={`${item.label}-${item.value}`} className="flow-step-prop">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          </div>
          );
        })}

        <span className="flow-step-line" />
        <div className={workflowClosed ? "flow-origin flow-end active" : "flow-origin flow-end"}>
          <span className="flow-origin-label">Cierre</span>
          <strong>{workflowClosed ? "Workflow finalizado" : "Pendiente"}</strong>
        </div>
      </div>
    </div>
  );
}

function GitLogWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  onOpenTrigger
}: WorkflowGraphProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  function handleOpenStep(stepId: string) {
    onSelectStep(stepId);
    onOpenStep(stepId);
  }

  useEffect(() => {
    if (!viewportRef.current || !selectedRowRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const row = selectedRowRef.current;
    viewport.scrollTo({
      top: Math.max(0, row.offsetTop - 90),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <div ref={viewportRef} className="gitlog-list">
      <button type="button" className="gitlog-row static trigger-row" onClick={onOpenTrigger}>
        <div className="gitlog-rail">
          <span className="gitlog-dot trigger" />
          <span className="gitlog-line" />
        </div>
        <div className="gitlog-content">
          <div className="gitlog-head">
            <code>TRG</code>
            <strong>{triggerLabel}</strong>
          </div>
          <p>Origen del flujo</p>
        </div>
      </button>

      {steps.map((step) => {
        const isSelected = selectedStepId === step.id;
        const waitingElapsed = step.estado === "espera" ? formatElapsedTime(step.fecha_estado_actual) : null;
        return (
        <button
          ref={isSelected ? selectedRowRef : null}
          key={step.id}
          type="button"
          className={isSelected ? "gitlog-row selected" : "gitlog-row"}
          onClick={() => handleOpenStep(step.id)}
        >
          <div className="gitlog-rail">
            <span className={`gitlog-dot ${step.estado}`} />
            <span className="gitlog-line" />
          </div>
          <div className="gitlog-content">
            <div className="gitlog-head">
              <code>{`P${step.orden.toString().padStart(2, "0")}`}</code>
              <strong>{step.nombre}</strong>
              <StatusBadge value={step.estado} />
            </div>
            {step.descripcion && <p>{step.descripcion}</p>}
            {waitingElapsed && <p className="flow-step-note">En espera {waitingElapsed}</p>}
            {step.ultimo_comentario && <p className="flow-step-comment">"{step.ultimo_comentario}"</p>}
            {(step.asignado_a || step.fecha_vencimiento || step.fecha_inicio) && (
              <div className="gitlog-meta">
                {step.asignado_a && <span>Asignado: {step.asignado_a}</span>}
                {step.fecha_inicio && <span>Inicio: {formatDate(step.fecha_inicio)}</span>}
                {step.fecha_vencimiento && <span>Vence: {formatDate(step.fecha_vencimiento)}</span>}
              </div>
            )}
          </div>
        </button>
        );
      })}

      <div className="gitlog-row static">
        <div className="gitlog-rail">
          <span className={workflowClosed ? "gitlog-dot completado" : "gitlog-dot"} />
        </div>
        <div className="gitlog-content">
          <div className="gitlog-head">
            <code>END</code>
            <strong>{workflowClosed ? "Workflow finalizado" : "Cierre pendiente"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
