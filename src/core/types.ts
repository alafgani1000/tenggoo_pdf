export type ToolCategory = 'pdf' | 'image' | 'utility';

export interface VirtualFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  items?: {
    type: 'string' | 'number' | 'integer' | 'boolean';
  };
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolExecutionContext {
  onProgress?: (percent: number, message?: string) => void;
}

export interface ToolExecutionResult {
  files: VirtualFile[];
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<TParams = Record<string, unknown>> {
  id: string;
  mcpName: string;
  category: ToolCategory;
  name: string;
  description: string;
  acceptsMimeTypes: string[];
  producesMimeTypes: string[];
  minInputs: number;
  maxInputs: number | null;
  parameterSchema: ToolParameterSchema;
  execute: (
    inputs: VirtualFile[],
    params: TParams,
    context?: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
}

export interface PipelineStep {
  tool: string;
  params?: Record<string, unknown>;
}

export interface PipelineStepSummary {
  stepIndex: number;
  tool: string;
  summary: string;
  inputCount: number;
  outputCount: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface PipelineExecutionResult {
  files: VirtualFile[];
  steps: PipelineStepSummary[];
  totalDurationMs: number;
}

/**
 * Parse a 1-based page range string (e.g. "1-3, 5, 8-10") into unique sorted 0-based page indices.
 * If rangeStr is empty or whitespace, returns all page indices [0..totalPages-1].
 */
export function parsePageRange(rangeStr: string | undefined, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const indices = new Set<number>();
  const parts = rangeStr
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startRaw, endRaw] = part.split('-').map((s) => s.trim());
      const start = parseInt(startRaw, 10);
      const end = parseInt(endRaw, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        const clampedStart = Math.max(1, start);
        const clampedEnd = Math.min(totalPages, end);
        for (let page = clampedStart; page <= clampedEnd; page++) {
          indices.add(page - 1);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!Number.isNaN(page) && page >= 1 && page <= totalPages) {
        indices.add(page - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

export function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'ico':
      return 'image/x-icon';
    case 'svg':
      return 'image/svg+xml';
    case 'zip':
      return 'application/zip';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

export function getBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export function replaceExtension(filename: string, newExt: string): string {
  const cleanExt = newExt.startsWith('.') ? newExt.slice(1) : newExt;
  const base = getBaseName(filename);
  return `${base}.${cleanExt}`;
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return { r: 0.39, g: 0.45, b: 0.54 };
  }

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return { r, g, b };
}

export function formatByteSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function isImageFile(file: VirtualFile): boolean {
  return (
    file.mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
  );
}

export function isPdfFile(file: VirtualFile): boolean {
  return file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name);
}
