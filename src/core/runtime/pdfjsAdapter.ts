import { createCanvasSurface, type CanvasImageFormat } from './canvasAdapter.ts';

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfTextItem {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
}

interface PdfPageLike {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  render: (params: {
    canvasContext: unknown;
    viewport: { width: number; height: number };
    canvas: unknown;
  }) => { promise: Promise<void> };
}

interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
}

interface PdfJsLike {
  getDocument: (options: Record<string, unknown>) => { promise: Promise<PdfDocumentLike> };
}

const isBrowserRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

async function resolveNodeStandardFontDataUrl(): Promise<string | undefined> {
  try {
    const pathMod = 'node:' + 'path';
    const urlMod = 'node:' + 'url';
    const fsMod = 'node:' + 'fs';
    const path = (await import(/* @vite-ignore */ pathMod)) as typeof import('node:path');
    const url = (await import(/* @vite-ignore */ urlMod)) as typeof import('node:url');
    const fs = (await import(/* @vite-ignore */ fsMod)) as typeof import('node:fs');

    const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(currentDir, '../../../node_modules/pdfjs-dist/standard_fonts'),
      path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate.endsWith(path.sep) || candidate.endsWith('/')
          ? candidate
          : `${candidate}/`;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function loadPdfDocument(
  bytes: Uint8Array,
  password?: string,
): Promise<PdfDocumentLike> {
  const dataCopy = new Uint8Array(bytes.byteLength);
  dataCopy.set(bytes);

  if (isBrowserRuntime()) {
    const { pdfjsLib } = await import('../../utils/pdfjs.ts');
    const task = pdfjsLib.getDocument({
      data: dataCopy,
      ...(password !== undefined ? { password } : {}),
    });
    return (await task.promise) as unknown as PdfDocumentLike;
  }

  const legacyPath = 'pdfjs-dist/legacy/build/' + 'pdf.mjs';
  const pdfjs = (await import(/* @vite-ignore */ legacyPath)) as unknown as PdfJsLike;
  const standardFontDataUrl = await resolveNodeStandardFontDataUrl();

  const task = pdfjs.getDocument({
    data: dataCopy,
    verbosity: 0,
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
    ...(password !== undefined ? { password } : {}),
  });
  return await task.promise;
}

export async function extractPdfTextPages(
  bytes: Uint8Array,
  password?: string,
): Promise<{ pageNumber: number; text: string; width: number; height: number }[]> {
  const doc = await loadPdfDocument(bytes, password);
  const pages: { pageNumber: number; text: string; width: number; height: number }[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const lineText = textContent.items
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({
      pageNumber: i,
      text: lineText,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
  }

  return pages;
}

export async function extractPdfPositionedText(
  bytes: Uint8Array,
  password?: string,
): Promise<{ pageNumber: number; width: number; height: number; items: PositionedTextItem[] }[]> {
  const doc = await loadPdfDocument(bytes, password);
  const pages: {
    pageNumber: number;
    width: number;
    height: number;
    items: PositionedTextItem[];
  }[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const items: PositionedTextItem[] = [];

    for (const rawItem of textContent.items) {
      const str = rawItem.str ?? '';
      if (!str.trim()) continue;
      const tr = rawItem.transform ?? [12, 0, 0, 12, 0, 0];
      const x = Number(tr[4] ?? 0);
      const y = Number(tr[5] ?? 0);
      const height = Number(rawItem.height || Math.abs(tr[3] || 12) || 12);
      const width = Number(rawItem.width ?? Math.max(6, str.length * height * 0.5));
      items.push({ str, x, y, width, height });
    }

    pages.push({
      pageNumber: i,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      items,
    });
  }

  return pages;
}

export async function renderLoadedPageToImageBytes(
  doc: PdfDocumentLike,
  pageNumber: number,
  options: {
    scale?: number;
    format?: CanvasImageFormat;
    quality?: number;
  } = {},
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const scale = options.scale ?? 2.0;
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  const surface = await createCanvasSurface(width, height);
  // White background ensures transparent PDF pages export cleanly to JPEG/PNG
  surface.ctx.fillStyle = '#ffffff';
  surface.ctx.fillRect(0, 0, width, height);

  await page.render({
    canvasContext: surface.ctx,
    viewport,
    canvas: surface.rawCanvas,
  }).promise;

  const encoded = await surface.toBytes(options.format ?? 'png', options.quality ?? 92);
  return {
    bytes: encoded,
    width,
    height,
  };
}

export async function renderPdfPageToImageBytes(
  bytes: Uint8Array,
  pageNumber: number,
  options: {
    scale?: number;
    format?: CanvasImageFormat;
    quality?: number;
    password?: string;
  } = {},
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const doc = await loadPdfDocument(bytes, options.password);
  return renderLoadedPageToImageBytes(doc, pageNumber, options);
}
