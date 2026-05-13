import type { Attachment, StepComment, StepHistoryEntry, StepStatus } from "./types";

export const DEFAULT_ACTOR = "sistema";

const statusPresentationMap: Record<string, { label: string; tone: string }> = {
  sin_flows: { label: "sin flows", tone: "espera" },
  pendiente: { label: "pendiente", tone: "espera" },
  en_proceso: { label: "en proceso", tone: "en_proceso" },
  resuelto: { label: "resuelto", tone: "finalizado" },
  cancelado: { label: "cancelado", tone: "cancelado" },
  con_problema: { label: "con problema", tone: "problema" },
  en_espera: { label: "en espera", tone: "espera" },
  activo: { label: "en proceso", tone: "en_proceso" },
  espera: { label: "en espera", tone: "espera" },
  esperando_respuesta: { label: "esperando respuesta", tone: "espera_externa" },
  completado: { label: "completada", tone: "completado" },
  problema: { label: "con problema", tone: "problema" },
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

  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!matched) {
    return formatDateOnly(value);
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatRelativeCalendarDay(value: string | null) {
  if (!value) {
    return null;
  }

  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  let targetDayMs: number | null = null;
  if (matched) {
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    targetDayMs = Date.UTC(year, month - 1, day);
  } else {
    const parsed = new Date(value);
    const parsedTime = parsed.getTime();
    if (!Number.isFinite(parsedTime)) {
      return null;
    }
    targetDayMs = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((targetDayMs - todayMs) / 86400000);

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
    }
  | {
      id: string;
      kind: "comment";
      author: string;
      date: string;
      body: string;
      secondaryText: string | null;
      attachments: Attachment[];
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

export function buildJournalItems(history: StepHistoryEntry[], comments: StepComment[]): JournalItem[] {
  const historyNoteTimestamps = new Map<string, number[]>();
  const nonCompletionStatusTimestamps: number[] = [];

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

  const statusEntries = history
    .filter((entry) => entry.campo === "estado")
    .map((entry) => ({
      id: `history-${entry.id}`,
      kind: "status" as const,
      author: entry.usuario,
      date: entry.fecha,
      body: "Estado cambiado",
      secondaryText:
        sanitizeHistoryNote(entry.nota) &&
        !(isCompletionText(entry.nota) && !isCompletionStatus(entry.valor_nuevo))
          ? sanitizeHistoryNote(entry.nota)
          : null,
      status: entry.valor_nuevo ?? "activo",
      previousStatus: entry.valor_anterior ?? null,
      nextStatus: entry.valor_nuevo ?? null,
      attachments: entry.attachments ?? []
    }));

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
      attachments: entry.attachments ?? []
    }));

  const commentEntries = comments
    .filter((comment) => {
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
      attachments: comment.attachments ?? []
    }));

  return [...statusEntries, ...historyNameEntries, ...historyNoteEntries, ...commentEntries].sort(
    (left, right) => formatJournalDateAsMs(right.date) - formatJournalDateAsMs(left.date)
  );
}
