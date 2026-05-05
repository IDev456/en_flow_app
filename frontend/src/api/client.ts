const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const CONNECTION_ERROR = "No se pudo conectar con el servidor. Verificá que el backend esté corriendo.";

async function fetchOrThrow(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(CONNECTION_ERROR);
    }
    throw err;
  }
}

function formatValidationDetail(detail: unknown): string | null {
  if (!Array.isArray(detail)) {
    return null;
  }

  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const typedItem = item as { loc?: unknown; msg?: unknown };
      const message = typeof typedItem.msg === "string" ? typedItem.msg : null;
      if (!message) {
        return null;
      }

      if (Array.isArray(typedItem.loc)) {
        const path = typedItem.loc
          .filter((segment) => typeof segment === "string" || typeof segment === "number")
          .join(".");
        return path ? `${path}: ${message}` : message;
      }

      return message;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages.join(" | ") : null;
}

function buildErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  const formattedDetail = formatValidationDetail(detail);
  if (formattedDetail) {
    return formattedDetail;
  }

  if (typeof detail === "object" && detail !== null) {
    return JSON.stringify(detail);
  }

  return fallback;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const fallback = `Request failed: ${response.status}`;
    let message = fallback;

    try {
      const payload = (await response.json()) as unknown;
      message = buildErrorMessage(payload, fallback);
    } catch {
      // Keep the default error when the response has no JSON body.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetchOrThrow(`${API_URL}${path}`);
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchOrThrow(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchOrThrow(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return parseResponse<T>(response);
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetchOrThrow(`${API_URL}${path}`, { method: "DELETE" });

  if (response.status === 204) {
    return;
  }

  await parseResponse<unknown>(response);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchOrThrow(`${API_URL}${path}`, init);
  return parseResponse<T>(response);
}
