export type CanvasImageFormat = 'png' | 'jpeg' | 'webp';

export interface LoadedImageSource {
  width: number;
  height: number;
  raw: unknown;
}

export interface Canvas2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  drawImage(image: unknown, ...args: number[]): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
}

export interface CanvasSurface {
  width: number;
  height: number;
  rawCanvas: unknown;
  ctx: Canvas2DLike;
  toBytes(format: CanvasImageFormat, quality?: number): Promise<Uint8Array>;
}

interface NodeCanvasModule {
  createCanvas: (width: number, height: number) => {
    width: number;
    height: number;
    getContext: (type: '2d') => Canvas2DLike;
    encode: (format: 'png' | 'jpeg' | 'webp', quality?: number) => Promise<Uint8Array>;
  };
  loadImage: (source: Uint8Array) => Promise<{ width: number; height: number }>;
}

const isBrowserRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

let cachedNodeCanvasModule: NodeCanvasModule | null = null;

async function getNodeCanvasModule(): Promise<NodeCanvasModule> {
  if (cachedNodeCanvasModule) return cachedNodeCanvasModule;
  const moduleName = '@napi-rs/' + 'canvas';
  const mod = (await import(/* @vite-ignore */ moduleName)) as unknown as NodeCanvasModule;
  cachedNodeCanvasModule = mod;
  return mod;
}

export async function loadImageSource(
  bytes: Uint8Array,
  mimeType: string = 'image/png',
): Promise<LoadedImageSource> {
  if (isBrowserRuntime()) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Failed to decode image in browser'));
        element.src = url;
      });
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        raw: img,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const { loadImage } = await getNodeCanvasModule();
  const img = await loadImage(bytes);
  return {
    width: img.width,
    height: img.height,
    raw: img,
  };
}

export async function createCanvasSurface(width: number, height: number): Promise<CanvasSurface> {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  if (isBrowserRuntime()) {
    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available');
    }

    return {
      width: safeWidth,
      height: safeHeight,
      rawCanvas: canvas,
      ctx: ctx as unknown as Canvas2DLike,
      async toBytes(format: CanvasImageFormat, quality: number = 85): Promise<Uint8Array> {
        const mime =
          format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
        const clampedQ = Math.max(0.01, Math.min(1, quality / 100));
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error(`Failed to encode canvas as ${format}`))),
            mime,
            format === 'png' ? undefined : clampedQ,
          );
        });
        const buf = await blob.arrayBuffer();
        return new Uint8Array(buf);
      },
    };
  }

  const { createCanvas } = await getNodeCanvasModule();
  const canvas = createCanvas(safeWidth, safeHeight);
  const ctx = canvas.getContext('2d');

  return {
    width: safeWidth,
    height: safeHeight,
    rawCanvas: canvas,
    ctx,
    async toBytes(format: CanvasImageFormat, quality: number = 85): Promise<Uint8Array> {
      const clampedQ = Math.max(1, Math.min(100, Math.round(quality)));
      const encoded =
        format === 'png' ? await canvas.encode('png') : await canvas.encode(format, clampedQ);
      return new Uint8Array(encoded);
    },
  };
}

export function formatToMimeType(format: CanvasImageFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

export function mimeTypeToCanvasFormat(mimeType: string, fallbackName?: string): CanvasImageFormat {
  const lower = `${mimeType} ${fallbackName ?? ''}`.toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  return 'jpeg';
}
