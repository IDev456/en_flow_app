import type { Ambito, Attachment, StepComment, StepHistoryEntry, StepStatus, TriggerStatus, WorkflowDetail } from "./types";

export const DEFAULT_ACTOR = "sistema";
export const ACTIVE_AMBITO_STORAGE_KEY = "enflow_active_ambito";
export const REMINDER_PAST_ERROR = "El recordatorio no puede ser una fecha pasada.";
export const activeAmbitoOptions = [
  { value: "laboral", label: "Laboral" },
  { value: "personal", label: "Personal" },
] as const;
export type ActiveAmbitoMode = (typeof activeAmbitoOptions)[number]["value"];

export function getStoredActiveAmbito(): ActiveAmbitoMode {
  if (typeof window === "undefined") {
    return "laboral";
  }
  const stored = window.localStorage.getItem(ACTIVE_AMBITO_STORAGE_KEY);
  return stored === "personal" ? "personal" : "laboral";
}

export function setStoredActiveAmbito(ambito: ActiveAmbitoMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVE_AMBITO_STORAGE_KEY, ambito);
}

export function getAmbitoLabel(ambito: Ambito) {
  if (ambito === "laboral") return "Laboral";
  if (ambito === "personal") return "Personal";
  return "Sin definir";
}

export function matchesActiveAmbito(ambito: Ambito, activeAmbito: ActiveAmbitoMode) {
  return ambito === activeAmbito;
}

const statusPresentationMap: Record<string, { label: string; tone: string }> = {
  operativo: { label: "Operativo", tone: "en_proceso" },
  no_operativo: { label: "No operativo", tone: "cancelado" },
  sin_flows: { label: "sin flows", tone: "espera" },
  pendiente: { label: "en proceso", tone: "en_proceso" },
  en_proceso: { label: "en proceso", tone: "en_proceso" },
  resuelto: { label: "finalizado", tone: "finalizado" },
  cancelado: { label: "cancelado", tone: "cancelado" },
  con_problema: { label: "en proceso", tone: "en_proceso" },
  en_espera: { label: "esperando respuesta", tone: "espera_externa" },
  activo: { label: "en proceso", tone: "en_proceso" },
  espera: { label: "esperando respuesta", tone: "espera_externa" },
  esperando_respuesta: { label: "esperando respuesta", tone: "espera_externa" },
  completado: { label: "completada", tone: "completado" },
  problema: { label: "en proceso", tone: "en_proceso" },
  cancelada: { label: "cancelada", tone: "cancelado" },
  finalizado: { label: "finalizado", tone: "finalizado" }
};

export const stepStatusOptions: Array<{
  value: Extract<StepStatus, "espera" | "problema">;
  label: string;
  requiresNote: boolean;
  placeholder: string;
}> = [
  {
    value: "espera",
    label: "pausar tarea",
    requiresNote: true,
    placeholder: "Describe por qué la tarea queda pausada y qué condición falta para retomarla..."
  },
  {
    value: "problema",
    label: "registrar problema",
    requiresNote: true,
    placeholder: "Describe el problema detectado y qué hace falta para resolverlo..."
  }
];

export function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDateOnly(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCalendarDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const calendarDay = toCalendarDayValue(value);
  if (calendarDay === null) {
    return formatDateOnly(value);
  }

  const date = new Date(calendarDay * 86400000);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function padCalendarPart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatCalendarDayInput(dayValue: number) {
  const date = new Date(dayValue * 86400000);
  return `${date.getUTCFullYear()}-${padCalendarPart(date.getUTCMonth() + 1)}-${padCalendarPart(date.getUTCDate())}`;
}

export function toCalendarDateInputValue(value: string | null | undefined) {
  const calendarDay = toCalendarDayValue(value ?? null);
  if (calendarDay === null) {
    return "";
  }
  return formatCalendarDayInput(calendarDay);
}

function parseCalendarValue(value: string) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (matched) {
    return {
      year: Number(matched[1]),
      month: Number(matched[2]),
      day: Number(matched[3]),
    };
  }

  const parsed = new Date(value);
  const parsedTime = parsed.getTime();
  if (!Number.isFinite(parsedTime)) {
    return null;
  }

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

export function formatLocalDateInput(value: Date) {
  const year = value.getFullYear();
  const month = padCalendarPart(value.getMonth() + 1);
  const day = padCalendarPart(value.getDate());
  return `${year}-${month}-${day}`;
}

export function getTodayLocalDateInput() {
  return formatLocalDateInput(new Date());
}

type DateInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export function openNativeDateInputPicker(input: HTMLInputElement | null | undefined) {
  if (!input) {
    return false;
  }

  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }

  const dateInput = input as DateInputWithPicker;
  if (typeof dateInput.showPicker === "function") {
    try {
      dateInput.showPicker();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function toCalendarDayValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseCalendarValue(value);
  if (!parsed) {
    return null;
  }

  const dayMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  return Math.floor(dayMs / 86400000);
}

export function toCalendarDateUtcIso(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return `${trimmed}T00:00:00Z`;
}

export function isPastCalendarDateInput(value: string | null | undefined, baseValue: string | null = null) {
  const targetDay = toCalendarDayValue(value ?? null);
  if (targetDay === null) {
    return false;
  }
  const baseDay = toCalendarDayValue(baseValue ?? getTodayLocalDateInput());
  if (baseDay === null) {
    return false;
  }
  return targetDay < baseDay;
}

export function getReminderDateError(value: string | null | undefined, baseValue: string | null = null) {
  return isPastCalendarDateInput(value, baseValue) ? REMINDER_PAST_ERROR : null;
}

export function getRelativeCalendarDateInput(offsetDays: number, baseValue: string | null = null) {
  const baseDay = toCalendarDayValue(baseValue ?? getTodayLocalDateInput());
  if (baseDay === null) {
    return getTodayLocalDateInput();
  }
  return formatCalendarDayInput(baseDay + offsetDays);
}

export function getCalendarDayDiff(targetValue: string | null, baseValue: string | null = null) {
  const targetDay = toCalendarDayValue(targetValue);
  if (targetDay === null) {
    return null;
  }

  const baseDay = baseValue ? toCalendarDayValue(baseValue) : toCalendarDayValue(getTodayLocalDateInput());
  if (baseDay === null) {
    return null;
  }

  return targetDay - baseDay;
}

export function formatRelativeCalendarDay(value: string | null) {
  if (!value) {
    return null;
  }

  const diffDays = getCalendarDayDiff(value);
  if (diffDays === null) {
    return null;
  }

  if (diffDays === 0) {
    return "Hoy";
  }
  if (diffDays === -1) {
    return "Ayer";
  }
  if (diffDays < -1) {
    return `Hace ${Math.abs(diffDays)} días`;
  }
  if (diffDays === 1) {
    return "Mañana";
  }
  if (diffDays > 1) {
    return `En ${diffDays} días`;
  }

  return null;
}

export function formatElapsedTime(value: string | null) {
  if (!value) {
    return null;
  }

  const start = new Date(value).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "hace instantes";
  }
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function humanizeStatus(value: string) {
  return statusPresentationMap[value]?.label ?? value.replaceAll("_", " ");
}

export function getStatusTone(value: string) {
  return statusPresentationMap[value]?.tone ?? value;
}

export type VisibleFlowStatus = "en_proceso" | "esperando_respuesta" | "cancelado" | "finalizado";

export function getVisibleTriggerStatus(status: TriggerStatus | string) {
  if (status === "esperando_respuesta" || status === "en_espera" || status === "espera") {
    return "esperando_respuesta";
  }
  if (status === "con_problema" || status === "problema") {
    return "en_proceso";
  }
  if (status === "resuelto") {
    return "finalizado";
  }
  if (status === "pendiente" || status === "activo") {
    return "en_proceso";
  }
  return status;
}

export function getVisibleWorkflowStatusValue(status: string): VisibleFlowStatus {
  if (status === "cancelado") {
    return "cancelado";
  }
  if (status === "finalizado" || status === "resuelto") {
    return "finalizado";
  }
  if (status === "esperando_respuesta" || status === "en_espera" || status === "espera") {
    return "esperando_respuesta";
  }
  return "en_proceso";
}

export function getVisibleWorkflowStatus(workflow: Pick<WorkflowDetail, "estado" | "steps">): VisibleFlowStatus {
  const baseStatus = getVisibleWorkflowStatusValue(workflow.estado);
  if (baseStatus !== "en_proceso") {
    return baseStatus;
  }

  const openSteps = workflow.steps.filter((step) => step.estado !== "completado" && step.estado !== "cancelada");
  if (openSteps.some((step) => step.estado === "esperando_respuesta" || step.estado === "espera")) {
    return "esperando_respuesta";
  }

  return "en_proceso";
}

export function formatProgress(done: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((done / total) * 100);
}

export type JournalItem =
  | {
      id: string;
      kind: "status";
      author: string;
      date: string;
      body: string;
      secondaryText: string | null;
      status: string;
      previousStatus: string | null;
      nextStatus: string | null;
      attachments: Attachment[];
      commentId: string | null;
      editable: boolean;
      editableBody: string | null;
      editableAttachments: Attachment[];
    }
  | {
      id: string;
      kind: "comment";
      author: string;
      date: string;
      body: string;
      secondaryText: string | null;
      attachments: Attachment[];
      commentId: string | null;
      editable: boolean;
    }
  | {
      id: string;
      kind: "rename";
      author: string;
      date: string;
      body: string;
      secondaryText: string | null;
      previousName: string;
      nextName: string;
      attachments: Attachment[];
    };

function normalizeJournalText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAutoNextTaskMessage(value: string) {
  const normalized = normalizeJournalText(value);
  if (!normalized) return false;
  return normalized.includes("se creo la proxima tarea") || normalized.includes("tarea creada desde cierre dinamico");
}

export function isNoisyAutomaticJournalText(value: string | null | undefined): boolean {
  const normalized = normalizeJournalText(value ?? "");
  if (!normalized) return false;

  return (
    normalized.includes("tarea creada desde cierre dinamico") ||
    normalized.includes("se creo la proxima tarea") ||
    normalized.includes("esperando respuesta externa de externo") ||
    normalized.includes("esperando respuesta de externo")
  );
}

function isCompletionStatus(value: string | null | undefined): boolean {
  const normalized = normalizeJournalText(value ?? "");
  return normalized === "completado";
}

function isCompletionText(value: string | null | undefined): boolean {
  const normalized = normalizeJournalText(value ?? "");
  return normalized === "tarea completada";
}

function isGenericStatusNote(value: string | null | undefined): boolean {
  const normalized = normalizeJournalText(value ?? "");
  return normalized === "tarea completada";
}

function isNameHistoryField(value: string | null | undefined): boolean {
  const normalized = normalizeJournalText(value ?? "");
  if (!normalized) return false;
  return normalized.includes("nombre") || normalized.includes("name") || normalized.includes("title");
}

function sanitizeHistoryNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (isNoisyAutomaticJournalText(trimmed)) return null;
  return trimmed;
}

function formatJournalDateAsMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNameValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "sin nombre";
}

function hasNearbyTimestamp(referenceMs: number, values: number[], thresholdMs: number): boolean {
  return values.some((valueMs) => Math.abs(referenceMs - valueMs) <= thresholdMs);
}

function combineJournalText(primary: string | null, secondary: string | null) {
  const left = primary?.trim() ?? "";
  const right = secondary?.trim() ?? "";
  if (!left) return right || null;
  if (!right) return left || null;
  if (normalizeJournalText(left) === normalizeJournalText(right)) return left;
  return `${left}\n\n${right}`;
}

function mergeAttachments(primary: Attachment[], secondary: Attachment[]) {
  const merged = [...primary];
  const seenIds = new Set(primary.map((attachment) => attachment.id));

  secondary.forEach((attachment) => {
    if (seenIds.has(attachment.id)) {
      return;
    }
    merged.push(attachment);
    seenIds.add(attachment.id);
  });

  return merged;
}

export function buildJournalItems(history: StepHistoryEntry[], comments: StepComment[]): JournalItem[] {
  const nonCompletionStatusTimestamps: number[] = [];
  const historyNoteTimestamps = new Map<string, number[]>();

  history.forEach((entry) => {
    if (entry.campo === "estado" && !isCompletionStatus(entry.valor_nuevo)) {
      nonCompletionStatusTimestamps.push(formatJournalDateAsMs(entry.fecha));
    }

    const note = sanitizeHistoryNote(entry.nota);
    if (!note) return;
    if (isCompletionText(note) && entry.campo === "estado" && !isCompletionStatus(entry.valor_nuevo)) {
      return;
    }
    const normalized = normalizeJournalText(note);
    const current = historyNoteTimestamps.get(normalized) ?? [];
    current.push(formatJournalDateAsMs(entry.fecha));
    historyNoteTimestamps.set(normalized, current);
  });

  const mergedCommentIds = new Set<string>();
  const statusEntries = [...history]
    .filter((entry) => entry.campo === "estado")
    .sort((left, right) => formatJournalDateAsMs(right.fecha) - formatJournalDateAsMs(left.fecha))
    .map((entry) => {
      const entryDateMs = formatJournalDateAsMs(entry.fecha);
      const entryAuthor = normalizeJournalText(entry.usuario);
      const mergedComment = comments
        .filter((comment) => !mergedCommentIds.has(comment.id))
        .filter((comment) => normalizeJournalText(comment.autor) === entryAuthor)
        .filter((comment) => !isNoisyAutomaticJournalText(comment.comentario))
        .map((comment) => ({
          comment,
          commentDateMs: formatJournalDateAsMs(comment.fecha_creacion),
        }))
        .filter(({ commentDateMs }) => Math.abs(commentDateMs - entryDateMs) <= 5 * 60 * 1000)
        .sort((left, right) => Math.abs(left.commentDateMs - entryDateMs) - Math.abs(right.commentDateMs - entryDateMs))[0]?.comment ?? null;

      if (mergedComment) {
        mergedCommentIds.add(mergedComment.id);
      }

      const historyNote =
        sanitizeHistoryNote(entry.nota) &&
        !(isCompletionText(entry.nota) && !isCompletionStatus(entry.valor_nuevo))
          ? sanitizeHistoryNote(entry.nota)
          : null;
      const mergedCommentText = mergedComment?.comentario?.trim() ?? null;

      const combinedSecondaryText = combineJournalText(historyNote, mergedCommentText);

      return {
        id: `history-${entry.id}`,
        kind: "status" as const,
        author: entry.usuario,
        date: entry.fecha,
        body: entry.valor_anterior === null && entry.valor_nuevo === "activo" ? "Tarea creada" : "Estado cambiado",
        secondaryText: isGenericStatusNote(combinedSecondaryText) ? null : combinedSecondaryText,
        status: entry.valor_nuevo ?? "activo",
        previousStatus: entry.valor_anterior ?? null,
        nextStatus: entry.valor_nuevo ?? null,
        attachments: mergeAttachments(entry.attachments ?? [], mergedComment?.attachments ?? []),
        commentId: mergedComment?.id ?? null,
        editable: Boolean(mergedComment?.id),
        editableBody: mergedComment?.comentario ?? null,
        editableAttachments: mergedComment?.attachments ?? [],
      };
    });

  const historyNameEntries = history
    .filter((entry) => isNameHistoryField(entry.campo))
    .filter((entry) => {
      const previousName = (entry.valor_anterior ?? "").trim();
      const nextName = (entry.valor_nuevo ?? "").trim();
      const note = sanitizeHistoryNote(entry.nota);
      return previousName.length > 0 || nextName.length > 0 || Boolean(note) || (entry.attachments?.length ?? 0) > 0;
    })
    .map((entry) => ({
      id: `history-name-${entry.id}`,
      kind: "rename" as const,
      author: entry.usuario,
      date: entry.fecha,
      body: "Nombre actualizado",
      secondaryText: sanitizeHistoryNote(entry.nota),
      previousName: formatNameValue(entry.valor_anterior),
      nextName: formatNameValue(entry.valor_nuevo),
      attachments: entry.attachments ?? []
    }));

  const historyNoteEntries = history
    .filter((entry) => {
      if (entry.campo === "estado") return false;
      if (isNameHistoryField(entry.campo)) return false;
      if (!((entry.nota && entry.nota.trim()) || entry.attachments.length > 0)) return false;
      const note = sanitizeHistoryNote(entry.nota);
      if (!note && entry.attachments.length === 0) return false;
      return !isAutoNextTaskMessage(entry.nota ?? "");
    })
    .map((entry) => ({
      id: `history-note-${entry.id}`,
      kind: "comment" as const,
      author: entry.usuario,
      date: entry.fecha,
      body: sanitizeHistoryNote(entry.nota) ?? `Movimiento: ${entry.campo}`,
      secondaryText: null,
      attachments: entry.attachments ?? [],
      commentId: null,
      editable: false,
    }));

  const commentEntries = comments
    .filter((comment) => {
      if (mergedCommentIds.has(comment.id)) return false;
      const text = comment.comentario?.trim() ?? "";
      if (isNoisyAutomaticJournalText(text)) return false;
      if (
        isCompletionText(text) &&
        hasNearbyTimestamp(formatJournalDateAsMs(comment.fecha_creacion), nonCompletionStatusTimestamps, 5 * 60 * 1000)
      ) {
        return false;
      }
      if (!text) return (comment.attachments?.length ?? 0) > 0;
      const normalized = normalizeJournalText(text);
      const relatedHistoryDates = historyNoteTimestamps.get(normalized);
      if (!relatedHistoryDates || relatedHistoryDates.length === 0) {
        return true;
      }
      const commentDateMs = formatJournalDateAsMs(comment.fecha_creacion);
      return !hasNearbyTimestamp(commentDateMs, relatedHistoryDates, 5 * 60 * 1000);
    })
    .map((comment) => ({
      id: `comment-${comment.id}`,
      kind: "comment" as const,
      author: comment.autor,
      date: comment.fecha_creacion,
      body: comment.comentario ?? "",
      secondaryText: null,
      attachments: comment.attachments ?? [],
      commentId: comment.id,
      editable: true,
    }));

  return [...statusEntries, ...historyNameEntries, ...historyNoteEntries, ...commentEntries].sort(
    (left, right) => formatJournalDateAsMs(right.date) - formatJournalDateAsMs(left.date)
  );
}
