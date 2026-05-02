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

  function buildMeta(step: Step) {
    const items: Array<{ label: string; value: string }> = [];
    items.push({ label: "Creado", value: formatDate(step.fecha_creacion) });
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
            const metaItems = buildMeta(step);
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
                    <div>
                      <strong>{step.nombre}</strong>
                      {step.descripcion && <p>{step.descripcion}</p>}
                      <div className="flow-step-status-line">
                        <span className={`flow-step-state state-${step.estado}`}>{humanizeStepState(step.estado)}</span>
                        {waitingElapsed && <span className="flow-step-waiting">En espera {waitingElapsed}</span>}
                      </div>
                      <div className="flow-step-facts">
                        <span>Creado: {formatDate(step.fecha_creacion)}</span>
                        {createdElapsed && <span>{createdElapsed}</span>}
                      </div>
                      <div className="flow-step-latest">
                        <span className="flow-step-latest-label">Ultimo comentario</span>
                        <p className={latestComment ? "flow-step-comment" : "flow-step-comment empty"}>
                          {latestComment ?? "Sin comentarios todavia"}
                        </p>
                      </div>
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
        const latestComment = step.ultimo_comentario?.trim() || null;
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
              <div className="gitlog-meta">
                <span>{humanizeStepState(step.estado)}</span>
                <span>Creado: {formatDate(step.fecha_creacion)}</span>
                {createdElapsed && <span>{createdElapsed}</span>}
                {waitingElapsed && <span>En espera {waitingElapsed}</span>}
                {step.fecha_vencimiento && <span>Vence: {formatDate(step.fecha_vencimiento)}</span>}
              </div>
              <div className="flow-step-latest">
                <span className="flow-step-latest-label">Ultimo comentario</span>
                <p className={latestComment ? "flow-step-comment" : "flow-step-comment empty"}>
                  {latestComment ?? "Sin comentarios todavia"}
                </p>
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

function humanizeStepState(value: Step["estado"]) {
  if (value === "activo") {
    return "En proceso";
  }
  if (value === "espera") {
    return "En espera";
  }
  if (value === "problema") {
    return "Problema";
  }
  return "Completado";
}
