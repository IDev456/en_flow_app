import type { Step } from "../types";
import { humanizeStatus } from "../utils";

import { StatusBadge } from "./StatusBadge";
import type { WorkflowVariant } from "./WorkflowVariantSwitcher";

type WorkflowGraphProps = {
  variant: WorkflowVariant;
  triggerLabel: string;
  steps: Step[];
  workflowClosed: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
};

export function WorkflowGraph(props: WorkflowGraphProps) {
  if (props.variant === "horizontal") {
    return <HorizontalWorkflowGraph {...props} />;
  }

  if (props.variant === "timeline") {
    return <TimelineWorkflowGraph {...props} />;
  }

  return <VerticalWorkflowGraph {...props} />;
}

function VerticalWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep
}: WorkflowGraphProps) {
  return (
    <div className="graph-viewport vertical">
      <div className="vertical-graph">
        <div className="graph-trigger">
          <span className="graph-node-label">Disparador</span>
          <strong>{triggerLabel}</strong>
        </div>
        {steps.map((step, index) => (
          <div key={step.id} className="vertical-node-wrap">
            <div className="graph-connector vertical-line" />
            <button
              type="button"
              className={selectedStepId === step.id ? "step-node circle selected" : "step-node circle"}
              onClick={() => onSelectStep(step.id)}
            >
              <span className="step-node-code">P{step.orden}</span>
              <strong>{step.nombre}</strong>
              <small>{humanizeStatus(step.estado)}</small>
            </button>
            <aside className="graph-side-note">
              <div className="graph-side-head">
                <p>{step.descripcion ?? "Sin descripcion"}</p>
                <StatusBadge value={step.estado} />
              </div>
              <div className="graph-side-meta">
                <span>{step.asignado_a ?? "Sin asignar"}</span>
                <span>
                  {index + 1}/{steps.length}
                </span>
              </div>
            </aside>
          </div>
        ))}
        <div className="graph-connector vertical-line" />
        <div className={workflowClosed ? "graph-final active" : "graph-final"}>
          <span className="graph-node-label">Fin del flujo</span>
          <strong>{workflowClosed ? "Cerrado" : "Pendiente"}</strong>
        </div>
      </div>
    </div>
  );
}

function HorizontalWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep
}: WorkflowGraphProps) {
  return (
    <div className="graph-viewport horizontal">
      <div className="horizontal-track">
        <div className="graph-trigger wide">
          <span className="graph-node-label">Disparador</span>
          <strong>{triggerLabel}</strong>
        </div>
        {steps.map((step) => (
          <div key={step.id} className="horizontal-step-group">
            <div className="graph-connector horizontal-line" />
            <button
              type="button"
              className={selectedStepId === step.id ? "step-node card selected" : "step-node card"}
              onClick={() => onSelectStep(step.id)}
            >
              <div className="card-mini-head">
                <span className="step-node-code">P{step.orden}</span>
                <span className={`mini-dot ${step.estado}`} />
              </div>
              <strong>{step.nombre}</strong>
              <small>{humanizeStatus(step.estado)}</small>
            </button>
          </div>
        ))}
        <div className="graph-connector horizontal-line" />
        <div className={workflowClosed ? "graph-final wide active" : "graph-final wide"}>
          <span className="graph-node-label">Fin del flujo</span>
          <strong>{workflowClosed ? "Cerrado" : "Pendiente"}</strong>
        </div>
      </div>
    </div>
  );
}

function TimelineWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep
}: WorkflowGraphProps) {
  return (
    <div className="timeline-graph">
      <TimelineRow
        sha={`TRG-${triggerLabel.slice(0, 3).toUpperCase()}`}
        title={triggerLabel}
        subtitle="Disparador origen"
        kind="trigger"
      />
      {steps.map((step) => (
        <TimelineRow
          key={step.id}
          sha={`P${step.orden.toString().padStart(2, "0")}`}
          title={step.nombre}
          subtitle={`${step.asignado_a ?? "Sin asignar"} - ${humanizeStatus(step.estado)}`}
          kind={step.estado === "completado" ? "done" : step.estado === "activo" ? "active" : "step"}
          selected={selectedStepId === step.id}
          onClick={() => onSelectStep(step.id)}
        />
      ))}
      <TimelineRow
        sha="HEAD"
        title={workflowClosed ? "Workflow finalizado" : "Fin del flujo"}
        subtitle={workflowClosed ? "Todos los pasos completados" : "Pendiente de cierre"}
        kind={workflowClosed ? "done" : "final"}
      />
    </div>
  );
}

type TimelineRowProps = {
  sha: string;
  title: string;
  subtitle: string;
  kind: "trigger" | "done" | "active" | "step" | "final";
  selected?: boolean;
  onClick?: () => void;
};

function TimelineRow({ sha, title, subtitle, kind, selected = false, onClick }: TimelineRowProps) {
  return (
    <button type="button" className={selected ? "timeline-row selected" : "timeline-row"} onClick={onClick}>
      <div className="timeline-rail">
        <span className={`timeline-dot ${kind}`} />
        <span className="timeline-line" />
      </div>
      <div className="timeline-content">
        <div className="timeline-head">
          <code>{sha}</code>
          <strong>{title}</strong>
        </div>
        <p>{subtitle}</p>
      </div>
    </button>
  );
}
