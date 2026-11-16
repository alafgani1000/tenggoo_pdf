import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  formatByteSize,
  getBaseName,
  guessMimeType,
  replaceExtension,
} from '../types.ts';
import type { ToolDefinition, VirtualFile } from '../types.ts';
import { createCanvasSurface } from '../runtime/canvasAdapter.ts';

// ============================================================================
// ISO/IEC 18004 QR Code Encoder (Byte Mode, ECC Level L, Versions 1..9)
// ============================================================================

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewordsPerBlock: number;
  eccCodewordsPerBlock: number;
  blocks: number;
  byteCapacity: number;
  alignmentCenters: number[];
  remainderBits: number;
}

const QR_LEVEL_L_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewordsPerBlock: 19, eccCodewordsPerBlock: 7, blocks: 1, byteCapacity: 17, alignmentCenters: [], remainderBits: 0 },
  { version: 2, size: 25, dataCodewordsPerBlock: 34, eccCodewordsPerBlock: 10, blocks: 1, byteCapacity: 32, alignmentCenters: [6, 18], remainderBits: 7 },
  { version: 3, size: 29, dataCodewordsPerBlock: 55, eccCodewordsPerBlock: 15, blocks: 1, byteCapacity: 53, alignmentCenters: [6, 22], remainderBits: 7 },
  { version: 4, size: 33, dataCodewordsPerBlock: 80, eccCodewordsPerBlock: 20, blocks: 1, byteCapacity: 78, alignmentCenters: [6, 26], remainderBits: 7 },
  { version: 5, size: 37, dataCodewordsPerBlock: 108, eccCodewordsPerBlock: 26, blocks: 1, byteCapacity: 106, alignmentCenters: [6, 30], remainderBits: 7 },
  { version: 6, size: 41, dataCodewordsPerBlock: 68, eccCodewordsPerBlock: 18, blocks: 2, byteCapacity: 134, alignmentCenters: [6, 34], remainderBits: 7 },
  { version: 7, size: 45, dataCodewordsPerBlock: 78, eccCodewordsPerBlock: 20, blocks: 2, byteCapacity: 154, alignmentCenters: [6, 22, 38], remainderBits: 0 },
  { version: 8, size: 49, dataCodewordsPerBlock: 97, eccCodewordsPerBlock: 24, blocks: 2, byteCapacity: 192, alignmentCenters: [6, 24, 42], remainderBits: 0 },
  { version: 9, size: 53, dataCodewordsPerBlock: 116, eccCodewordsPerBlock: 30, blocks: 2, byteCapacity: 230, alignmentCenters: [6, 26, 46], remainderBits: 0 },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function computeRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeRsRemainder(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = computeRsGenerator(eccCount);
  const res = new Uint8Array(eccCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[eccCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < eccCount; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

function computeFormatBits(maskIndex: number): number {
  // ECC Level L = 0b01
  const data = (0b01 << 3) | (maskIndex & 7);
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= poly << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version << 12;
  const poly = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) {
      rem ^= poly << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function isMaskMatched(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function calculatePenaltyScore(matrix: Uint8Array, size: number): number {
  let penalty = 0;
  const at = (r: number, c: number) => matrix[r * size + c];

  // Rule 1: 5+ consecutive same-color modules in row/col
  for (let r = 0; r < size; r++) {
    let runColor = at(r, 0);
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      const val = at(r, c);
      if (val === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = val;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = at(0, c);
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      const val = at(r, c);
      if (val === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = val;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) {
        penalty += 3;
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns
  const matchPattern = (arr: number[], start: number, pat: number[]) =>
    pat.every((bit, i) => arr[start + i] === bit);
  const patA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const patB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

  for (let r = 0; r < size; r++) {
    const row = Array.from({ length: size }, (_, c) => at(r, c));
    for (let i = 0; i <= size - 11; i++) {
      if (matchPattern(row, i, patA) || matchPattern(row, i, patB)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    const col = Array.from({ length: size }, (_, r) => at(r, c));
    for (let i = 0; i <= size - 11; i++) {
      if (matchPattern(col, i, patA) || matchPattern(col, i, patB)) penalty += 40;
    }
  }

  // Rule 4: dark module ratio deviation from 50%
  let darkCount = 0;
  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i] === 1) darkCount++;
  }
  const pct = (darkCount * 100) / (size * size);
  const k = Math.floor(Math.abs(pct - 50) / 5);
  penalty += k * 10;

  return penalty;
}

function encodeQrMatrix(text: string): { size: number; modules: Uint8Array; version: number } {
  const payload = new TextEncoder().encode(text);
  const spec = QR_LEVEL_L_SPECS.find((s) => payload.length <= s.byteCapacity);
  if (!spec) {
    throw new Error(
      `QR text is too long (${payload.length} bytes). Maximum supported length is 230 UTF-8 bytes.`,
    );
  }

  const totalDataCodewords = spec.dataCodewordsPerBlock * spec.blocks;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode indicator (Byte = 0100), count (8 bits for V1..V9), then bytes
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const byte of payload) {
    pushBits(byte, 8);
  }

  const totalDataBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | bits[i * 8 + b];
    }
    dataCodewords[i] = val;
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bits.length / 8; i < totalDataCodewords; i++) {
    dataCodewords[i] = padBytes[padIdx % 2];
    padIdx++;
  }

  // Split into blocks and compute Reed-Solomon ECC
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const start = b * spec.dataCodewordsPerBlock;
    const blockData = dataCodewords.slice(start, start + spec.dataCodewordsPerBlock);
    dataBlocks.push(blockData);
    eccBlocks.push(computeRsRemainder(blockData, spec.eccCodewordsPerBlock));
  }

  // Interleave codewords
  const finalBytes: number[] = [];
  for (let i = 0; i < spec.dataCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalBytes.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.eccCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalBytes.push(eccBlocks[b][i]);
    }
  }

  const bitStream: number[] = [];
  for (const byte of finalBytes) {
    for (let i = 7; i >= 0; i--) {
      bitStream.push((byte >> i) & 1);
    }
  }
  for (let i = 0; i < spec.remainderBits; i++) bitStream.push(0);

  const size = spec.size;
  const baseModules = new Uint8Array(size * size);
  const isFunction = new Uint8Array(size * size);

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    baseModules[r * size + c] = dark ? 1 : 0;
    isFunction[r * size + c] = 1;
  };

  // Finder patterns + separators
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && dist !== 2;
        setFunctionModule(r, c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing strips
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (const cr of centers) {
    for (const cc of centers) {
      const overlapsFinder =
        (cr <= 8 && cc <= 8) ||
        (cr <= 8 && cc >= size - 9) ||
        (cr >= size - 9 && cc <= 8);
      if (overlapsFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  // Dark module
  setFunctionModule(size - 8, 8, true);

  // Reserve format info slots
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunctionModule(8, i, false);
      setFunctionModule(i, 8, false);
    }
  }
  for (let i = size - 8; i < size; i++) {
    setFunctionModule(8, i, false);
  }
  for (let i = size - 7; i < size; i++) {
    setFunctionModule(i, 8, false);
  }

  // Version info for V7+
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  // Place data bits in zigzag
  let bitIdx = 0;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const offset of [0, -1]) {
        const col = rightCol + offset;
        if (isFunction[row * size + col] === 0) {
          baseModules[row * size + col] = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate all 8 masks and choose lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = baseModules;

  const applyFormatInfo = (matrix: Uint8Array, maskIndex: number) => {
    const fBits = computeFormatBits(maskIndex);
    // Bits 14..9 -> top-left row 8 (cols 0..5), and bits 14..8 -> bottom-left col 8 (rows size-1..size-7)
    for (let k = 0; k <= 5; k++) {
      matrix[8 * size + k] = (fBits >> (14 - k)) & 1;
    }
    matrix[8 * size + 7] = (fBits >> 8) & 1;
    matrix[8 * size + 8] = (fBits >> 7) & 1;
    matrix[7 * size + 8] = (fBits >> 6) & 1;
    for (let k = 0; k <= 5; k++) {
      matrix[(5 - k) * size + 8] = (fBits >> k) & 1;
    }

    // Split copy: bits 14..8 -> bottom-left col 8, bits 7..0 -> top-right row 8
    for (let k = 0; k <= 6; k++) {
      matrix[(size - 1 - k) * size + 8] = (fBits >> (14 - k)) & 1;
    }
    for (let k = 0; k <= 7; k++) {
      matrix[8 * size + (size - 8 + k)] = (fBits >> (7 - k)) & 1;
    }
  };

  for (let mask = 0; mask < 8; mask++) {
    const candidate = new Uint8Array(baseModules);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFunction[r * size + c] === 0 && isMaskMatched(mask, r, c)) {
          candidate[r * size + c] ^= 1;
        }
      }
    }
    applyFormatInfo(candidate, mask);
    const penalty = calculatePenaltyScore(candidate, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }

  void bestMask;
  return { size, modules: bestMatrix, version: spec.version };
}

// ============================================================================
// Markdown -> WinAnsi Text Helpers
// ============================================================================

function sanitizeForWinAnsi(text: string): string {
  return text
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    // Strip characters outside WinAnsi / Latin-1 basic printable range
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function wrapLine(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

// ============================================================================
// Utility Tool Definitions
// ============================================================================

export const utilQrGenerateTool: ToolDefinition<{
  text?: string;
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  outputName?: string;
}> = {
  id: 'util.qr_generate',
  mcpName: 'tenggoo_util_qr_generate',
  category: 'utility',
  name: 'QR Code Generator',
  description:
    'Generate a scannable PNG QR Code from a URL or text string. Can be chained into pdf.stamp_image or pdf.from_images.',
  acceptsMimeTypes: [],
  producesMimeTypes: ['image/png'],
  minInputs: 0,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text or URL to encode into the QR code (max 230 UTF-8 bytes).',
      },
      size: {
        type: 'integer',
        description: 'Output image width and height in pixels (default: 320).',
        default: 320,
        minimum: 64,
        maximum: 2048,
      },
      margin: {
        type: 'integer',
        description: 'Quiet zone margin in QR modules (default: 4).',
        default: 4,
        minimum: 0,
        maximum: 16,
      },
      darkColor: {
        type: 'string',
        description: 'Hex color for dark QR modules (default: "#000000").',
        default: '#000000',
      },
      lightColor: {
        type: 'string',
        description: 'Hex color for light background (default: "#ffffff").',
        default: '#ffffff',
      },
      outputName: {
        type: 'string',
        description: 'Output PNG file name (default: qrcode.png).',
        default: 'qrcode.png',
      },
    },
    required: ['text'],
  },
  async execute(_inputs, params, context) {
    const text = (params.text ?? '').trim();
    if (!text) {
      throw new Error('util.qr_generate requires a non-empty "text" parameter.');
    }

    const imgSize = Math.max(64, Math.min(2048, Number(params.size ?? 320)));
    const quietMargin = Math.max(0, Math.min(16, Number(params.margin ?? 4)));
    const darkColor = params.darkColor ?? '#000000';
    const lightColor = params.lightColor ?? '#ffffff';

    const { size: moduleCount, modules, version } = encodeQrMatrix(text);
    const totalModules = moduleCount + quietMargin * 2;
    const modulePx = Math.max(1, Math.floor(imgSize / totalModules));
    const exactCanvasPx = totalModules * modulePx;

    const qrSurface = await createCanvasSurface(exactCanvasPx, exactCanvasPx);
    qrSurface.ctx.fillStyle = lightColor;
    qrSurface.ctx.fillRect(0, 0, exactCanvasPx, exactCanvasPx);
    qrSurface.ctx.fillStyle = darkColor;

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (modules[r * moduleCount + c] === 1) {
          qrSurface.ctx.fillRect(
            (c + quietMargin) * modulePx,
            (r + quietMargin) * modulePx,
            modulePx,
            modulePx,
          );
        }
      }
    }

    let finalSurface = qrSurface;
    if (exactCanvasPx !== imgSize) {
      finalSurface = await createCanvasSurface(imgSize, imgSize);
      finalSurface.ctx.imageSmoothingEnabled = false;
      finalSurface.ctx.fillStyle = lightColor;
      finalSurface.ctx.fillRect(0, 0, imgSize, imgSize);
      finalSurface.ctx.drawImage(qrSurface.rawCanvas, 0, 0, imgSize, imgSize);
    }

    const pngBytes = await finalSurface.toBytes('png');
    const rawName = params.outputName?.trim() || 'qrcode.png';
    const outName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: outName,
          mimeType: 'image/png',
          bytes: pngBytes,
          metadata: { width: imgSize, height: imgSize, qrVersion: version, moduleCount },
        },
      ],
      summary: `Generated ${imgSize}x${imgSize} QR Code (v${version}, ${moduleCount}x${moduleCount} modules) as ${outName}.`,
      metadata: { width: imgSize, height: imgSize, qrVersion: version, text },
    };
  },
};

export const utilMdToPdfTool: ToolDefinition<{
  markdown?: string;
  title?: string;
  pageSize?: 'A4' | 'Letter';
  fontSize?: number;
  margin?: number;
  outputName?: string;
}> = {
  id: 'util.md_to_pdf',
  mcpName: 'tenggoo_util_md_to_pdf',
  category: 'utility',
  name: 'Markdown / Text to PDF',
  description:
    'Render Markdown or plain text (from params.markdown or an input .md/.txt file) into a formatted multi-page PDF document.',
  acceptsMimeTypes: ['text/markdown', 'text/plain'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 0,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      markdown: {
        type: 'string',
        description: 'Markdown or plain text content (optional if a .md/.txt file is supplied in inputs).',
      },
      title: {
        type: 'string',
        description: 'Optional document title stored in PDF metadata and optional top header.',
      },
      pageSize: {
        type: 'string',
        description: 'PDF page size ("A4" or "Letter").',
        enum: ['A4', 'Letter'],
        default: 'A4',
      },
      fontSize: {
        type: 'number',
        description: 'Body font size in points (default: 11).',
        default: 11,
        minimum: 8,
        maximum: 24,
      },
      margin: {
        type: 'number',
        description: 'Page margin in points (default: 50).',
        default: 50,
        minimum: 20,
        maximum: 120,
      },
      outputName: {
        type: 'string',
        description: 'Output PDF filename (default: document.pdf).',
        default: 'document.pdf',
      },
    },
  },
  async execute(inputs, params, context) {
    let sourceText = params.markdown ?? '';
    let derivedOutName = params.outputName?.trim() || '';

    if (!sourceText.trim() && inputs.length > 0) {
      sourceText = new TextDecoder('utf-8').decode(inputs[0].bytes);
      if (!derivedOutName) {
        derivedOutName = replaceExtension(inputs[0].name, 'pdf');
      }
    }

    if (!sourceText.trim()) {
      throw new Error('util.md_to_pdf requires either params.markdown or an input .md/.txt file.');
    }

    const pageSize = params.pageSize ?? 'A4';
    const pageW = pageSize === 'A4' ? 595.28 : 612;
    const pageH = pageSize === 'A4' ? 841.89 : 792;
    const baseFontSize = Math.max(8, Math.min(24, Number(params.fontSize ?? 11)));
    const margin = Math.max(20, Math.min(120, Number(params.margin ?? 50)));
    const maxTextWidth = pageW - margin * 2;

    const doc = await PDFDocument.create();
    if (params.title?.trim()) {
      doc.setTitle(sanitizeForWinAnsi(params.title.trim()));
    }
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await doc.embedFont(StandardFonts.Courier);

    let currentPage = doc.addPage([pageW, pageH]);
    let cursorY = pageH - margin;

    const ensureSpace = (neededHeight: number) => {
      if (cursorY - neededHeight < margin) {
        currentPage = doc.addPage([pageW, pageH]);
        cursorY = pageH - margin;
      }
    };

    const rawLines = sourceText.replace(/\r\n/g, '\n').split('\n');
    let inCodeBlock = false;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();

      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        cursorY -= baseFontSize * 0.4;
        continue;
      }

      if (inCodeBlock) {
        const cleanCode = sanitizeForWinAnsi(rawLine.replace(/\t/g, '  '));
        const codeSize = Math.max(8, baseFontSize - 1.5);
        const lineHeight = codeSize * 1.35;
        const wrapped = wrapLine(cleanCode || ' ', maxTextWidth - 16, (s) =>
          fontMono.widthOfTextAtSize(s, codeSize),
        );
        for (const wLine of wrapped) {
          ensureSpace(lineHeight);
          currentPage.drawText(wLine, {
            x: margin + 8,
            y: cursorY - codeSize,
            size: codeSize,
            font: fontMono,
            color: rgb(0.15, 0.2, 0.28),
          });
          cursorY -= lineHeight;
        }
        continue;
      }

      if (!trimmed) {
        cursorY -= baseFontSize * 0.7;
        continue;
      }

      if (/^---+$|^\*\*\*+$/.test(trimmed)) {
        ensureSpace(14);
        currentPage.drawLine({
          start: { x: margin, y: cursorY - 6 },
          end: { x: pageW - margin, y: cursorY - 6 },
          thickness: 0.75,
          color: rgb(0.8, 0.84, 0.88),
        });
        cursorY -= 16;
        continue;
      }

      let activeFont = fontRegular;
      let activeSize = baseFontSize;
      let color = rgb(0.12, 0.16, 0.22);
      let indent = 0;
      let textToRender = trimmed;
      let spaceBefore = 0;
      let spaceAfter = baseFontSize * 0.35;

      if (trimmed.startsWith('### ')) {
        activeFont = fontBold;
        activeSize = baseFontSize + 2;
        textToRender = trimmed.slice(4);
        spaceBefore = 8;
        spaceAfter = 5;
      } else if (trimmed.startsWith('## ')) {
        activeFont = fontBold;
        activeSize = baseFontSize + 5;
        textToRender = trimmed.slice(3);
        spaceBefore = 10;
        spaceAfter = 6;
      } else if (trimmed.startsWith('# ')) {
        activeFont = fontBold;
        activeSize = baseFontSize + 9;
        textToRender = trimmed.slice(2);
        spaceBefore = 12;
        spaceAfter = 8;
      } else if (/^[-*+]\s+/.test(trimmed)) {
        indent = 14;
        textToRender = `- ${trimmed.replace(/^[-*+]\s+/, '')}`;
      } else if (trimmed.startsWith('> ')) {
        indent = 14;
        color = rgb(0.35, 0.42, 0.52);
        textToRender = trimmed.slice(2);
      }

      // Remove common inline markdown markers (**bold**, *italic*, `code`)
      textToRender = sanitizeForWinAnsi(
        textToRender
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/__(.*?)__/g, '$1')
          .replace(/`([^`]+)`/g, '$1'),
      );

      cursorY -= spaceBefore;
      const lineHeight = activeSize * 1.45;
      const wrapped = wrapLine(textToRender, maxTextWidth - indent, (s) =>
        activeFont.widthOfTextAtSize(s, activeSize),
      );

      for (const wLine of wrapped) {
        ensureSpace(lineHeight);
        currentPage.drawText(wLine, {
          x: margin + indent,
          y: cursorY - activeSize,
          size: activeSize,
          font: activeFont,
          color,
        });
        cursorY -= lineHeight;
      }

      cursorY -= spaceAfter;
    }

    const pdfBytes = await doc.save();
    const finalName = derivedOutName
      ? derivedOutName.toLowerCase().endsWith('.pdf')
        ? derivedOutName
        : `${derivedOutName}.pdf`
      : 'document.pdf';
    context?.onProgress?.(100, 'Complete');

    return {
      files: [{ name: finalName, mimeType: 'application/pdf', bytes: pdfBytes }],
      summary: `Rendered Markdown/text into ${doc.getPageCount()} PDF page(s) (${finalName}).`,
      metadata: { pageCount: doc.getPageCount(), pageSize },
    };
  },
};

export const utilZipPackTool: ToolDefinition<{ archiveName?: string }> = {
  id: 'util.zip_pack',
  mcpName: 'tenggoo_util_zip_pack',
  category: 'utility',
  name: 'Pack Files into ZIP',
  description: 'Bundle one or more files from previous steps or inputs into a single .zip archive.',
  acceptsMimeTypes: ['*/*'],
  producesMimeTypes: ['application/zip'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      archiveName: {
        type: 'string',
        description: 'Output ZIP archive name (default: tenggoo_bundle.zip).',
        default: 'tenggoo_bundle.zip',
      },
    },
  },
  async execute(inputs, params, context) {
    if (inputs.length === 0) {
      throw new Error('util.zip_pack requires at least 1 input file.');
    }

    const zip = new JSZip();
    const seenNames = new Map<string, number>();

    for (const file of inputs) {
      const count = (seenNames.get(file.name) ?? 0) + 1;
      seenNames.set(file.name, count);
      let entryName = file.name;
      if (count > 1) {
        const dotIdx = file.name.lastIndexOf('.');
        entryName =
          dotIdx > 0
            ? `${file.name.slice(0, dotIdx)}_${count}${file.name.slice(dotIdx)}`
            : `${file.name}_${count}`;
      }
      zip.file(entryName, file.bytes);
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    const rawArchive = params.archiveName?.trim() || 'tenggoo_bundle.zip';
    const archiveName = rawArchive.toLowerCase().endsWith('.zip') ? rawArchive : `${rawArchive}.zip`;
    context?.onProgress?.(100, 'Complete');

    return {
      files: [{ name: archiveName, mimeType: 'application/zip', bytes: zipBytes }],
      summary: `Packed ${inputs.length} file(s) into ${archiveName}.`,
      metadata: { fileCount: inputs.length, archiveName },
    };
  },
};

export const utilZipUnpackTool: ToolDefinition<{ filterExtensions?: string }> = {
  id: 'util.zip_unpack',
  mcpName: 'tenggoo_util_zip_unpack',
  category: 'utility',
  name: 'Unpack ZIP Archive',
  description:
    'Extract files from a .zip archive so they can be passed directly into subsequent PDF or Image tools.',
  acceptsMimeTypes: ['application/zip', 'application/x-zip-compressed'],
  producesMimeTypes: ['*/*'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      filterExtensions: {
        type: 'string',
        description: 'Optional comma-separated extensions to keep, e.g. "pdf,png,jpg".',
      },
    },
  },
  async execute(inputs, params, context) {
    const zipFile = inputs[0];
    if (!zipFile) {
      throw new Error('util.zip_unpack requires a ZIP file input.');
    }

    const extAllowlist = params.filterExtensions
      ? params.filterExtensions
          .split(',')
          .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
          .filter(Boolean)
      : null;

    const archive = await JSZip.loadAsync(zipFile.bytes);
    const extracted: VirtualFile[] = [];

    const entries = Object.values(archive.files);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.dir) continue;
      if (entry.name.startsWith('__MACOSX/')) continue;

      const cleanName = entry.name.split('/').pop() || entry.name;
      const ext = cleanName.split('.').pop()?.toLowerCase() ?? '';
      if (extAllowlist && extAllowlist.length > 0 && !extAllowlist.includes(ext)) {
        continue;
      }

      const bytes = await entry.async('uint8array');
      extracted.push({
        name: cleanName,
        mimeType: guessMimeType(cleanName),
        bytes,
        metadata: { zipEntryPath: entry.name, sourceArchive: getBaseName(zipFile.name) },
      });
      context?.onProgress?.(Math.round(((i + 1) / entries.length) * 100));
    }

    if (extracted.length === 0) {
      throw new Error(`No matching files found inside ${zipFile.name}.`);
    }

    return {
      files: extracted,
      summary: `Extracted ${extracted.length} file(s) from ${zipFile.name}.`,
      metadata: { extractedCount: extracted.length },
    };
  },
};

export const utilHashChecksumTool: ToolDefinition<{
  algorithm?: 'SHA-256' | 'SHA-1' | 'SHA-512';
}> = {
  id: 'util.hash_checksum',
  mcpName: 'tenggoo_util_hash_checksum',
  category: 'utility',
  name: 'File Checksum & Integrity Hash',
  description:
    'Compute cryptographic SHA-256, SHA-1, or SHA-512 digests for one or more files and return a JSON integrity report.',
  acceptsMimeTypes: ['*/*'],
  producesMimeTypes: ['application/json'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      algorithm: {
        type: 'string',
        description: 'Cryptographic hash algorithm ("SHA-256", "SHA-1", or "SHA-512").',
        enum: ['SHA-256', 'SHA-1', 'SHA-512'],
        default: 'SHA-256',
      },
    },
  },
  async execute(inputs, params, context) {
    if (inputs.length === 0) {
      throw new Error('util.hash_checksum requires at least 1 input file.');
    }

    const algorithm = params.algorithm ?? 'SHA-256';
    const checksums: Record<string, unknown>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const file = inputs[i];
      const copy = new Uint8Array(file.bytes.byteLength);
      copy.set(file.bytes);
      const digestBuffer = await crypto.subtle.digest(algorithm, copy.buffer);
      const digestBytes = new Uint8Array(digestBuffer);
      const hex = Array.from(digestBytes, (b) => b.toString(16).padStart(2, '0')).join('');

      checksums.push({
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        sizeFormatted: formatByteSize(file.bytes.byteLength),
        algorithm,
        digestHex: hex,
      });
      context?.onProgress?.(Math.round(((i + 1) / inputs.length) * 100));
    }

    const jsonText = JSON.stringify({ algorithm, count: checksums.length, checksums }, null, 2);
    return {
      files: [
        {
          name: 'checksums.json',
          mimeType: 'application/json',
          bytes: new TextEncoder().encode(jsonText),
        },
      ],
      summary: `Computed ${algorithm} checksum for ${checksums.length} file(s).`,
      metadata: { algorithm, count: checksums.length, checksums },
    };
  },
};

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function parseTabularInput(raw: string): string[][] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown[];
    if (parsed.length === 0) return [];
    if (Array.isArray(parsed[0])) {
      return parsed.map((row) =>
        (Array.isArray(row) ? row : [row]).map((val) => (val === null || val === undefined ? '' : String(val))),
      );
    }
    if (typeof parsed[0] === 'object' && parsed[0] !== null) {
      const keys = Array.from(
        new Set(
          parsed.flatMap((item) =>
            typeof item === 'object' && item !== null ? Object.keys(item as Record<string, unknown>) : [],
          ),
        ),
      );
      const bodyRows = parsed.map((item) => {
        const rec = (item ?? {}) as Record<string, unknown>;
        return keys.map((k) => (rec[k] === null || rec[k] === undefined ? '' : String(rec[k])));
      });
      return [keys, ...bodyRows];
    }
  }

  return parseCsvRows(trimmed);
}

export const utilTableToPdfTool: ToolDefinition<{
  data?: string;
  title?: string;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  outputName?: string;
}> = {
  id: 'util.table_to_pdf',
  mcpName: 'tenggoo_util_table_to_pdf',
  category: 'utility',
  name: 'CSV / JSON Table to PDF',
  description:
    'Render CSV text or JSON array data (from params.data or an input .csv/.json file) into a formatted multi-page PDF table report.',
  acceptsMimeTypes: ['text/csv', 'application/json', 'text/plain'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 0,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      data: {
        type: 'string',
        description: 'CSV string or JSON array of objects/arrays (optional if a .csv/.json file is provided).',
      },
      title: {
        type: 'string',
        description: 'Report title rendered above the table (default: "Data Table Report").',
        default: 'Data Table Report',
      },
      pageSize: {
        type: 'string',
        description: 'PDF page size ("A4" or "Letter").',
        enum: ['A4', 'Letter'],
        default: 'A4',
      },
      orientation: {
        type: 'string',
        description: 'Page orientation ("portrait" or "landscape").',
        enum: ['portrait', 'landscape'],
        default: 'portrait',
      },
      outputName: {
        type: 'string',
        description: 'Output PDF filename (default: table_report.pdf).',
        default: 'table_report.pdf',
      },
    },
  },
  async execute(inputs, params, context) {
    let rawData = params.data ?? '';
    if (!rawData.trim() && inputs.length > 0) {
      rawData = new TextDecoder('utf-8').decode(inputs[0].bytes);
    }

    const rows = parseTabularInput(rawData);
    if (rows.length === 0) {
      throw new Error('util.table_to_pdf requires non-empty CSV or JSON array tabular data.');
    }

    const title = sanitizeForWinAnsi((params.title ?? 'Data Table Report').trim());
    const pageSize = params.pageSize ?? 'A4';
    const orientation = params.orientation ?? 'portrait';
    const baseW = pageSize === 'A4' ? 595.28 : 612;
    const baseH = pageSize === 'A4' ? 841.89 : 792;
    const pageW = orientation === 'landscape' ? baseH : baseW;
    const pageH = orientation === 'landscape' ? baseW : baseH;
    const margin = 36;
    const colCount = Math.max(1, ...rows.map((r) => r.length));
    const tableW = pageW - margin * 2;
    const colW = tableW / colCount;

    const doc = await PDFDocument.create();
    if (title) doc.setTitle(title);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const headerRow = rows[0];
    const bodyRows = rows.slice(1);
    const rowH = 22;
    const fontSize = Math.max(7.5, Math.min(10, colW > 90 ? 9.5 : 8));

    const clipToWidth = (text: string, font: typeof fontRegular, size: number, maxW: number) => {
      let clean = sanitizeForWinAnsi(text);
      if (font.widthOfTextAtSize(clean, size) <= maxW) return clean;
      while (clean.length > 1 && font.widthOfTextAtSize(`${clean}...`, size) > maxW) {
        clean = clean.slice(0, -1);
      }
      return `${clean}...`;
    };

    let page = doc.addPage([pageW, pageH]);
    let cursorY = pageH - margin;

    if (title) {
      page.drawText(title, {
        x: margin,
        y: cursorY - 14,
        size: 14,
        font: fontBold,
        color: rgb(0.08, 0.12, 0.2),
      });
      cursorY -= 26;
    }

    const drawHeaderRow = () => {
      page.drawRectangle({
        x: margin,
        y: cursorY - rowH,
        width: tableW,
        height: rowH,
        color: rgb(0.12, 0.17, 0.27),
      });
      for (let c = 0; c < colCount; c++) {
        const cellText = clipToWidth(headerRow[c] ?? '', fontBold, fontSize, colW - 8);
        page.drawText(cellText, {
          x: margin + c * colW + 4,
          y: cursorY - rowH + 7,
          size: fontSize,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      }
      cursorY -= rowH;
    };

    drawHeaderRow();

    for (let r = 0; r < bodyRows.length; r++) {
      if (cursorY - rowH < margin) {
        page = doc.addPage([pageW, pageH]);
        cursorY = pageH - margin;
        drawHeaderRow();
      }

      const row = bodyRows[r];
      page.drawRectangle({
        x: margin,
        y: cursorY - rowH,
        width: tableW,
        height: rowH,
        color: r % 2 === 1 ? rgb(0.96, 0.97, 0.99) : rgb(1, 1, 1),
        borderColor: rgb(0.88, 0.9, 0.94),
        borderWidth: 0.5,
      });

      for (let c = 0; c < colCount; c++) {
        const cellText = clipToWidth(row[c] ?? '', fontRegular, fontSize, colW - 8);
        page.drawText(cellText, {
          x: margin + c * colW + 4,
          y: cursorY - rowH + 7,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.18, 0.22, 0.3),
        });
      }
      cursorY -= rowH;
    }

    const outBytes = await doc.save();
    const rawName = params.outputName?.trim() || 'table_report.pdf';
    const outName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
    context?.onProgress?.(100, 'Complete');

    return {
      files: [{ name: outName, mimeType: 'application/pdf', bytes: outBytes }],
      summary: `Rendered ${bodyRows.length} data row(s) (${colCount} columns) into ${doc.getPageCount()} PDF page(s).`,
      metadata: {
        rowCount: bodyRows.length,
        columnCount: colCount,
        pageCount: doc.getPageCount(),
      },
    };
  },
};

export const UTILITY_TOOLS: ToolDefinition[] = [
  utilQrGenerateTool as ToolDefinition,
  utilMdToPdfTool as ToolDefinition,
  utilZipPackTool as ToolDefinition,
  utilZipUnpackTool as ToolDefinition,
  utilHashChecksumTool as ToolDefinition,
  utilTableToPdfTool as ToolDefinition,
];
