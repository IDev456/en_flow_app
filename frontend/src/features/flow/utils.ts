export function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function humanizeStatus(value: string) {
  return value.replaceAll("_", " ");
}

export function priorityLabel(value: string) {
  const map: Record<string, string> = {
    baja: "baja",
    media: "media",
    alta: "alta",
    critica: "critica"
  };
  return map[value] ?? value;
}

export function formatProgress(done: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((done / total) * 100);
}
