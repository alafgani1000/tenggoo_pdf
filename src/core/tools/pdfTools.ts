import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import {
  formatByteSize,
  getBaseName,
  hexToRgb01,
  isImageFile,
  isPdfFile,
  parsePageRange,
  replaceExtension,
} from '../types.ts';
import type { ToolDefinition, VirtualFile } from '../types.ts';
import {
  createCanvasSurface,
  formatToMimeType,
  loadImageSource,
} from '../runtime/canvasAdapter.ts';
import type { CanvasImageFormat } from '../runtime/canvasAdapter.ts';
import {
  extractPdfPositionedText,
  extractPdfTextPages,
  loadPdfDocument,
  renderLoadedPageToImageBytes,
} from '../runtime/pdfjsAdapter.ts';

function ensurePdfFilename(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function isPngBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function embedAnyImageInPdf(pdfDoc: PDFDocument, imageFile: VirtualFile) {
  if (isJpegBytes(imageFile.bytes)) {
    return await pdfDoc.embedJpg(imageFile.bytes);
  }
  if (isPngBytes(imageFile.bytes)) {
    return await pdfDoc.embedPng(imageFile.bytes);
  }
  const source = await loadImageSource(imageFile.bytes, imageFile.mimeType);
  const surface = await createCanvasSurface(source.width, source.height);
  surface.ctx.drawImage(source.raw, 0, 0, source.width, source.height);
  const pngBytes = await surface.toBytes('png');
  return await pdfDoc.embedPng(pngBytes);
}

function findPrimaryPdf(inputs: VirtualFile[], toolId: string): VirtualFile {
  const pdf = inputs.find(isPdfFile) ?? inputs[0];
  if (!pdf) {
    throw new Error(`${toolId} requires a PDF input file.`);
  }
  return pdf;
}

function formatPageNumberText(
  pageNum: number,
  total: number,
  formatType: string,
): string {
  switch (formatType) {
    case 'n-of-total':
      return `${pageNum} / ${total}`;
    case 'page-n':
      return `Page ${pageNum}`;
    case 'hyphen-n':
      return `- ${pageNum} -`;
    case 'n-only':
      return `${pageNum}`;
    case 'page-of-total':
    default:
      return `Page ${pageNum} of ${total}`;
  }
}

export const pdfMergeTool: ToolDefinition<{ outputName?: string }> = {
  id: 'pdf.merge',
  mcpName: 'tenggoo_pdf_merge',
  category: 'pdf',
  name: 'Merge PDF',
  description: 'Combine two or more PDF files sequentially into a single PDF document.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 2,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      outputName: {
        type: 'string',
        description: 'Output PDF file name (default: merged.pdf).',
        default: 'merged.pdf',
      },
    },
  },
  async execute(inputs, params, context) {
    const pdfInputs = inputs.filter(isPdfFile);
    if (pdfInputs.length < 2) {
      throw new Error('pdf.merge requires at least 2 PDF files.');
    }

    const mergedPdf = await PDFDocument.create();
    for (let i = 0; i < pdfInputs.length; i++) {
      context?.onProgress?.(Math.round((i / pdfInputs.length) * 85), `Merging ${pdfInputs[i].name}`);
      const doc = await PDFDocument.load(pdfInputs[i].bytes);
      const copied = await mergedPdf.copyPages(doc, doc.getPageIndices());
      copied.forEach((page) => mergedPdf.addPage(page));
    }

    context?.onProgress?.(95, 'Saving merged PDF');
    const outBytes = await mergedPdf.save();
    const outName = ensurePdfFilename(params.outputName?.trim() || 'merged.pdf');
    context?.onProgress?.(100, 'Complete');

    return {
      files: [{ name: outName, mimeType: 'application/pdf', bytes: outBytes }],
      summary: `Merged ${pdfInputs.length} PDFs (${mergedPdf.getPageCount()} pages total) into ${outName}.`,
      metadata: {
        inputCount: pdfInputs.length,
        pageCount: mergedPdf.getPageCount(),
        outputBytes: outBytes.byteLength,
      },
    };
  },
};

export const pdfSplitTool: ToolDefinition<{
  mode?: 'ranges' | 'each_page' | 'separate_ranges';
  ranges?: string;
}> = {
  id: 'pdf.split',
  mcpName: 'tenggoo_pdf_split',
  category: 'pdf',
  name: 'Split PDF',
  description:
    'Extract page ranges into a single PDF, split comma/semicolon range groups into separate PDFs, or split every page into its own PDF.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        description:
          'Split mode: "ranges" combines selected pages into 1 PDF, "separate_ranges" creates 1 PDF per range group (e.g. "1-3; 4-6"), "each_page" creates 1 PDF per page.',
        enum: ['ranges', 'each_page', 'separate_ranges'],
        default: 'ranges',
      },
      ranges: {
        type: 'string',
        description: '1-based page numbers or ranges, e.g. "1-3, 5" or "1-2; 3-4".',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.split');
    const sourceDoc = await PDFDocument.load(file.bytes);
    const totalPages = sourceDoc.getPageCount();
    const base = getBaseName(file.name);
    const mode = params.mode ?? 'ranges';
    const outputs: VirtualFile[] = [];

    if (mode === 'each_page') {
      for (let i = 0; i < totalPages; i++) {
        context?.onProgress?.(Math.round(((i + 1) / totalPages) * 95), `Extracting page ${i + 1}`);
        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(sourceDoc, [i]);
        newDoc.addPage(copied);
        const outBytes = await newDoc.save();
        outputs.push({
          name: `${base}_page_${i + 1}.pdf`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        });
      }
    } else if (mode === 'separate_ranges') {
      const rangeStr = params.ranges?.trim() ?? '';
      if (!rangeStr) {
        throw new Error('ranges parameter is required when mode is "separate_ranges".');
      }
      const groups = rangeStr
        .split(/[;|]/)
        .map((g) => g.trim())
        .filter(Boolean);
      const effectiveGroups = groups.length > 1 ? groups : rangeStr.split(',').map((g) => g.trim()).filter(Boolean);

      for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
        const indices = parsePageRange(effectiveGroups[gIdx], totalPages);
        if (indices.length === 0) continue;
        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(sourceDoc, indices);
        copied.forEach((p) => newDoc.addPage(p));
        const outBytes = await newDoc.save();
        outputs.push({
          name: `${base}_part_${gIdx + 1}.pdf`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        });
      }
      if (outputs.length === 0) {
        throw new Error(`No valid pages matched ranges "${rangeStr}" (document has ${totalPages} pages).`);
      }
    } else {
      const rangeStr = params.ranges?.trim();
      if (!rangeStr) {
        throw new Error('ranges parameter is required when mode is "ranges" (e.g., "1-3, 5").');
      }
      const indices = parsePageRange(rangeStr, totalPages);
      if (indices.length === 0) {
        throw new Error(`No valid pages matched ranges "${rangeStr}" (document has ${totalPages} pages).`);
      }
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(sourceDoc, indices);
      copied.forEach((p) => newDoc.addPage(p));
      const outBytes = await newDoc.save();
      outputs.push({
        name: `split_${file.name}`,
        mimeType: 'application/pdf',
        bytes: outBytes,
      });
    }

    context?.onProgress?.(100, 'Split complete');
    return {
      files: outputs,
      summary: `Split ${file.name} (${totalPages} pages) into ${outputs.length} PDF file(s).`,
      metadata: {
        sourcePages: totalPages,
        outputCount: outputs.length,
      },
    };
  },
};

export const pdfReorderTool: ToolDefinition<{
  pageOrder?: number[] | string;
  rotation?: 0 | 90 | 180 | 270;
}> = {
  id: 'pdf.reorder',
  mcpName: 'tenggoo_pdf_reorder',
  category: 'pdf',
  name: 'Reorder Pages',
  description:
    'Reorder, duplicate, or remove pages in a PDF using a 1-based pageOrder list (e.g., [3, 1, 2]).',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      pageOrder: {
        type: 'array',
        description: '1-based list of page numbers in desired output order, e.g. [3, 1, 2].',
        items: { type: 'integer' },
      },
      rotation: {
        type: 'integer',
        description: 'Optional extra rotation in degrees (0, 90, 180, 270) applied to output pages.',
        enum: [0, 90, 180, 270],
        default: 0,
      },
    },
    required: ['pageOrder'],
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.reorder');
    const sourceDoc = await PDFDocument.load(file.bytes);
    const totalPages = sourceDoc.getPageCount();

    let rawOrder: number[] = [];
    if (Array.isArray(params.pageOrder)) {
      rawOrder = params.pageOrder.map((n) => Number(n));
    } else if (typeof params.pageOrder === 'string') {
      rawOrder = params.pageOrder
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
    }

    const validIndices = rawOrder
      .filter((pageNum) => Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= totalPages)
      .map((pageNum) => pageNum - 1);

    if (validIndices.length === 0) {
      throw new Error(
        `pageOrder must contain at least one valid 1-based page number between 1 and ${totalPages}.`,
      );
    }

    const extraRotation = params.rotation ?? 0;
    const outputDoc = await PDFDocument.create();

    for (let i = 0; i < validIndices.length; i++) {
      const [copied] = await outputDoc.copyPages(sourceDoc, [validIndices[i]]);
      if (extraRotation !== 0) {
        const current = copied.getRotation().angle;
        copied.setRotation(degrees((current + extraRotation) % 360));
      }
      outputDoc.addPage(copied);
      context?.onProgress?.(Math.round(((i + 1) / validIndices.length) * 90));
    }

    const outBytes = await outputDoc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `organized_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Reordered ${file.name} into ${validIndices.length} page(s).`,
      metadata: {
        pageCount: validIndices.length,
        pageOrder: validIndices.map((idx) => idx + 1),
      },
    };
  },
};

export const pdfRotateTool: ToolDefinition<{
  angle?: 90 | 180 | 270;
  pageRange?: string;
}> = {
  id: 'pdf.rotate',
  mcpName: 'tenggoo_pdf_rotate',
  category: 'pdf',
  name: 'Rotate PDF',
  description: 'Rotate all or selected pages in a PDF clockwise by 90, 180, or 270 degrees.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      angle: {
        type: 'integer',
        description: 'Clockwise rotation angle in degrees (90, 180, or 270).',
        enum: [90, 180, 270],
        default: 90,
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (e.g. "1-3, 5"). Blank rotates all pages.',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.rotate');
    const angle = Number(params.angle ?? 90);
    if (![90, 180, 270].includes(angle)) {
      throw new Error('angle must be 90, 180, or 270.');
    }

    const pdfDoc = await PDFDocument.load(file.bytes);
    const pages = pdfDoc.getPages();
    const targetIndices = parsePageRange(params.pageRange, pages.length);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }

    const outBytes = await pdfDoc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `rotated_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Rotated ${targetIndices.length} page(s) of ${file.name} by ${angle}°.`,
      metadata: { rotatedPages: targetIndices.length, angle },
    };
  },
};

export const pdfWatermarkTool: ToolDefinition<{
  text?: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  color?: string;
  position?: 'center-diagonal' | 'center' | 'top' | 'bottom' | 'tiled';
  pageRange?: string;
}> = {
  id: 'pdf.watermark',
  mcpName: 'tenggoo_pdf_watermark',
  category: 'pdf',
  name: 'Watermark PDF',
  description: 'Add a customizable text watermark (diagonal, centered, header, footer, or tiled) to PDF pages.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Watermark text (e.g. "CONFIDENTIAL", "DRAFT").',
        default: 'CONFIDENTIAL',
      },
      fontSize: {
        type: 'number',
        description: 'Font size in points (default: 48).',
        default: 48,
        minimum: 8,
        maximum: 160,
      },
      opacity: {
        type: 'number',
        description: 'Opacity from 0.05 to 1.0 (default: 0.25).',
        default: 0.25,
        minimum: 0.05,
        maximum: 1,
      },
      rotation: {
        type: 'number',
        description: 'Rotation angle in degrees (default: 45 for center-diagonal, 0 otherwise).',
      },
      color: {
        type: 'string',
        description: 'Hex color string (default: "#64748b").',
        default: '#64748b',
      },
      position: {
        type: 'string',
        description: 'Placement layout.',
        enum: ['center-diagonal', 'center', 'top', 'bottom', 'tiled'],
        default: 'center-diagonal',
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
    },
    required: ['text'],
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.watermark');
    const text = (params.text ?? 'CONFIDENTIAL').trim();
    if (!text) {
      throw new Error('Watermark text cannot be empty.');
    }

    const position = params.position ?? 'center-diagonal';
    const fontSize = Number(params.fontSize ?? 48);
    const opacity = Math.max(0.05, Math.min(1, Number(params.opacity ?? 0.25)));
    const rotation =
      params.rotation !== undefined
        ? Number(params.rotation)
        : position === 'center-diagonal'
          ? 45
          : position === 'tiled'
            ? 30
            : 0;
    const rgbValues = hexToRgb01(params.color ?? '#64748b');
    const selectedColor = rgb(rgbValues.r, rgbValues.g, rgbValues.b);

    const doc = await PDFDocument.load(file.bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    const targetIndices = parsePageRange(params.pageRange, pages.length);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      if (position === 'tiled') {
        const cols = 3;
        const rows = 3;
        const colWidth = width / cols;
        const rowHeight = height / rows;
        const tiledFontSize = fontSize * 0.7;
        const tiledWidth = font.widthOfTextAtSize(text, tiledFontSize);
        const tiledHeight = font.heightAtSize(tiledFontSize);

        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const centerX = c * colWidth + colWidth / 2;
            const centerY = r * rowHeight + rowHeight / 2;
            page.drawText(text, {
              x: centerX - tiledWidth / 2,
              y: centerY - tiledHeight / 2,
              size: tiledFontSize,
              font,
              color: selectedColor,
              opacity,
              rotate: degrees(rotation),
            });
          }
        }
      } else if (position === 'top') {
        const topSize = fontSize * 0.6;
        const topWidth = font.widthOfTextAtSize(text, topSize);
        page.drawText(text, {
          x: width / 2 - topWidth / 2,
          y: height - 60,
          size: topSize,
          font,
          color: selectedColor,
          opacity,
          rotate: degrees(rotation),
        });
      } else if (position === 'bottom') {
        const botSize = fontSize * 0.6;
        const botWidth = font.widthOfTextAtSize(text, botSize);
        page.drawText(text, {
          x: width / 2 - botWidth / 2,
          y: 40,
          size: botSize,
          font,
          color: selectedColor,
          opacity,
          rotate: degrees(rotation),
        });
      } else {
        const rad = (rotation * Math.PI) / 180;
        page.drawText(text, {
          x: width / 2 - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad),
          y: height / 2 - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad),
          size: fontSize,
          font,
          color: selectedColor,
          opacity,
          rotate: degrees(rotation),
        });
      }
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `watermarked_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Applied "${text}" watermark (${position}) to ${targetIndices.length} page(s) of ${file.name}.`,
      metadata: { pagesWatermarked: targetIndices.length, position },
    };
  },
};

export const pdfPageNumbersTool: ToolDefinition<{
  format?: 'page-of-total' | 'n-of-total' | 'page-n' | 'hyphen-n' | 'n-only';
  position?:
    | 'bottom-center'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'top-right'
    | 'top-left';
  startNumber?: number;
  skipFirstPage?: boolean;
  fontSize?: number;
  color?: string;
  margin?: number;
}> = {
  id: 'pdf.page_numbers',
  mcpName: 'tenggoo_pdf_page_numbers',
  category: 'pdf',
  name: 'Add Page Numbers',
  description: 'Add customizable page numbering to headers or footers of a PDF document.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Numbering format.',
        enum: ['page-of-total', 'n-of-total', 'page-n', 'hyphen-n', 'n-only'],
        default: 'page-of-total',
      },
      position: {
        type: 'string',
        description: 'Placement on each page.',
        enum: [
          'bottom-center',
          'bottom-right',
          'bottom-left',
          'top-center',
          'top-right',
          'top-left',
        ],
        default: 'bottom-center',
      },
      startNumber: {
        type: 'integer',
        description: 'Starting page number (default: 1).',
        default: 1,
        minimum: 1,
      },
      skipFirstPage: {
        type: 'boolean',
        description: 'Skip numbering on the first page (e.g. cover page).',
        default: false,
      },
      fontSize: {
        type: 'number',
        description: 'Font size in points (default: 10).',
        default: 10,
        minimum: 6,
        maximum: 32,
      },
      color: {
        type: 'string',
        description: 'Hex color string (default: "#64748b").',
        default: '#64748b',
      },
      margin: {
        type: 'number',
        description: 'Edge margin in points (default: 25).',
        default: 25,
        minimum: 5,
        maximum: 100,
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.page_numbers');
    const format = params.format ?? 'page-of-total';
    const position = params.position ?? 'bottom-center';
    const startNumber = Math.max(1, Number(params.startNumber ?? 1));
    const skipFirstPage = Boolean(params.skipFirstPage ?? false);
    const fontSize = Number(params.fontSize ?? 10);
    const margin = Number(params.margin ?? 25);
    const rgbValues = hexToRgb01(params.color ?? '#64748b');
    const selectedColor = rgb(rgbValues.r, rgbValues.g, rgbValues.b);

    const doc = await PDFDocument.load(file.bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const count = pages.length;
    const startIndex = skipFirstPage && count > 1 ? 1 : 0;
    const effectiveTotal = skipFirstPage && count > 1 ? count - 1 : count;

    for (let i = startIndex; i < count; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const currentNumber = startNumber + (i - startIndex);
      const text = formatPageNumberText(currentNumber, effectiveTotal, format);

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      let x: number;
      if (position.includes('left')) {
        x = margin + 15;
      } else if (position.includes('right')) {
        x = width - margin - 15 - textWidth;
      } else {
        x = width / 2 - textWidth / 2;
      }

      const y = position.startsWith('top') ? height - margin - textHeight : margin;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: selectedColor,
      });
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `numbered_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Added page numbers (${format}, ${position}) to ${count - startIndex} page(s) of ${file.name}.`,
      metadata: { pagesNumbered: count - startIndex },
    };
  },
};

export const pdfFromImagesTool: ToolDefinition<{
  pageSize?: 'fit' | 'A4' | 'Letter';
  orientation?: 'auto' | 'portrait' | 'landscape';
  margin?: number;
  outputName?: string;
}> = {
  id: 'pdf.from_images',
  mcpName: 'tenggoo_pdf_from_images',
  category: 'pdf',
  name: 'Images to PDF',
  description: 'Convert one or more images (JPG, PNG, WebP) into a single PDF document.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      pageSize: {
        type: 'string',
        description: 'Page sizing mode: "fit" matches image dimensions, or "A4" / "Letter".',
        enum: ['fit', 'A4', 'Letter'],
        default: 'fit',
      },
      orientation: {
        type: 'string',
        description: 'Page orientation when using A4 or Letter ("auto", "portrait", "landscape").',
        enum: ['auto', 'portrait', 'landscape'],
        default: 'auto',
      },
      margin: {
        type: 'number',
        description: 'Page margin in points for A4/Letter (default: 20). Ignored in "fit" mode.',
        default: 20,
        minimum: 0,
        maximum: 150,
      },
      outputName: {
        type: 'string',
        description: 'Output PDF file name (default: images-converted.pdf).',
        default: 'images-converted.pdf',
      },
    },
  },
  async execute(inputs, params, context) {
    const images = inputs.filter(isImageFile);
    if (images.length === 0) {
      throw new Error('pdf.from_images requires at least one image input (PNG, JPG, WebP).');
    }

    const pageSize = params.pageSize ?? 'fit';
    const orientation = params.orientation ?? 'auto';
    const margin = Number(params.margin ?? (pageSize === 'fit' ? 0 : 20));
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < images.length; i++) {
      context?.onProgress?.(Math.round((i / images.length) * 90), `Embedding ${images[i].name}`);
      const embedded = await embedAnyImageInPdf(pdfDoc, images[i]);

      if (pageSize === 'fit') {
        const page = pdfDoc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height,
        });
      } else {
        const baseW = pageSize === 'A4' ? 595.28 : 612;
        const baseH = pageSize === 'A4' ? 841.89 : 792;
        const isLandscape =
          orientation === 'landscape' ||
          (orientation === 'auto' && embedded.width > embedded.height);
        const pageW = isLandscape ? baseH : baseW;
        const pageH = isLandscape ? baseW : baseH;
        const availW = Math.max(20, pageW - margin * 2);
        const availH = Math.max(20, pageH - margin * 2);
        const scale = Math.min(availW / embedded.width, availH / embedded.height);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, {
          x: (pageW - drawW) / 2,
          y: (pageH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
    }

    const outBytes = await pdfDoc.save();
    const outName = ensurePdfFilename(params.outputName?.trim() || 'images-converted.pdf');
    context?.onProgress?.(100, 'Complete');

    return {
      files: [{ name: outName, mimeType: 'application/pdf', bytes: outBytes }],
      summary: `Converted ${images.length} image(s) into ${outName} (${pageSize}).`,
      metadata: { pageCount: images.length, pageSize },
    };
  },
};

export const pdfToImagesTool: ToolDefinition<{
  format?: CanvasImageFormat;
  scale?: number;
  pageRange?: string;
  quality?: number;
  password?: string;
}> = {
  id: 'pdf.to_images',
  mcpName: 'tenggoo_pdf_to_images',
  category: 'pdf',
  name: 'PDF to Images',
  description: 'Render PDF pages into PNG, JPEG, or WebP images.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Output image format.',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png',
      },
      scale: {
        type: 'number',
        description: 'Render scale multiplier (1 = 72dpi, 2 = 144dpi, 3 = 216dpi).',
        default: 2,
        minimum: 0.5,
        maximum: 4,
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
      quality: {
        type: 'integer',
        description: 'Compression quality for JPEG/WebP (1-100, default: 92).',
        default: 92,
        minimum: 1,
        maximum: 100,
      },
      password: {
        type: 'string',
        description: 'Optional password if PDF is encrypted.',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.to_images');
    const format: CanvasImageFormat = params.format ?? 'png';
    const scale = Math.max(0.5, Math.min(4, Number(params.scale ?? 2)));
    const quality = Math.max(1, Math.min(100, Number(params.quality ?? 92)));

    const doc = await loadPdfDocument(file.bytes, params.password);
    const targetIndices = parsePageRange(params.pageRange, doc.numPages);
    if (targetIndices.length === 0) {
      throw new Error(`No valid pages selected (PDF has ${doc.numPages} pages).`);
    }

    const base = getBaseName(file.name);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const mimeType = formatToMimeType(format);
    const outputs: VirtualFile[] = [];

    for (let i = 0; i < targetIndices.length; i++) {
      const pageNum = targetIndices[i] + 1;
      context?.onProgress?.(
        Math.round(((i + 1) / targetIndices.length) * 95),
        `Rendering page ${pageNum}`,
      );
      const rendered = await renderLoadedPageToImageBytes(doc, pageNum, {
        scale,
        format,
        quality,
      });
      outputs.push({
        name: `${base}_page_${pageNum}.${ext}`,
        mimeType,
        bytes: rendered.bytes,
        metadata: { width: rendered.width, height: rendered.height, pageNumber: pageNum },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Rendered ${outputs.length} page(s) from ${file.name} as ${format.toUpperCase()} (${scale}x).`,
      metadata: { imageCount: outputs.length, format, scale },
    };
  },
};

export const pdfUnlockTool: ToolDefinition<{
  password?: string;
  scale?: number;
}> = {
  id: 'pdf.unlock',
  mcpName: 'tenggoo_pdf_unlock',
  category: 'pdf',
  name: 'Unlock PDF',
  description: 'Decrypt a password-protected PDF and save an unlocked PDF copy.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      password: {
        type: 'string',
        description: 'Password needed to open the encrypted PDF.',
      },
      scale: {
        type: 'number',
        description: 'Render fidelity scale (default: 2).',
        default: 2,
        minimum: 1,
        maximum: 3,
      },
    },
    required: ['password'],
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.unlock');
    const password = params.password ?? '';
    const scale = Math.max(1, Math.min(3, Number(params.scale ?? 2)));

    let pdfProxy;
    try {
      pdfProxy = await loadPdfDocument(file.bytes, password.trim());
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('password') || msg.includes('encrypt') || msg.includes('incorrect')) {
        throw new Error('Incorrect password for encrypted PDF.', { cause: err });
      }
      throw err;
    }

    const numPages = pdfProxy.numPages;
    const outputDoc = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      context?.onProgress?.(Math.round((pageNum / numPages) * 90), `Unlocking page ${pageNum}`);
      const rendered = await renderLoadedPageToImageBytes(pdfProxy, pageNum, {
        scale,
        format: 'jpeg',
        quality: 95,
      });
      const embedded = await outputDoc.embedJpg(rendered.bytes);
      const page = outputDoc.addPage([rendered.width / scale, rendered.height / scale]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: rendered.width / scale,
        height: rendered.height / scale,
      });
    }

    const outBytes = await outputDoc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `${getBaseName(file.name)}_unlocked.pdf`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Unlocked ${file.name} (${numPages} page(s)) into an unencrypted PDF.`,
      metadata: { pageCount: numPages },
    };
  },
};

export const pdfExtractTextTool: ToolDefinition<{
  format?: 'txt' | 'markdown' | 'json';
  pageRange?: string;
  password?: string;
}> = {
  id: 'pdf.extract_text',
  mcpName: 'tenggoo_pdf_extract_text',
  category: 'pdf',
  name: 'Extract Text from PDF',
  description:
    'Extract text content and page dimensions from a PDF into TXT, Markdown, or structured JSON (ideal for AI agents reading PDF content).',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['text/markdown', 'text/plain', 'application/json'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Output text format ("markdown", "txt", or "json").',
        enum: ['markdown', 'txt', 'json'],
        default: 'markdown',
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
      password: {
        type: 'string',
        description: 'Optional password if PDF is encrypted.',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.extract_text');
    const format = params.format ?? 'markdown';

    context?.onProgress?.(20, 'Reading PDF text layer');
    const allPages = await extractPdfTextPages(file.bytes, params.password);
    const targetIndices = parsePageRange(params.pageRange, allPages.length);
    const selectedPages = targetIndices.map((idx) => allPages[idx]);

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'json') {
      mimeType = 'application/json';
      ext = 'json';
      content = JSON.stringify(
        {
          fileName: file.name,
          totalPages: allPages.length,
          extractedPages: selectedPages.length,
          pages: selectedPages,
        },
        null,
        2,
      );
    } else if (format === 'txt') {
      mimeType = 'text/plain';
      ext = 'txt';
      content = selectedPages
        .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
        .join('\n\n');
    } else {
      mimeType = 'text/markdown';
      ext = 'md';
      content =
        `# ${file.name}\n\n` +
        selectedPages
          .map((p) => `## Page ${p.pageNumber}\n\n${p.text || '*(No extractable text on this page)*'}`)
          .join('\n\n');
    }

    const encoded = new TextEncoder().encode(content);
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: replaceExtension(file.name, ext),
          mimeType,
          bytes: encoded,
        },
      ],
      summary: `Extracted text from ${selectedPages.length} page(s) of ${file.name} (${content.length} chars).`,
      metadata: {
        totalPages: allPages.length,
        extractedPages: selectedPages.length,
        charCount: content.length,
        text: content,
        pages: selectedPages,
      },
    };
  },
};

export const pdfMetadataTool: ToolDefinition<{
  action?: 'inspect' | 'set' | 'clear';
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
}> = {
  id: 'pdf.metadata',
  mcpName: 'tenggoo_pdf_metadata',
  category: 'pdf',
  name: 'PDF Metadata Inspector & Editor',
  description: 'Inspect, update, or wipe PDF document metadata (title, author, subject, keywords, creator).',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/json', 'application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Operation: "inspect" (outputs JSON report), "set" (updates fields), or "clear" (strips metadata).',
        enum: ['inspect', 'set', 'clear'],
        default: 'inspect',
      },
      title: { type: 'string', description: 'New document title (when action="set").' },
      author: { type: 'string', description: 'New document author (when action="set").' },
      subject: { type: 'string', description: 'New document subject (when action="set").' },
      keywords: {
        type: 'string',
        description: 'Comma-separated keywords (when action="set").',
      },
      creator: { type: 'string', description: 'Creator application name (when action="set").' },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.metadata');
    const action = params.action ?? 'inspect';
    const doc = await PDFDocument.load(file.bytes, { updateMetadata: action !== 'inspect' });

    if (action === 'inspect') {
      const pages = doc.getPages().map((page, index) => {
        const size = page.getSize();
        return {
          pageNumber: index + 1,
          widthPt: Math.round(size.width),
          heightPt: Math.round(size.height),
          rotationDeg: page.getRotation().angle,
        };
      });

      const report = {
        fileName: file.name,
        fileSizeBytes: file.bytes.byteLength,
        fileSizeFormatted: formatByteSize(file.bytes.byteLength),
        pageCount: doc.getPageCount(),
        title: doc.getTitle() ?? null,
        author: doc.getAuthor() ?? null,
        subject: doc.getSubject() ?? null,
        keywords: doc.getKeywords() ?? null,
        creator: doc.getCreator() ?? null,
        producer: doc.getProducer() ?? null,
        creationDate: doc.getCreationDate()?.toISOString() ?? null,
        modificationDate: doc.getModificationDate()?.toISOString() ?? null,
        pages,
      };

      const jsonBytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
      context?.onProgress?.(100, 'Complete');

      return {
        files: [
          {
            name: `${getBaseName(file.name)}_metadata.json`,
            mimeType: 'application/json',
            bytes: jsonBytes,
          },
        ],
        summary: `Inspected ${file.name}: ${report.pageCount} page(s), ${report.fileSizeFormatted}.`,
        metadata: report,
      };
    }

    if (action === 'clear') {
      doc.setTitle('');
      doc.setAuthor('');
      doc.setSubject('');
      doc.setKeywords([]);
      doc.setCreator('');
      doc.setProducer('');
    } else {
      if (params.title !== undefined) doc.setTitle(params.title);
      if (params.author !== undefined) doc.setAuthor(params.author);
      if (params.subject !== undefined) doc.setSubject(params.subject);
      if (params.keywords !== undefined) {
        doc.setKeywords(
          params.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
        );
      }
      if (params.creator !== undefined) doc.setCreator(params.creator);
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `${action === 'clear' ? 'cleaned' : 'meta'}_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary:
        action === 'clear'
          ? `Cleared all metadata fields from ${file.name}.`
          : `Updated metadata on ${file.name}.`,
      metadata: {
        action,
        title: doc.getTitle() ?? null,
        author: doc.getAuthor() ?? null,
        subject: doc.getSubject() ?? null,
        keywords: doc.getKeywords() ?? null,
        creator: doc.getCreator() ?? null,
      },
    };
  },
};

export const pdfStampImageTool: ToolDefinition<{
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' | 'custom';
  width?: number;
  height?: number;
  margin?: number;
  x?: number;
  y?: number;
  opacity?: number;
  pageRange?: string;
}> = {
  id: 'pdf.stamp_image',
  mcpName: 'tenggoo_pdf_stamp_image',
  category: 'pdf',
  name: 'Stamp Image onto PDF',
  description:
    'Overlay an image (signature, company stamp, logo, or generated QR code) onto a PDF document. Pass 1 PDF and 1 Image file.',
  acceptsMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 2,
  maxInputs: 2,
  parameterSchema: {
    type: 'object',
    properties: {
      position: {
        type: 'string',
        description: 'Placement preset or "custom" coordinates.',
        enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center', 'custom'],
        default: 'bottom-right',
      },
      width: {
        type: 'number',
        description: 'Target width in PDF points (default: 100).',
        default: 100,
        minimum: 10,
      },
      height: {
        type: 'number',
        description: 'Optional height in PDF points. Omit to preserve image aspect ratio.',
      },
      margin: {
        type: 'number',
        description: 'Margin from page edges in points (default: 24).',
        default: 24,
        minimum: 0,
      },
      x: { type: 'number', description: 'Custom X coordinate in points (from bottom-left).' },
      y: { type: 'number', description: 'Custom Y coordinate in points (from bottom-left).' },
      opacity: {
        type: 'number',
        description: 'Stamp opacity from 0.1 to 1.0 (default: 1.0).',
        default: 1,
        minimum: 0.1,
        maximum: 1,
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages, e.g. "1" for cover only).',
      },
    },
  },
  async execute(inputs, params, context) {
    const pdfFile = inputs.find(isPdfFile);
    const imgFile = inputs.find(isImageFile);
    if (!pdfFile || !imgFile) {
      throw new Error('pdf.stamp_image requires both 1 PDF file and 1 Image file in inputs.');
    }

    const position = params.position ?? 'bottom-right';
    const targetWidth = Math.max(10, Number(params.width ?? 100));
    const margin = Math.max(0, Number(params.margin ?? 24));
    const opacity = Math.max(0.1, Math.min(1, Number(params.opacity ?? 1)));

    const doc = await PDFDocument.load(pdfFile.bytes);
    const embedded = await embedAnyImageInPdf(doc, imgFile);
    const targetHeight =
      params.height && Number(params.height) > 0
        ? Number(params.height)
        : (embedded.height / embedded.width) * targetWidth;

    const pages = doc.getPages();
    const targetIndices = parsePageRange(params.pageRange, pages.length);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const { width: pageW, height: pageH } = page.getSize();

      let x = margin;
      let y = margin;

      if (position === 'custom') {
        x = Number(params.x ?? margin);
        y = Number(params.y ?? margin);
      } else if (position === 'bottom-right') {
        x = Math.max(0, pageW - targetWidth - margin);
        y = margin;
      } else if (position === 'bottom-left') {
        x = margin;
        y = margin;
      } else if (position === 'top-right') {
        x = Math.max(0, pageW - targetWidth - margin);
        y = Math.max(0, pageH - targetHeight - margin);
      } else if (position === 'top-left') {
        x = margin;
        y = Math.max(0, pageH - targetHeight - margin);
      } else if (position === 'center') {
        x = (pageW - targetWidth) / 2;
        y = (pageH - targetHeight) / 2;
      }

      page.drawImage(embedded, {
        x,
        y,
        width: targetWidth,
        height: targetHeight,
        opacity,
      });
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `stamped_${pdfFile.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Stamped ${imgFile.name} onto ${targetIndices.length} page(s) of ${pdfFile.name} at ${position}.`,
      metadata: {
        stampedPages: targetIndices.length,
        position,
        stampWidth: Math.round(targetWidth),
        stampHeight: Math.round(targetHeight),
      },
    };
  },
};

export const pdfCompressTool: ToolDefinition<{
  quality?: 'low' | 'medium' | 'high' | 'pro';
  preserveText?: boolean;
}> = {
  id: 'pdf.compress',
  mcpName: 'tenggoo_pdf_compress',
  category: 'pdf',
  name: 'Compress PDF (Headless)',
  description:
    'Optimize and reduce PDF file size using object-stream packing and optional adaptive JPEG page downsampling.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      quality: {
        type: 'string',
        description: 'Compression profile: low (smallest), medium (balanced), high, or pro.',
        enum: ['low', 'medium', 'high', 'pro'],
        default: 'medium',
      },
      preserveText: {
        type: 'boolean',
        description:
          'When true, performs lossless structural/object-stream compaction only so selectable text remains intact.',
        default: false,
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.compress');
    const quality = params.quality ?? 'medium';
    const preserveText = Boolean(params.preserveText ?? false);
    const originalSize = file.bytes.byteLength;

    context?.onProgress?.(15, 'Re-packing PDF object streams');
    const srcDoc = await PDFDocument.load(file.bytes);
    const rebuiltDoc = await PDFDocument.create();
    const copiedPages = await rebuiltDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => rebuiltDoc.addPage(p));
    let bestBytes = await rebuiltDoc.save({ useObjectStreams: true });
    let modeUsed = 'lossless-repack';

    if (!preserveText) {
      const profileMap = {
        low: { scale: 1.0, jpegQuality: 58 },
        medium: { scale: 1.3, jpegQuality: 72 },
        high: { scale: 1.6, jpegQuality: 82 },
        pro: { scale: 2.0, jpegQuality: 90 },
      } as const;
      const cfg = profileMap[quality];
      const pdfProxy = await loadPdfDocument(file.bytes);
      const rasterDoc = await PDFDocument.create();

      for (let pageNum = 1; pageNum <= pdfProxy.numPages; pageNum++) {
        context?.onProgress?.(
          20 + Math.round((pageNum / pdfProxy.numPages) * 70),
          `Compressing page ${pageNum}/${pdfProxy.numPages}`,
        );
        const rendered = await renderLoadedPageToImageBytes(pdfProxy, pageNum, {
          scale: cfg.scale,
          format: 'jpeg',
          quality: cfg.jpegQuality,
        });
        const img = await rasterDoc.embedJpg(rendered.bytes);
        const page = rasterDoc.addPage([
          rendered.width / cfg.scale,
          rendered.height / cfg.scale,
        ]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: rendered.width / cfg.scale,
          height: rendered.height / cfg.scale,
        });
      }

      const rasterBytes = await rasterDoc.save({ useObjectStreams: true });
      if (rasterBytes.byteLength < bestBytes.byteLength) {
        bestBytes = rasterBytes;
        modeUsed = `raster-${quality}`;
      }
    }

    const finalBytes = bestBytes.byteLength < originalSize ? bestBytes : file.bytes;
    const savedPct =
      originalSize > 0
        ? (((originalSize - finalBytes.byteLength) / originalSize) * 100).toFixed(1)
        : '0.0';

    context?.onProgress?.(100, 'Complete');
    return {
      files: [
        {
          name: `compressed_${file.name}`,
          mimeType: 'application/pdf',
          bytes: finalBytes,
        },
      ],
      summary:
        finalBytes.byteLength < originalSize
          ? `Compressed ${file.name}: ${formatByteSize(originalSize)} -> ${formatByteSize(finalBytes.byteLength)} (${savedPct}% smaller via ${modeUsed}).`
          : `${file.name} is already optimal (${formatByteSize(originalSize)}).`,
      metadata: {
        originalBytes: originalSize,
        compressedBytes: finalBytes.byteLength,
        savingsPercent: Number(savedPct),
        modeUsed: finalBytes.byteLength < originalSize ? modeUsed : 'already-optimal',
      },
    };
  },
};

export const pdfRedactTool: ToolDefinition<{
  preset?: 'top-banner' | 'bottom-banner' | 'center-strip' | 'custom';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  pageRange?: string;
  burnIn?: boolean;
}> = {
  id: 'pdf.redact',
  mcpName: 'tenggoo_pdf_redact',
  category: 'pdf',
  name: 'Redact Sensitive Content',
  description:
    'Permanently black out sensitive regions on PDF pages. When burnIn=true (default), rasterizes pages so redacted underlying text cannot be extracted.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      preset: {
        type: 'string',
        description: 'Region preset ("top-banner", "bottom-banner", "center-strip", or "custom").',
        enum: ['top-banner', 'bottom-banner', 'center-strip', 'custom'],
        default: 'center-strip',
      },
      x: { type: 'number', description: 'Custom rectangle X in points (from bottom-left).', default: 50 },
      y: { type: 'number', description: 'Custom rectangle Y in points (from bottom-left).', default: 300 },
      width: { type: 'number', description: 'Custom rectangle width in points.', default: 300 },
      height: { type: 'number', description: 'Custom rectangle height in points.', default: 60 },
      label: {
        type: 'string',
        description: 'Optional white label drawn inside the black redaction bar (default: "REDACTED").',
        default: 'REDACTED',
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
      burnIn: {
        type: 'boolean',
        description: 'Burn redactions into pixels so underlying text cannot be copied or extracted (default: true).',
        default: true,
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.redact');
    const preset = params.preset ?? 'center-strip';
    const label = params.label !== undefined ? params.label : 'REDACTED';
    const burnIn = params.burnIn !== false;

    const doc = await PDFDocument.load(file.bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    const targetIndices = parsePageRange(params.pageRange, pages.length);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const { width: pageW, height: pageH } = page.getSize();

      let rx: number;
      let ry: number;
      let rw: number;
      let rh: number;

      if (preset === 'top-banner') {
        rx = 24;
        rw = Math.max(40, pageW - 48);
        rh = Math.round(pageH * 0.14);
        ry = pageH - rh - 24;
      } else if (preset === 'bottom-banner') {
        rx = 24;
        rw = Math.max(40, pageW - 48);
        rh = Math.round(pageH * 0.14);
        ry = 24;
      } else if (preset === 'center-strip') {
        rx = 24;
        rw = Math.max(40, pageW - 48);
        rh = Math.round(pageH * 0.18);
        ry = Math.round((pageH - rh) / 2);
      } else {
        rx = Number(params.x ?? 50);
        ry = Number(params.y ?? 300);
        rw = Math.max(10, Number(params.width ?? 300));
        rh = Math.max(10, Number(params.height ?? 60));
      }

      page.drawRectangle({
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        color: rgb(0, 0, 0),
        opacity: 1,
      });

      if (label.trim()) {
        const fontSize = Math.max(9, Math.min(18, Math.round(rh * 0.35)));
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const textHeight = font.heightAtSize(fontSize);
        page.drawText(label, {
          x: rx + Math.max(4, (rw - textWidth) / 2),
          y: ry + Math.max(4, (rh - textHeight) / 2),
          size: fontSize,
          font,
          color: rgb(1, 1, 1),
        });
      }
    }

    let outBytes = await doc.save();

    if (burnIn) {
      const scale = 2;
      const pdfProxy = await loadPdfDocument(outBytes);
      const burnedDoc = await PDFDocument.create();
      for (let pageNum = 1; pageNum <= pdfProxy.numPages; pageNum++) {
        context?.onProgress?.(
          30 + Math.round((pageNum / pdfProxy.numPages) * 65),
          `Burning redaction into page ${pageNum}`,
        );
        const rendered = await renderLoadedPageToImageBytes(pdfProxy, pageNum, {
          scale,
          format: 'jpeg',
          quality: 92,
        });
        const img = await burnedDoc.embedJpg(rendered.bytes);
        const page = burnedDoc.addPage([rendered.width / scale, rendered.height / scale]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: rendered.width / scale,
          height: rendered.height / scale,
        });
      }
      outBytes = await burnedDoc.save({ useObjectStreams: true });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: [
        {
          name: `redacted_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Redacted ${targetIndices.length} page(s) of ${file.name} (preset="${preset}", burnIn=${burnIn}).`,
      metadata: {
        redactedPages: targetIndices.length,
        preset,
        burnIn,
      },
    };
  },
};

export const pdfCropMarginsTool: ToolDefinition<{
  margin?: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  pageRange?: string;
}> = {
  id: 'pdf.crop_margins',
  mcpName: 'tenggoo_pdf_crop_margins',
  category: 'pdf',
  name: 'Crop PDF Margins',
  description:
    'Trim white margins from PDF pages by a uniform margin or explicit top/bottom/left/right points.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      margin: {
        type: 'number',
        description: 'Uniform margin in points to trim from all 4 sides (default: 24).',
        default: 24,
        minimum: 0,
        maximum: 250,
      },
      top: { type: 'number', description: 'Override top crop in points.' },
      bottom: { type: 'number', description: 'Override bottom crop in points.' },
      left: { type: 'number', description: 'Override left crop in points.' },
      right: { type: 'number', description: 'Override right crop in points.' },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.crop_margins');
    const uniform = Math.max(0, Number(params.margin ?? 24));
    const top = Math.max(0, Number(params.top ?? uniform));
    const bottom = Math.max(0, Number(params.bottom ?? uniform));
    const left = Math.max(0, Number(params.left ?? uniform));
    const right = Math.max(0, Number(params.right ?? uniform));

    const doc = await PDFDocument.load(file.bytes);
    const pages = doc.getPages();
    const targetIndices = parsePageRange(params.pageRange, pages.length);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const box = page.getMediaBox();
      const nx = box.x + left;
      const ny = box.y + bottom;
      const nw = Math.max(36, box.width - left - right);
      const nh = Math.max(36, box.height - top - bottom);
      page.setCropBox(nx, ny, nw, nh);
      page.setMediaBox(nx, ny, nw, nh);
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `cropped_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Cropped margins on ${targetIndices.length} page(s) of ${file.name} (L=${left}, R=${right}, T=${top}, B=${bottom} pt).`,
      metadata: {
        croppedPages: targetIndices.length,
        trimPt: { left, right, top, bottom },
      },
    };
  },
};

export const pdfRedactTextTool: ToolDefinition<{
  query?: string;
  isRegex?: boolean;
  presetPattern?: 'none' | 'nik' | 'email' | 'phone' | 'all_pii';
  caseSensitive?: boolean;
  label?: string;
  burnIn?: boolean;
  pageRange?: string;
}> = {
  id: 'pdf.redact_text',
  mcpName: 'tenggoo_pdf_redact_text',
  category: 'pdf',
  name: 'Auto Redact Text / PII',
  description:
    'Search text keywords or PII regex patterns (NIK, email, phone) in a PDF, automatically locate bounding boxes, black them out, and optionally burn into pixels.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Keyword or regex pattern to locate and redact.',
      },
      isRegex: {
        type: 'boolean',
        description: 'Treat query as a raw regular expression (default: false).',
        default: false,
      },
      presetPattern: {
        type: 'string',
        description: 'Built-in PII detector preset ("none", "nik", "email", "phone", "all_pii").',
        enum: ['none', 'nik', 'email', 'phone', 'all_pii'],
        default: 'none',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case-sensitive matching for query (default: false).',
        default: false,
      },
      label: {
        type: 'string',
        description: 'Optional white label drawn over redaction box (default: "REDACTED").',
        default: 'REDACTED',
      },
      burnIn: {
        type: 'boolean',
        description: 'Rasterize redacted pages so original text cannot be extracted (default: true).',
        default: true,
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.redact_text');
    const query = (params.query ?? '').trim();
    const presetPattern = params.presetPattern ?? 'none';
    const isRegex = Boolean(params.isRegex ?? false);
    const caseSensitive = Boolean(params.caseSensitive ?? false);
    const label = params.label !== undefined ? params.label : 'REDACTED';
    const burnIn = params.burnIn !== false;

    const patterns: RegExp[] = [];
    if (query) {
      const flags = caseSensitive ? 'g' : 'gi';
      const source = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      patterns.push(new RegExp(source, flags));
    }
    if (presetPattern === 'nik' || presetPattern === 'all_pii') {
      patterns.push(/\b\d{16}\b/g);
    }
    if (presetPattern === 'email' || presetPattern === 'all_pii') {
      patterns.push(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    }
    if (presetPattern === 'phone' || presetPattern === 'all_pii') {
      patterns.push(/(\+62|62|0)8[1-9][0-9]{6,10}\b/g);
    }

    if (patterns.length === 0) {
      throw new Error('pdf.redact_text requires a non-empty "query" or a "presetPattern" other than "none".');
    }

    context?.onProgress?.(20, 'Scanning PDF text positions');
    const positionedPages = await extractPdfPositionedText(file.bytes);
    const doc = await PDFDocument.load(file.bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pdfPages = doc.getPages();
    const targetIndices = new Set(parsePageRange(params.pageRange, pdfPages.length));

    let redactedMatches = 0;
    const matchedTerms: string[] = [];

    for (const pData of positionedPages) {
      const pageIdx = pData.pageNumber - 1;
      if (!targetIndices.has(pageIdx)) continue;
      const pdfPage = pdfPages[pageIdx];

      for (const item of pData.items) {
        if (!item.str) continue;
        for (const regex of patterns) {
          regex.lastIndex = 0;
          let match = regex.exec(item.str);
          while (match !== null) {
            if (match[0].length === 0) {
              regex.lastIndex++;
              match = regex.exec(item.str);
              continue;
            }
            const startRatio = match.index / item.str.length;
            const lenRatio = match[0].length / item.str.length;
            const rx = Math.max(0, item.x + item.width * startRatio - 2);
            const ry = Math.max(0, item.y - item.height * 0.25);
            const rw = Math.max(12, item.width * lenRatio + 4);
            const rh = Math.max(12, item.height * 1.35);

            pdfPage.drawRectangle({
              x: rx,
              y: ry,
              width: rw,
              height: rh,
              color: rgb(0, 0, 0),
              opacity: 1,
            });

            if (label.trim() && rw >= 35) {
              const fontSize = Math.max(6, Math.min(11, Math.round(rh * 0.5)));
              const textWidth = font.widthOfTextAtSize(label, fontSize);
              if (textWidth + 4 <= rw) {
                pdfPage.drawText(label, {
                  x: rx + (rw - textWidth) / 2,
                  y: ry + Math.max(2, (rh - fontSize) / 2),
                  size: fontSize,
                  font,
                  color: rgb(1, 1, 1),
                });
              }
            }

            redactedMatches++;
            if (matchedTerms.length < 25) matchedTerms.push(match[0]);
            match = regex.exec(item.str);
          }
        }
      }
    }

    let outBytes = await doc.save();

    if (burnIn && redactedMatches > 0) {
      const scale = 2;
      const pdfProxy = await loadPdfDocument(outBytes);
      const burnedDoc = await PDFDocument.create();
      for (let pageNum = 1; pageNum <= pdfProxy.numPages; pageNum++) {
        context?.onProgress?.(
          45 + Math.round((pageNum / pdfProxy.numPages) * 50),
          `Burning text redactions on page ${pageNum}`,
        );
        const rendered = await renderLoadedPageToImageBytes(pdfProxy, pageNum, {
          scale,
          format: 'jpeg',
          quality: 92,
        });
        const img = await burnedDoc.embedJpg(rendered.bytes);
        const page = burnedDoc.addPage([rendered.width / scale, rendered.height / scale]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: rendered.width / scale,
          height: rendered.height / scale,
        });
      }
      outBytes = await burnedDoc.save({ useObjectStreams: true });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: [
        {
          name: `redacted_text_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Redacted ${redactedMatches} text match(es) in ${file.name} (burnIn=${burnIn}).`,
      metadata: {
        redactedMatches,
        burnIn,
        sampleMatchedTerms: matchedTerms,
      },
    };
  },
};

export const pdfFormInspectTool: ToolDefinition<Record<string, never>> = {
  id: 'pdf.form_inspect',
  mcpName: 'tenggoo_pdf_form_inspect',
  category: 'pdf',
  name: 'Inspect PDF Form Fields',
  description: 'Inspect interactive AcroForm fields (text, checkbox, dropdown, radio) and their current values as JSON.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/json'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {},
  },
  async execute(inputs, _params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.form_inspect');
    const doc = await PDFDocument.load(file.bytes);
    const form = doc.getForm();
    const fields = form.getFields().map((field) => {
      let fieldType = 'unknown';
      let value: unknown = null;
      let options: string[] | undefined;

      if (field instanceof PDFTextField) {
        fieldType = 'text';
        value = field.getText() ?? '';
      } else if (field instanceof PDFCheckBox) {
        fieldType = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFDropdown) {
        fieldType = 'dropdown';
        value = field.getSelected();
        options = field.getOptions();
      } else if (field instanceof PDFOptionList) {
        fieldType = 'option_list';
        value = field.getSelected();
        options = field.getOptions();
      } else if (field instanceof PDFRadioGroup) {
        fieldType = 'radio';
        value = field.getSelected() ?? null;
        options = field.getOptions();
      }

      return {
        name: field.getName(),
        type: fieldType,
        value,
        ...(options ? { options } : {}),
        isReadOnly: field.isReadOnly(),
      };
    });

    const report = {
      fileName: file.name,
      fieldCount: fields.length,
      fields,
    };
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `${getBaseName(file.name)}_form_fields.json`,
          mimeType: 'application/json',
          bytes: new TextEncoder().encode(JSON.stringify(report, null, 2)),
        },
      ],
      summary: `Inspected ${fields.length} form field(s) in ${file.name}.`,
      metadata: report,
    };
  },
};

interface FormFieldCreationSpec {
  name: string;
  type?: 'text' | 'checkbox';
  page?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  value?: string | boolean;
}

export const pdfFormFillTool: ToolDefinition<{
  values?: Record<string, unknown> | string;
  createFields?: FormFieldCreationSpec[] | string;
  flatten?: boolean;
}> = {
  id: 'pdf.form_fill',
  mcpName: 'tenggoo_pdf_form_fill',
  category: 'pdf',
  name: 'Fill PDF Form Fields',
  description:
    'Fill interactive AcroForm fields in a PDF from a JSON key-value map (and optionally create fields or flatten after filling).',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      values: {
        type: 'object',
        description: 'Map of fieldName -> value (string for text/dropdown/radio, boolean for checkbox).',
      },
      createFields: {
        type: 'array',
        description:
          'Optional list of new AcroForm fields to add to pages before filling: [{ name, type, page, x, y, width, height, value }].',
      },
      flatten: {
        type: 'boolean',
        description: 'Flatten form fields into static page graphics after filling (default: false).',
        default: false,
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.form_fill');
    const doc = await PDFDocument.load(file.bytes);
    const form = doc.getForm();
    const pages = doc.getPages();

    let fieldsToCreate: FormFieldCreationSpec[] = [];
    if (Array.isArray(params.createFields)) {
      fieldsToCreate = params.createFields;
    } else if (typeof params.createFields === 'string' && params.createFields.trim()) {
      fieldsToCreate = JSON.parse(params.createFields) as FormFieldCreationSpec[];
    }

    for (const spec of fieldsToCreate) {
      const targetPage = pages[Math.max(0, Math.min(pages.length - 1, (spec.page ?? 1) - 1))];
      if (!targetPage || !spec.name) continue;
      if (spec.type === 'checkbox') {
        const cb = form.createCheckBox(spec.name);
        cb.addToPage(targetPage, {
          x: spec.x,
          y: spec.y,
          width: spec.width ?? 16,
          height: spec.height ?? 16,
        });
        if (spec.value) cb.check();
      } else {
        const tf = form.createTextField(spec.name);
        tf.addToPage(targetPage, {
          x: spec.x,
          y: spec.y,
          width: spec.width ?? 180,
          height: spec.height ?? 22,
        });
        if (spec.value !== undefined) tf.setText(String(spec.value));
      }
    }

    let valueMap: Record<string, unknown> = {};
    if (typeof params.values === 'string' && params.values.trim()) {
      valueMap = JSON.parse(params.values) as Record<string, unknown>;
    } else if (params.values && typeof params.values === 'object') {
      valueMap = params.values;
    }

    let filledCount = 0;
    for (const [fieldName, rawVal] of Object.entries(valueMap)) {
      let field;
      try {
        field = form.getField(fieldName);
      } catch {
        continue;
      }

      if (field instanceof PDFTextField) {
        field.setText(rawVal === null || rawVal === undefined ? '' : String(rawVal));
        filledCount++;
      } else if (field instanceof PDFCheckBox) {
        if (rawVal === true || rawVal === 'true' || rawVal === 1) {
          field.check();
        } else {
          field.uncheck();
        }
        filledCount++;
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        field.select(String(rawVal));
        filledCount++;
      } else if (field instanceof PDFRadioGroup) {
        field.select(String(rawVal));
        filledCount++;
      }
    }

    const flatten = Boolean(params.flatten ?? false);
    if (flatten) {
      form.flatten();
    }

    const outBytes = await doc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `filled_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Filled ${filledCount} form field(s) in ${file.name}${flatten ? ' and flattened form' : ''}.`,
      metadata: {
        filledCount,
        createdCount: fieldsToCreate.length,
        flattened: flatten,
      },
    };
  },
};

export const pdfDiffTextTool: ToolDefinition<{
  format?: 'markdown' | 'json';
}> = {
  id: 'pdf.diff_text',
  mcpName: 'tenggoo_pdf_diff_text',
  category: 'pdf',
  name: 'Compare Two PDFs (Text Diff)',
  description: 'Compare text content page-by-page between two PDF documents and output added/removed differences.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['text/markdown', 'application/json'],
  minInputs: 2,
  maxInputs: 2,
  parameterSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Output report format ("markdown" or "json").',
        enum: ['markdown', 'json'],
        default: 'markdown',
      },
    },
  },
  async execute(inputs, params, context) {
    const pdfInputs = inputs.filter(isPdfFile);
    if (pdfInputs.length < 2) {
      throw new Error('pdf.diff_text requires 2 PDF files to compare.');
    }

    const [fileA, fileB] = pdfInputs;
    const format = params.format ?? 'markdown';

    context?.onProgress?.(25, `Extracting text from ${fileA.name}`);
    const pagesA = await extractPdfTextPages(fileA.bytes);
    context?.onProgress?.(60, `Extracting text from ${fileB.name}`);
    const pagesB = await extractPdfTextPages(fileB.bytes);

    const maxPages = Math.max(pagesA.length, pagesB.length);
    const pageDiffs: {
      pageNumber: number;
      identical: boolean;
      similarityPercent: number;
      addedTokens: string[];
      removedTokens: string[];
    }[] = [];

    let totalSimilarity = 0;
    let pagesChanged = 0;

    for (let i = 0; i < maxPages; i++) {
      const textA = pagesA[i]?.text ?? '';
      const textB = pagesB[i]?.text ?? '';
      const tokensA = textA.split(/\s+/).filter(Boolean);
      const tokensB = textB.split(/\s+/).filter(Boolean);
      const setA = new Set(tokensA);
      const setB = new Set(tokensB);

      const added = tokensB.filter((t) => !setA.has(t));
      const removed = tokensA.filter((t) => !setB.has(t));
      const unionSize = new Set([...tokensA, ...tokensB]).size;
      const intersectionSize = [...setA].filter((t) => setB.has(t)).length;
      const similarity =
        unionSize === 0 ? 100 : Math.round((intersectionSize / unionSize) * 1000) / 10;
      const identical = textA === textB;

      if (!identical) pagesChanged++;
      totalSimilarity += similarity;

      pageDiffs.push({
        pageNumber: i + 1,
        identical,
        similarityPercent: similarity,
        addedTokens: added.slice(0, 60),
        removedTokens: removed.slice(0, 60),
      });
    }

    const overallSimilarity =
      maxPages === 0 ? 100 : Math.round((totalSimilarity / maxPages) * 10) / 10;
    const reportData = {
      fileA: fileA.name,
      fileB: fileB.name,
      pagesA: pagesA.length,
      pagesB: pagesB.length,
      pagesChanged,
      overallSimilarityPercent: overallSimilarity,
      pageDiffs,
    };

    let content: string;
    let mimeType: string;
    let outName: string;

    if (format === 'json') {
      mimeType = 'application/json';
      outName = 'pdf_diff_report.json';
      content = JSON.stringify(reportData, null, 2);
    } else {
      mimeType = 'text/markdown';
      outName = 'pdf_diff_report.md';
      content =
        `# PDF Comparison Report\n\n` +
        `- **Document A**: ${fileA.name} (${pagesA.length} pages)\n` +
        `- **Document B**: ${fileB.name} (${pagesB.length} pages)\n` +
        `- **Pages Changed**: ${pagesChanged} / ${maxPages}\n` +
        `- **Overall Similarity**: ${overallSimilarity}%\n\n` +
        pageDiffs
          .map(
            (d) =>
              `## Page ${d.pageNumber} (${d.identical ? 'Identical' : `${d.similarityPercent}% similar`})\n` +
              (d.identical
                ? `No text changes detected.\n`
                : `- **Added**: ${d.addedTokens.join(' ') || '*(none)*'}\n- **Removed**: ${d.removedTokens.join(' ') || '*(none)*'}\n`),
          )
          .join('\n');
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: [
        {
          name: outName,
          mimeType,
          bytes: new TextEncoder().encode(content),
        },
      ],
      summary: `Compared ${fileA.name} vs ${fileB.name}: ${pagesChanged}/${maxPages} page(s) changed (${overallSimilarity}% similar).`,
      metadata: reportData,
    };
  },
};

export const pdfNupTool: ToolDefinition<{
  pagesPerSheet?: 2 | 4 | 6 | 9;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'auto' | 'portrait' | 'landscape';
  margin?: number;
  drawBorder?: boolean;
}> = {
  id: 'pdf.nup',
  mcpName: 'tenggoo_pdf_nup',
  category: 'pdf',
  name: 'PDF N-up Sheet Layout',
  description: 'Arrange multiple PDF pages (2, 4, 6, or 9 pages per sheet) onto each output A4/Letter page.',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['application/pdf'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      pagesPerSheet: {
        type: 'integer',
        description: 'Number of source pages placed per output sheet (2, 4, 6, or 9).',
        enum: [2, 4, 6, 9],
        default: 2,
      },
      pageSize: {
        type: 'string',
        description: 'Output sheet size ("A4" or "Letter").',
        enum: ['A4', 'Letter'],
        default: 'A4',
      },
      orientation: {
        type: 'string',
        description: 'Sheet orientation ("auto", "portrait", or "landscape").',
        enum: ['auto', 'portrait', 'landscape'],
        default: 'auto',
      },
      margin: {
        type: 'number',
        description: 'Outer sheet margin and cell gap in points (default: 20).',
        default: 20,
        minimum: 0,
      },
      drawBorder: {
        type: 'boolean',
        description: 'Draw subtle borders around each mini-page cell (default: true).',
        default: true,
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.nup');
    const nup = Number(params.pagesPerSheet ?? 2);
    if (![2, 4, 6, 9].includes(nup)) {
      throw new Error('pagesPerSheet must be 2, 4, 6, or 9.');
    }

    const pageSize = params.pageSize ?? 'A4';
    const orientation = params.orientation ?? 'auto';
    const margin = Math.max(0, Number(params.margin ?? 20));
    const drawBorder = params.drawBorder !== false;

    const baseW = pageSize === 'A4' ? 595.28 : 612;
    const baseH = pageSize === 'A4' ? 841.89 : 792;
    const isLandscape =
      orientation === 'landscape' || (orientation === 'auto' && (nup === 2 || nup === 6));
    const sheetW = isLandscape ? baseH : baseW;
    const sheetH = isLandscape ? baseW : baseH;

    const gridMap: Record<number, { cols: number; rows: number }> = {
      2: { cols: isLandscape ? 2 : 1, rows: isLandscape ? 1 : 2 },
      4: { cols: 2, rows: 2 },
      6: { cols: isLandscape ? 3 : 2, rows: isLandscape ? 2 : 3 },
      9: { cols: 3, rows: 3 },
    };
    const { cols, rows } = gridMap[nup];
    const gap = Math.max(8, margin * 0.5);
    const cellW = (sheetW - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (sheetH - margin * 2 - gap * (rows - 1)) / rows;

    const srcDoc = await PDFDocument.load(file.bytes);
    const outDoc = await PDFDocument.create();
    const embeddedPages = await outDoc.embedPages(srcDoc.getPages());

    for (let i = 0; i < embeddedPages.length; i += nup) {
      const sheet = outDoc.addPage([sheetW, sheetH]);
      for (let slot = 0; slot < nup && i + slot < embeddedPages.length; slot++) {
        const emb = embeddedPages[i + slot];
        const col = slot % cols;
        const row = Math.floor(slot / cols);

        const cellX = margin + col * (cellW + gap);
        const cellY = sheetH - margin - (row + 1) * cellH - row * gap;

        const scale = Math.min(cellW / emb.width, cellH / emb.height);
        const drawW = emb.width * scale;
        const drawH = emb.height * scale;

        sheet.drawPage(emb, {
          x: cellX + (cellW - drawW) / 2,
          y: cellY + (cellH - drawH) / 2,
          width: drawW,
          height: drawH,
        });

        if (drawBorder) {
          sheet.drawRectangle({
            x: cellX,
            y: cellY,
            width: cellW,
            height: cellH,
            borderColor: rgb(0.82, 0.85, 0.9),
            borderWidth: 0.75,
          });
        }
      }
      context?.onProgress?.(Math.round(((i + nup) / embeddedPages.length) * 95));
    }

    const outBytes = await outDoc.save();
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `nup_${nup}x_${file.name}`,
          mimeType: 'application/pdf',
          bytes: outBytes,
        },
      ],
      summary: `Arranged ${embeddedPages.length} page(s) of ${file.name} into ${outDoc.getPageCount()} ${nup}-up sheet(s).`,
      metadata: {
        sourcePages: embeddedPages.length,
        outputSheets: outDoc.getPageCount(),
        pagesPerSheet: nup,
      },
    };
  },
};

export const pdfExtractTablesTool: ToolDefinition<{
  format?: 'markdown' | 'csv' | 'json';
  rowTolerancePt?: number;
  pageRange?: string;
}> = {
  id: 'pdf.extract_tables',
  mcpName: 'tenggoo_pdf_extract_tables',
  category: 'pdf',
  name: 'Extract Tables & Rows from PDF',
  description:
    'Cluster PDF text items by Y/X coordinates into tabular rows and columns (Markdown table, CSV, or JSON).',
  acceptsMimeTypes: ['application/pdf'],
  producesMimeTypes: ['text/markdown', 'text/csv', 'application/json'],
  minInputs: 1,
  maxInputs: 1,
  parameterSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Output format ("markdown", "csv", or "json").',
        enum: ['markdown', 'csv', 'json'],
        default: 'markdown',
      },
      rowTolerancePt: {
        type: 'number',
        description: 'Vertical tolerance in points for grouping items onto the same row (default: 5).',
        default: 5,
        minimum: 1,
        maximum: 30,
      },
      pageRange: {
        type: 'string',
        description: 'Optional 1-based page range (blank = all pages).',
      },
    },
  },
  async execute(inputs, params, context) {
    const file = findPrimaryPdf(inputs, 'pdf.extract_tables');
    const format = params.format ?? 'markdown';
    const rowTol = Number(params.rowTolerancePt ?? 5);

    const pagesData = await extractPdfPositionedText(file.bytes);
    const targetIndices = new Set(parsePageRange(params.pageRange, pagesData.length));

    const extractedPages: { pageNumber: number; rows: string[][] }[] = [];

    for (const page of pagesData) {
      if (!targetIndices.has(page.pageNumber - 1)) continue;

      const sortedItems = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
      const rowGroups: { avgY: number; items: typeof page.items }[] = [];

      for (const item of sortedItems) {
        const existing = rowGroups.find((g) => Math.abs(g.avgY - item.y) <= rowTol);
        if (existing) {
          existing.items.push(item);
          existing.avgY =
            existing.items.reduce((sum, it) => sum + it.y, 0) / existing.items.length;
        } else {
          rowGroups.push({ avgY: item.y, items: [item] });
        }
      }

      rowGroups.sort((a, b) => b.avgY - a.avgY);
      const rows: string[][] = [];

      for (const group of rowGroups) {
        group.items.sort((a, b) => a.x - b.x);
        const cells: string[] = [];
        let currentCell = '';
        let prevEndX = -Infinity;

        for (const it of group.items) {
          const gap = it.x - prevEndX;
          const colThreshold = Math.max(8, it.height * 0.65);
          if (currentCell && gap > colThreshold) {
            cells.push(currentCell.trim());
            currentCell = it.str;
          } else {
            currentCell = currentCell ? `${currentCell} ${it.str}` : it.str;
          }
          prevEndX = it.x + it.width;
        }
        if (currentCell.trim()) {
          cells.push(currentCell.trim());
        }
        if (cells.length > 0) rows.push(cells);
      }

      extractedPages.push({ pageNumber: page.pageNumber, rows });
    }

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'json') {
      mimeType = 'application/json';
      ext = 'json';
      content = JSON.stringify({ fileName: file.name, pages: extractedPages }, null, 2);
    } else if (format === 'csv') {
      mimeType = 'text/csv';
      ext = 'csv';
      const csvEscape = (cell: string) =>
        /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
      content = extractedPages
        .flatMap((p) => p.rows.map((row) => row.map(csvEscape).join(',')))
        .join('\n');
    } else {
      mimeType = 'text/markdown';
      ext = 'md';
      content = extractedPages
        .map((p) => {
          const maxCols = Math.max(1, ...p.rows.map((r) => r.length));
          const normalized = p.rows.map((r) =>
            Array.from({ length: maxCols }, (_, idx) => (r[idx] ?? '').replace(/\|/g, '\\|')),
          );
          if (normalized.length === 0) return `## Page ${p.pageNumber}\n\n*(No rows found)*`;
          const header = `| ${normalized[0].join(' | ')} |`;
          const divider = `| ${normalized[0].map(() => '---').join(' | ')} |`;
          const body = normalized.slice(1).map((r) => `| ${r.join(' | ')} |`).join('\n');
          return `## Page ${p.pageNumber}\n\n${header}\n${divider}${body ? `\n${body}` : ''}`;
        })
        .join('\n\n');
    }

    const totalRows = extractedPages.reduce((sum, p) => sum + p.rows.length, 0);
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: `${getBaseName(file.name)}_tables.${ext}`,
          mimeType,
          bytes: new TextEncoder().encode(content),
        },
      ],
      summary: `Extracted ${totalRows} tabular row(s) across ${extractedPages.length} page(s) of ${file.name}.`,
      metadata: {
        totalRows,
        pageCount: extractedPages.length,
        pages: extractedPages,
        text: content,
      },
    };
  },
};

export const PDF_TOOLS: ToolDefinition[] = [
  pdfMergeTool as ToolDefinition,
  pdfSplitTool as ToolDefinition,
  pdfReorderTool as ToolDefinition,
  pdfRotateTool as ToolDefinition,
  pdfCompressTool as ToolDefinition,
  pdfWatermarkTool as ToolDefinition,
  pdfPageNumbersTool as ToolDefinition,
  pdfFromImagesTool as ToolDefinition,
  pdfToImagesTool as ToolDefinition,
  pdfUnlockTool as ToolDefinition,
  pdfExtractTextTool as ToolDefinition,
  pdfMetadataTool as ToolDefinition,
  pdfStampImageTool as ToolDefinition,
  pdfRedactTool as ToolDefinition,
  pdfCropMarginsTool as ToolDefinition,
  pdfRedactTextTool as ToolDefinition,
  pdfFormInspectTool as ToolDefinition,
  pdfFormFillTool as ToolDefinition,
  pdfDiffTextTool as ToolDefinition,
  pdfNupTool as ToolDefinition,
  pdfExtractTablesTool as ToolDefinition,
];
