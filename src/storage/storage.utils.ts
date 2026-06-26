import { randomUUID } from 'crypto';

export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
  const sanitized = base.replace(/[^\w.\-() ]+/g, '_').trim();
  return sanitized.length > 0 ? sanitized.slice(0, 200) : 'file';
}

export function buildKnowledgeObjectKey(
  knowledgeId: string,
  attachmentId: string,
  originalFilename: string,
): string {
  const safeName = sanitizeFilename(originalFilename);
  return `knowledge/${knowledgeId}/${attachmentId}/${safeName}`;
}

export function buildTaskEvidenceObjectKey(
  taskId: string,
  evidenceId: string,
  originalFilename: string,
): string {
  const safeName = sanitizeFilename(originalFilename);
  return `tasks/${taskId}/evidence/${evidenceId}/${safeName}`;
}

export function newAttachmentId(): string {
  return randomUUID();
}

export function parseTagsInput(tags?: string): string[] {
  if (!tags?.trim()) return [];

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

export function contentDispositionFilename(filename: string): string {
  const ascii = sanitizeFilename(filename).replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
