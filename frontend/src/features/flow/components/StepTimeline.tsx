import { Link } from "react-router-dom";

import type { Step } from "../types";
import { formatDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

type StepTimelineProps = {
  steps: Step[];
};

export function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <ol className="step-timeline">
      {steps.map((step) => (
        <li key={step.id} className={`step-card ${step.estado === "activo" ? "is-current" : ""}`}>
          <div className="step-card-head">
            <div>
              <p className="step-order">Paso {step.orden}</p>
              <h3>{step.nombre}</h3>
            </div>
            <StatusBadge value={step.estado} />
          </div>
          {step.descripcion && <p className="muted">{step.descripcion}</p>}
          <div className="step-meta">
            <span>Tipo: {step.tipo}</span>
            <span>Inicio: {formatDate(step.fecha_inicio)}</span>
          </div>
          <Link className="text-link" to={`/steps/${step.id}`}>
            Ver detalle del paso
          </Link>
        </li>
      ))}
    </ol>
  );
}

