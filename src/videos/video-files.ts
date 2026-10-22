export const VIDEO_FILE_KINDS = [
  'recording',
  'cursor',
  'export',
  'background',
] as const;

export type VideoFileKind = (typeof VIDEO_FILE_KINDS)[number];

export function isVideoFileKind(value: string): value is VideoFileKind {
  return (VIDEO_FILE_KINDS as readonly string[]).includes(value);
}

export interface VideoFileRule {
  mimeTypes: readonly string[];
  /** null = fall back to the server's global upload cap. */
  maxBytes: number | null;
}

export const VIDEO_FILE_RULES: Record<VideoFileKind, VideoFileRule> = {
  recording: {
    mimeTypes: ['video/webm', 'video/mp4'],
    maxBytes: null,
  },
  cursor: {
    mimeTypes: ['application/json'],
    maxBytes: 5 * 1024 * 1024,
  },
  export: {
    mimeTypes: ['video/webm', 'video/mp4'],
    maxBytes: null,
  },
  background: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
  },
};

export function baseMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase();
}

const MIME_EXTENSIONS: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'application/json': 'json',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function extensionFor(_kind: VideoFileKind, mime: string): string {
  return MIME_EXTENSIONS[baseMime(mime)] ?? 'bin';
}
