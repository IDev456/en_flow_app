export type TriggerStatus = "nuevo" | "en_proceso" | "resuelto" | "cancelado";
export type WorkflowStatus = "pendiente" | "en_proceso" | "finalizado" | "cancelado";
export type StepStatus =
  | "pendiente"
  | "activo"
  | "en_revision"
  | "completado"
  | "bloqueado"
  | "cancelado";
export type TriggerPriority = "baja" | "media" | "alta" | "critica";

export type Trigger = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  prioridad: TriggerPriority;
  estado_general: TriggerStatus;
  fecha_creacion: string;
  fecha_actualizacion: string;
  creado_por: string;
  metadata: Record<string, unknown> | null;
  workflow_activo_id: string | null;
};

export type TriggerDetail = Trigger & {
  workflow_ids: string[];
};

export type WorkflowSummary = {
  id: string;
  trigger_id: string;
  workflow_template_id: string;
  workflow_template_nombre: string;
  estado: WorkflowStatus;
  paso_actual: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  objetivo_final: string | null;
  resolucion_esperada: string | null;
};

export type Step = {
  id: string;
  workflow_id: string;
  step_template_id: string | null;
  nombre: string;
  descripcion: string | null;
  orden: number;
  tipo: string;
  requiere_aprobacion: boolean;
  puede_tener_comentarios: boolean;
  estado: StepStatus;
  asignado_a: string | null;
  fecha_creacion: string;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
  fecha_cierre: string | null;
  resultado: string | null;
  observaciones: string | null;
};

export type WorkflowDetail = WorkflowSummary & {
  steps: Step[];
};

export type StepComment = {
  id: string;
  step_instance_id: string;
  autor: string;
  comentario: string;
  fecha_creacion: string;
};

export type StepHistoryEntry = {
  id: string;
  step_instance_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario: string;
  fecha: string;
};

export type TriggerCreateInput = {
  titulo: string;
  descripcion: string | null;
  tipo: string;
  prioridad: TriggerPriority;
  creado_por: string;
  metadata: Record<string, unknown> | null;
};

export type WorkflowStartInput = {
  workflow_template_id?: string;
  objetivo_final?: string | null;
  resolucion_esperada?: string | null;
  primer_paso?: {
    nombre?: string | null;
    descripcion?: string | null;
    asignado_a?: string | null;
    fecha_vencimiento?: string | null;
  };
};

export type StepCompleteInput = {
  usuario: string;
  resultado: string | null;
  observaciones: string | null;
  comentario_final: string | null;
};

export type StepCommentInput = {
  autor: string;
  comentario: string;
};
