import type { Attachment, AttachmentInput } from "../types";

export type LocalAttachmentDraft = AttachmentInput & {
  local_id: string;
};

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function createAttachmentLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAttachmentFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const sizeKb = sizeBytes / 1024;
  if (sizeKb < 1024) {
    return `${sizeKb.toFixed(1)} KB`;
  }
  return `${(sizeKb / 1024).toFixed(1)} MB`;
}

export function attachmentToPreviewSrc(attachment: Pick<AttachmentInput, "content_type" | "content_base64">) {
  return `data:${attachment.content_type};base64,${attachment.content_base64}`;
}

export function toLocalAttachmentDraft(input: AttachmentInput, localId: string = createAttachmentLocalId()): LocalAttachmentDraft {
  return {
    ...input,
    local_id: localId,
  };
}

export function toLocalAttachmentDraftFromAttachment(attachment: Attachment) {
  return toLocalAttachmentDraft(
    {
      nombre: attachment.nombre,
      content_type: attachment.content_type,
      size_bytes: attachment.size_bytes,
      content_base64: attachment.content_base64,
    },
    attachment.id
  );
}

export async function readFileAsAttachment(file: File): Promise<AttachmentInput> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`El archivo "${file.name}" supera el limite de 5 MB`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}"`));
    reader.readAsDataURL(file);
  });

  const [, contentBase64 = ""] = dataUrl.split(",", 2);
  return {
    nombre: file.name,
    content_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    content_base64: contentBase64,
  };
}

export async function readFilesAsAttachments(files: File[]) {
  return Promise.all(files.map((file) => readFileAsAttachment(file)));
}

export async function readFilesAsLocalAttachments(files: File[]) {
  const attachments = await readFilesAsAttachments(files);
  return attachments.map((attachment) => toLocalAttachmentDraft(attachment));
}

export function extractImageFilesFromClipboardData(clipboardData: DataTransfer | null) {
  if (!clipboardData) {
    return [];
  }
  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
