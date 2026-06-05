export type TriggerStatus = "sin_flows" | "en_proceso" | "esperando_respuesta" | "con_problema" | "resuelto" | "cancelado";
export type WorkflowStatus = "pendiente" | "en_proceso" | "esperando_respuesta" | "en_espera" | "con_problema" | "finalizado" | "cancelado";
export type WorkflowStartMode = "tarea_activa" | "esperando";
export type WorkflowDateContext = "activa" | "espera" | "cerrado" | "sin_fecha";
export type StepStatus = "activo" | "espera" | "problema" | "esperando_respuesta" | "completado" | "cancelada";
export type StepTransitionType = "next_task" | "wait_external" | "finish_flow";
export type WorkLogEntryType = "comment" | "status_change" | "field_change" | "external_event";
export type Ambito = "laboral" | "personal" | null;

export type Attachment = {
  id: string;
  nombre: string;
  content_type: string;
  size_bytes: number;
  content_base64: string;
};

export type AttachmentInput = {
  nombre: string;
  content_type: string;
  size_bytes: number;
  content_base64: string;
};

export type Trigger = {
  id: string;
  solicitante: string | null;
  descripcion: string | null;
  tipo: string;
  ambito: Ambito;
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
  trigger_id: string | null;
  requirement_ids: string[];
  workflow_template_id: string;
  workflow_template_nombre: string;
  ambito: Ambito;
  estado: WorkflowStatus;
  pasos_activos: number[];
  paso_actual: number | null;
  total_pasos: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_ejecucion_actual: string | null;
  fecha_recordatorio_actual: string | null;
  fecha_espera_desde: string | null;
  contexto_fecha_actual: WorkflowDateContext;
  objetivo_final: string | null;
  resolucion_esperada: string | null;
};

export type Step = {
  id: string;
  workflow_id: string;
  step_template_id: string | null;
  codigo: string | null;
  depends_on: string[];
  nombre: string;
  descripcion: string | null;
  orden: number;
  tipo: string;
  requiere_aprobacion: boolean;
  puede_tener_comentarios: boolean;
  action_type: string;
  action_config: Record<string, unknown> | null;
  action_label: string | null;
  waits_for_external_response: boolean;
  expected_external_event: string | null;
  esperando_de: string | null;
  external_wait_reason: string | null;
  external_reference: string | null;
  estado: StepStatus;
  fecha_estado_actual: string;
  asignado_a: string | null;
  fecha_creacion: string;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
  fecha_ejecucion_estimada: string | null;
  fecha_cierre: string | null;
  resultado: string | null;
  observaciones: string | null;
  ambito: Ambito;
  ultimo_comentario: string | null;
  ultimo_comentario_fecha: string | null;
  ultimo_comentario_tipo: "texto" | "adjunto" | "imagen" | null;
  ultimo_comentario_adjunto_nombre: string | null;
  ultimo_comentario_adjunto_content_type: string | null;
};

export type WorkflowDetail = WorkflowSummary & {
  steps: Step[];
};

export type DailyBoardData = {
  tareas_activas: Step[];
  tareas_esperando_respuesta: Step[];
  tareas_en_pausa: Step[];
  tareas_con_problema: Step[];
  flows_recientes: WorkflowSummary[];
  flows_cerrados_recientes: WorkflowSummary[];
};

export type WorkLogEntry = {
  id: string;
  timestamp: string;
  entry_type: WorkLogEntryType;
  summary: string;
  author: string;
  step_id: string;
  step_name: string;
  step_order: number;
  workflow_id: string;
  workflow_title: string | null;
  requirement_id: string | null;
  requirement_title: string | null;
  attachments_count: number;
};

export type StepComment = {
  id: string;
  step_instance_id: string;
  autor: string;
  comentario: string | null;
  fecha_creacion: string;
  attachments: Attachment[];
};

export type StepHistoryEntry = {
  id: string;
  step_instance_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario: string;
  fecha: string;
  nota: string | null;
  attachments: Attachment[];
};

export type ExternalEvent = {
  id: string;
  workflow_id: string;
  step_id: string;
  event_type: string;
  source: string;
  payload: Record<string, unknown> | null;
  comentario: string | null;
  attachments: Attachment[];
  fecha_creacion: string;
  registrado_por: string;
};

export type TriggerCreateInput = {
  solicitante: string | null;
  descripcion: string | null;
  tipo: string;
  ambito: Exclude<Ambito, null>;
  creado_por?: string;
  metadata: Record<string, unknown> | null;
};

export type TriggerUpdateInput = {
  solicitante?: string | null;
  descripcion?: string | null;
  tipo?: string | null;
  ambito?: Ambito;
  propagate_ambito?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type WorkflowStartInput = {
  workflow_template_id?: string;
  objetivo_final?: string | null;
  resolucion_esperada?: string | null;
  ambito?: Ambito;
  modo_inicio?: WorkflowStartMode;
  primer_paso?: {
    nombre: string;
    descripcion?: string | null;
    asignado_a?: string | null;
    fecha_vencimiento?: string | null;
    fecha_ejecucion_estimada?: string | null;
  };
  espera_inicial?: WaitingStartInput | null;
};

export type StepCompleteInput = {
  usuario: string;
  resultado_cierre: string;
  comentario?: string | null;
  observaciones: string | null;
  transition_type: StepTransitionType;
  next_task?: NextTaskInput | null;
  external_wait?: ExternalWaitInput | null;
  finish_data?: FinishFlowInput | null;
  attachments?: AttachmentInput[];
};

export type NextTaskInput = {
  nombre: string;
  descripcion?: string | null;
  asignado_a?: string | null;
  fecha_vencimiento?: string | null;
  fecha_ejecucion_estimada?: string | null;
};

export type ExternalWaitInput = {
  que_se_espera: string;
  origen?: string | null;
  esperando_de?: string | null;
  detalle?: string | null;
  referencia_externa?: string | null;
  fecha_recordatorio?: string | null;
  attachments?: AttachmentInput[];
};

export type WaitingStartInput = {
  que_se_espera: string;
  esperando_de?: string | null;
  detalle?: string | null;
  referencia_externa?: string | null;
  fecha_espera_desde?: string | null;
  fecha_recordatorio?: string | null;
};

export type FinishFlowInput = {
  resultado_final?: string | null;
  motivo_cierre?: string | null;
  attachments?: AttachmentInput[];
};

export type StepStatusUpdateInput = {
  estado: StepStatus;
  usuario: string;
  nota?: string | null;
  attachments?: AttachmentInput[];
};

export type StepDateUpdateInput = {
  fecha_vencimiento: string | null;
};

export type StepCommentInput = {
  autor: string;
  comentario: string | null;
  attachments?: AttachmentInput[];
};

export type StepCommentUpdateInput = {
  autor?: string;
  comentario: string | null;
};

export type StepJournalEntryInput = {
  comentario: string | null;
  estado?: Extract<StepStatus, "espera" | "problema"> | null;
  attachments?: AttachmentInput[];
};

export type ExternalEventCreateInput = {
  event_type: string;
  source?: string;
  payload?: Record<string, unknown> | null;
  comentario?: string | null;
  attachments?: AttachmentInput[];
  registrado_por?: string;
};

export type ExternalResponseDecisionInput = {
  usuario: string;
  resultado_cierre: string;
  comentario?: string | null;
  transition_type: Extract<StepTransitionType, "next_task" | "finish_flow">;
  next_task?: NextTaskInput | null;
  finish_data?: FinishFlowInput | null;
  attachments?: AttachmentInput[];
};

export type QuickCaptureInput = {
  titulo: string;
  detalle?: string | null;
  asignado_a?: string | null;
  fecha_vencimiento?: string | null;
  fecha_ejecucion_estimada?: string | null;
  modo_inicio?: WorkflowStartMode;
  espera_inicial?: WaitingStartInput | null;
  creado_por?: string;
  ambito: Exclude<Ambito, null>;
};

export type LinkRequirementInput = {
  requirement_id: string;
};

export type CreateRequirementFromFlowInput = {
  descripcion: string;
  solicitante?: string | null;
  creado_por?: string;
};

export type WorkflowUpdateInput = {
  objetivo_final?: string | null;
  ambito?: Ambito;
  propagate_ambito?: boolean;
};

export type StepUpdateInput = {
  nombre?: string;
  descripcion?: string | null;
  fecha_ejecucion_estimada?: string | null;
  expected_external_event?: string | null;
  esperando_de?: string | null;
  external_wait_reason?: string | null;
  external_reference?: string | null;
  fecha_espera_desde?: string | null;
};
