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
    placeholder: "Describe por que la tarea queda pausada y que condicion falta para retomarla..."
  },
  {
    value: "problema",
    label: "registrar problema",
    requiresNote: true,
    placeholder: "Describe el problema detectado y que hace falta para resolverlo..."
  }
];

export function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
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
      status: string;
      attachments: Attachment[];
    }
  | {
      id: string;
      kind: "comment";
      author: string;
      date: string;
      body: string;
      attachments: Attachment[];
    };

export function buildJournalItems(history: StepHistoryEntry[], comments: StepComment[]): JournalItem[] {
  const statusEntries = history
    .filter((entry) => entry.campo === "estado" && entry.nota)
    .map((entry) => ({
      id: `history-${entry.id}`,
      kind: "status" as const,
      author: entry.usuario,
      date: entry.fecha,
      body: entry.nota ?? "",
      status: entry.valor_nuevo ?? "activo",
      attachments: entry.attachments ?? []
    }));

  const historyNoteEntries = history
    .filter((entry) => entry.campo !== "estado" && ((entry.nota && entry.nota.trim()) || entry.attachments.length > 0))
    .map((entry) => ({
      id: `history-note-${entry.id}`,
      kind: "comment" as const,
      author: entry.usuario,
      date: entry.fecha,
      body: entry.nota ?? `Movimiento: ${entry.campo}`,
      attachments: entry.attachments ?? []
    }));

  const commentEntries = comments.map((comment) => ({
    id: `comment-${comment.id}`,
    kind: "comment" as const,
    author: comment.autor,
    date: comment.fecha_creacion,
    body: comment.comentario ?? "",
    attachments: comment.attachments ?? []
  }));

  return [...statusEntries, ...historyNoteEntries, ...commentEntries].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}
