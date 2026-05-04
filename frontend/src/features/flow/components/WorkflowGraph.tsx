import { useEffect, useRef } from "react";

import type { Step } from "../types";
import { formatDate, formatElapsedTime, humanizeStatus } from "../utils";
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

function renderLatestStepMovement(step: Step) {
  if (step.ultimo_comentario_tipo === "imagen" || step.ultimo_comentario_tipo === "adjunto") {
    return (
      <div className="flow-step-comment attachment">
        <span className="flow-step-comment-icon" aria-hidden="true">
          {step.ultimo_comentario_tipo === "imagen" ? "🖼" : "📎"}
        </span>
        <div className="flow-step-comment-copy">
          <strong>{step.ultimo_comentario_tipo === "imagen" ? "Imagen adjunta" : "Archivo adjunto"}</strong>
          <span>{step.ultimo_comentario_adjunto_nombre ?? "Adjunto reciente"}</span>
        </div>
      </div>
    );
  }

  return (
    <p className={step.ultimo_comentario?.trim() ? "flow-step-comment" : "flow-step-comment empty"}>
      {step.ultimo_comentario?.trim() || "Sin comentarios todavia"}
    </p>
  );
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
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);

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
    viewport.scrollTo({
      top: Math.max(0, card.offsetTop - 120),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <div ref={viewportRef} className="graph-viewport">
      <div className="flow-timeline">
        <div className="flow-anchor-wrap">
          <div className={workflowClosed ? "flow-origin flow-end flow-anchor active" : "flow-origin flow-end flow-anchor"}>
            <span className="flow-origin-label">Cierre</span>
            <strong>{workflowClosed ? "Workflow finalizado" : "Pendiente"}</strong>
          </div>
          <span className="flow-anchor-link" aria-hidden="true" />
        </div>

        <div className="flow-timeline-steps">
          {orderedSteps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const waitingElapsed = step.estado === "espera" ? formatElapsedTime(step.fecha_estado_actual) : null;
            const createdElapsed = formatElapsedTime(step.fecha_creacion);
            const latestComment = step.ultimo_comentario?.trim() || null;
            const isFirst = index === 0;
            const isLast = index === orderedSteps.length - 1;

            return (
              <div key={step.id} className="flow-timeline-row">
                <div className="flow-step-node-wrap" aria-hidden="true">
                  {!isFirst && <span className="flow-step-connector top" />}
                  <button
                    type="button"
                    className={
                      isSelected
                        ? `flow-step-node state-${step.estado} selected`
                        : `flow-step-node state-${step.estado}`
                    }
                    onClick={() => onSelectStep(step.id)}
                  >
                    <span className="flow-step-code">Paso {step.orden}</span>
                  </button>
                  {!isLast && <span className="flow-step-connector bottom" />}
                </div>

                <button
                  ref={isSelected ? selectedCardRef : null}
                  type="button"
                  className={isSelected ? "flow-step-card selected" : "flow-step-card"}
                  onClick={() => handleOpenStep(step.id)}
                >
                  <div className="flow-step-card-head">
                    <div className="flow-step-card-copy">
                      <div className="flow-step-card-topline">
                        <strong>{step.nombre}</strong>
                        <span className={`flow-step-status-text state-${step.estado}`}>{humanizeStatus(step.estado)}</span>
                      </div>
                      {step.descripcion && <p>{step.descripcion}</p>}
                      {waitingElapsed && <p className="flow-step-waiting">En espera {waitingElapsed}</p>}
                      <div className="flow-step-facts">
                        <span>Creado: {formatDate(step.fecha_creacion)}</span>
                        {createdElapsed && <span>{createdElapsed}</span>}
                      </div>
                      <div className="flow-step-latest">
                        <span className="flow-step-latest-label">Ultimo comentario</span>
                        {renderLatestStepMovement(step)}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <div className="flow-anchor-wrap bottom">
          <span className="flow-anchor-link" aria-hidden="true" />
          <button type="button" className="flow-origin flow-origin-button flow-anchor" onClick={onOpenTrigger}>
            <span className="flow-origin-label">Disparador</span>
            <strong>{triggerLabel}</strong>
          </button>
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
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);

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

      {orderedSteps.map((step) => {
        const isSelected = selectedStepId === step.id;
        const waitingElapsed = step.estado === "espera" ? formatElapsedTime(step.fecha_estado_actual) : null;
        const createdElapsed = formatElapsedTime(step.fecha_creacion);
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
                <span className={`flow-step-status-text state-${step.estado}`}>{humanizeStatus(step.estado)}</span>
              </div>
              {step.descripcion && <p>{step.descripcion}</p>}
              <div className="gitlog-meta">
                <span>Creado: {formatDate(step.fecha_creacion)}</span>
                {createdElapsed && <span>{createdElapsed}</span>}
                {waitingElapsed && <span>En espera {waitingElapsed}</span>}
                {step.fecha_vencimiento && <span>Vence: {formatDate(step.fecha_vencimiento)}</span>}
              </div>
              <div className="flow-step-latest">
                <span className="flow-step-latest-label">Ultimo comentario</span>
                {renderLatestStepMovement(step)}
              </div>
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
