import {
  formatByteSize,
  getBaseName,
  isImageFile,
  replaceExtension,
} from '../types.ts';
import type { ToolDefinition, VirtualFile } from '../types.ts';
import {
  createCanvasSurface,
  formatToMimeType,
  loadImageSource,
  mimeTypeToCanvasFormat,
} from '../runtime/canvasAdapter.ts';
import type { CanvasImageFormat } from '../runtime/canvasAdapter.ts';

function ensureImageInputs(inputs: VirtualFile[], toolId: string): VirtualFile[] {
  const images = inputs.filter(isImageFile);
  if (images.length === 0) {
    throw new Error(`${toolId} requires at least one image input (PNG, JPEG, or WebP).`);
  }
  return images;
}

function buildSingleEntryIco(pngBytes: Uint8Array, width: number, height: number): Uint8Array {
  const headerSize = 6;
  const entrySize = 16;
  const offset = headerSize + entrySize;
  const out = new Uint8Array(offset + pngBytes.byteLength);
  const view = new DataView(out.buffer);

  // ICONDIR header
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type 1 = ICO
  view.setUint16(4, 1, true); // Image count = 1

  // ICONDIRENTRY
  out[6] = width >= 256 ? 0 : width;
  out[7] = height >= 256 ? 0 : height;
  out[8] = 0; // Color palette count
  out[9] = 0; // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, pngBytes.byteLength, true); // Image data size
  view.setUint32(18, offset, true); // Offset of image data

  out.set(pngBytes, offset);
  return out;
}

export const imageCompressTool: ToolDefinition<{
  quality?: number;
  format?: 'keep' | CanvasImageFormat;
  maxWidth?: number;
}> = {
  id: 'image.compress',
  mcpName: 'tenggoo_image_compress',
  category: 'image',
  name: 'Compress Images',
  description:
    'Compress one or more images (JPEG, PNG, WebP) with optional maxWidth downscaling and format conversion.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      quality: {
        type: 'integer',
        description: 'Compression quality from 1 to 100 (default: 80). Applies to JPEG and WebP.',
        default: 80,
        minimum: 1,
        maximum: 100,
      },
      format: {
        type: 'string',
        description: 'Output format: "keep" preserves format, or convert to "jpeg", "webp", or "png".',
        enum: ['keep', 'jpeg', 'webp', 'png'],
        default: 'keep',
      },
      maxWidth: {
        type: 'integer',
        description: 'Optional maximum width in pixels; wider images are scaled down proportionally.',
        minimum: 16,
      },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.compress');
    const quality = Math.max(1, Math.min(100, Number(params.quality ?? 80)));
    const targetMode = params.format ?? 'keep';
    const maxWidth = params.maxWidth ? Math.max(16, Number(params.maxWidth)) : undefined;

    const outputs: VirtualFile[] = [];
    let totalBefore = 0;
    let totalAfter = 0;

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      totalBefore += file.bytes.byteLength;
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Compressing ${file.name}`);

      const source = await loadImageSource(file.bytes, file.mimeType);
      let targetW = source.width;
      let targetH = source.height;
      if (maxWidth && targetW > maxWidth) {
        const scale = maxWidth / targetW;
        targetW = Math.round(targetW * scale);
        targetH = Math.max(1, Math.round(targetH * scale));
      }

      const outFormat: CanvasImageFormat =
        targetMode === 'keep' ? mimeTypeToCanvasFormat(file.mimeType, file.name) : targetMode;

      const surface = await createCanvasSurface(targetW, targetH);
      surface.ctx.imageSmoothingEnabled = true;
      surface.ctx.imageSmoothingQuality = 'high';
      if (outFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, targetW, targetH);
      }
      surface.ctx.drawImage(source.raw, 0, 0, targetW, targetH);

      const outBytes = await surface.toBytes(outFormat, quality);
      totalAfter += outBytes.byteLength;
      const ext = outFormat === 'jpeg' ? 'jpg' : outFormat;

      outputs.push({
        name: replaceExtension(file.name, ext),
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: {
          width: targetW,
          height: targetH,
          originalBytes: file.bytes.byteLength,
          compressedBytes: outBytes.byteLength,
        },
      });
    }

    const savingsPct =
      totalBefore > 0 ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1) : '0.0';
    context?.onProgress?.(100, 'Complete');

    return {
      files: outputs,
      summary: `Compressed ${outputs.length} image(s): ${formatByteSize(totalBefore)} -> ${formatByteSize(totalAfter)} (${savingsPct}% change).`,
      metadata: {
        count: outputs.length,
        totalBeforeBytes: totalBefore,
        totalAfterBytes: totalAfter,
        savingsPercent: Number(savingsPct),
      },
    };
  },
};

export const imageConvertTool: ToolDefinition<{
  targetFormat?: CanvasImageFormat | 'ico';
  quality?: number;
}> = {
  id: 'image.convert',
  mcpName: 'tenggoo_image_convert',
  category: 'image',
  name: 'Convert Image Format',
  description: 'Convert one or more images between PNG, JPEG, WebP, and Windows ICO formats.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      targetFormat: {
        type: 'string',
        description: 'Target image format ("png", "jpeg", "webp", or "ico").',
        enum: ['png', 'jpeg', 'webp', 'ico'],
        default: 'png',
      },
      quality: {
        type: 'integer',
        description: 'Output quality for JPEG/WebP (1-100, default: 90).',
        default: 90,
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['targetFormat'],
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.convert');
    const targetFormat = params.targetFormat ?? 'png';
    const quality = Math.max(1, Math.min(100, Number(params.quality ?? 90)));
    const outputs: VirtualFile[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(
        Math.round(((i + 1) / images.length) * 90),
        `Converting ${file.name} -> ${targetFormat}`,
      );
      const source = await loadImageSource(file.bytes, file.mimeType);

      if (targetFormat === 'ico') {
        const scale = Math.min(1, 256 / Math.max(source.width, source.height));
        const iconW = Math.max(1, Math.round(source.width * scale));
        const iconH = Math.max(1, Math.round(source.height * scale));
        const surface = await createCanvasSurface(iconW, iconH);
        surface.ctx.imageSmoothingEnabled = true;
        surface.ctx.imageSmoothingQuality = 'high';
        surface.ctx.drawImage(source.raw, 0, 0, iconW, iconH);
        const pngBytes = await surface.toBytes('png');
        const icoBytes = buildSingleEntryIco(pngBytes, iconW, iconH);
        outputs.push({
          name: replaceExtension(file.name, 'ico'),
          mimeType: 'image/x-icon',
          bytes: icoBytes,
          metadata: { width: iconW, height: iconH },
        });
        continue;
      }

      const surface = await createCanvasSurface(source.width, source.height);
      if (targetFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, source.width, source.height);
      }
      surface.ctx.drawImage(source.raw, 0, 0, source.width, source.height);
      const outBytes = await surface.toBytes(targetFormat, quality);
      const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;

      outputs.push({
        name: replaceExtension(file.name, ext),
        mimeType: formatToMimeType(targetFormat),
        bytes: outBytes,
        metadata: { width: source.width, height: source.height },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Converted ${outputs.length} image(s) to ${targetFormat.toUpperCase()}.`,
      metadata: { count: outputs.length, targetFormat },
    };
  },
};

export const imageResizeTool: ToolDefinition<{
  width?: number;
  height?: number;
  scalePercent?: number;
  fit?: 'inside' | 'contain' | 'cover' | 'stretch';
  background?: string;
}> = {
  id: 'image.resize',
  mcpName: 'tenggoo_image_resize',
  category: 'image',
  name: 'Resize Images',
  description:
    'Resize images by exact width/height or percentage, with inside, contain, cover, or stretch fitting.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      width: { type: 'integer', description: 'Target width in pixels.', minimum: 1 },
      height: { type: 'integer', description: 'Target height in pixels.', minimum: 1 },
      scalePercent: {
        type: 'number',
        description: 'Scale percentage (e.g. 50 for half size) when width/height are omitted.',
        minimum: 1,
        maximum: 500,
      },
      fit: {
        type: 'string',
        description: 'Fitting strategy when both width and height are specified.',
        enum: ['inside', 'contain', 'cover', 'stretch'],
        default: 'inside',
      },
      background: {
        type: 'string',
        description: 'Background hex color for "contain" padding (default: "#ffffff").',
        default: '#ffffff',
      },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.resize');
    const fit = params.fit ?? 'inside';
    const background = params.background ?? '#ffffff';
    const outputs: VirtualFile[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Resizing ${file.name}`);

      const source = await loadImageSource(file.bytes, file.mimeType);
      const srcW = source.width;
      const srcH = source.height;
      const outFormat = mimeTypeToCanvasFormat(file.mimeType, file.name);

      let canvasW = srcW;
      let canvasH = srcH;
      let drawX = 0;
      let drawY = 0;
      let drawW = srcW;
      let drawH = srcH;

      const reqW = params.width ? Math.max(1, Math.round(Number(params.width))) : undefined;
      const reqH = params.height ? Math.max(1, Math.round(Number(params.height))) : undefined;
      const pct = params.scalePercent ? Math.max(1, Number(params.scalePercent)) : undefined;

      if (!reqW && !reqH && pct) {
        canvasW = Math.max(1, Math.round((srcW * pct) / 100));
        canvasH = Math.max(1, Math.round((srcH * pct) / 100));
        drawW = canvasW;
        drawH = canvasH;
      } else if (reqW && !reqH) {
        canvasW = reqW;
        canvasH = Math.max(1, Math.round((srcH * reqW) / srcW));
        drawW = canvasW;
        drawH = canvasH;
      } else if (!reqW && reqH) {
        canvasH = reqH;
        canvasW = Math.max(1, Math.round((srcW * reqH) / srcH));
        drawW = canvasW;
        drawH = canvasH;
      } else if (reqW && reqH) {
        if (fit === 'stretch') {
          canvasW = reqW;
          canvasH = reqH;
          drawW = reqW;
          drawH = reqH;
        } else if (fit === 'inside') {
          const scale = Math.min(reqW / srcW, reqH / srcH);
          canvasW = Math.max(1, Math.round(srcW * scale));
          canvasH = Math.max(1, Math.round(srcH * scale));
          drawW = canvasW;
          drawH = canvasH;
        } else if (fit === 'contain') {
          const scale = Math.min(reqW / srcW, reqH / srcH);
          canvasW = reqW;
          canvasH = reqH;
          drawW = Math.max(1, Math.round(srcW * scale));
          drawH = Math.max(1, Math.round(srcH * scale));
          drawX = Math.round((canvasW - drawW) / 2);
          drawY = Math.round((canvasH - drawH) / 2);
        } else {
          // cover
          const scale = Math.max(reqW / srcW, reqH / srcH);
          canvasW = reqW;
          canvasH = reqH;
          drawW = Math.max(1, Math.round(srcW * scale));
          drawH = Math.max(1, Math.round(srcH * scale));
          drawX = Math.round((canvasW - drawW) / 2);
          drawY = Math.round((canvasH - drawH) / 2);
        }
      }

      const surface = await createCanvasSurface(canvasW, canvasH);
      surface.ctx.imageSmoothingEnabled = true;
      surface.ctx.imageSmoothingQuality = 'high';

      if (fit === 'contain' || outFormat === 'jpeg') {
        if (background !== 'transparent' || outFormat === 'jpeg') {
          surface.ctx.fillStyle = background === 'transparent' ? '#ffffff' : background;
          surface.ctx.fillRect(0, 0, canvasW, canvasH);
        }
      }

      surface.ctx.drawImage(source.raw, drawX, drawY, drawW, drawH);
      const outBytes = await surface.toBytes(outFormat, 90);

      outputs.push({
        name: file.name,
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: { width: canvasW, height: canvasH, originalWidth: srcW, originalHeight: srcH },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Resized ${outputs.length} image(s).`,
      metadata: {
        count: outputs.length,
        dimensions: outputs.map((f) => ({
          name: f.name,
          width: f.metadata?.width,
          height: f.metadata?.height,
        })),
      },
    };
  },
};

export const imageCropTool: ToolDefinition<{
  aspectRatio?: '1:1' | '3:4' | '4:6' | '4:3' | '16:9' | 'custom';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}> = {
  id: 'image.crop',
  mcpName: 'tenggoo_image_crop',
  category: 'image',
  name: 'Crop Images',
  description:
    'Center-crop images to standard ratios (1:1, 3:4, 4:6 pas foto, 4:3, 16:9) or custom x/y/width/height pixels.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      aspectRatio: {
        type: 'string',
        description: 'Preset ratio for centered crop, or "custom" for explicit x/y/width/height.',
        enum: ['1:1', '3:4', '4:6', '4:3', '16:9', 'custom'],
        default: '1:1',
      },
      x: { type: 'integer', description: 'Crop origin X in pixels (when aspectRatio="custom").', default: 0 },
      y: { type: 'integer', description: 'Crop origin Y in pixels (when aspectRatio="custom").', default: 0 },
      width: { type: 'integer', description: 'Crop width in pixels (when aspectRatio="custom").' },
      height: { type: 'integer', description: 'Crop height in pixels (when aspectRatio="custom").' },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.crop');
    const ratioMode = params.aspectRatio ?? '1:1';
    const outputs: VirtualFile[] = [];

    const ratioMap: Record<string, number> = {
      '1:1': 1,
      '3:4': 3 / 4,
      '4:6': 4 / 6,
      '4:3': 4 / 3,
      '16:9': 16 / 9,
    };

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Cropping ${file.name}`);
      const source = await loadImageSource(file.bytes, file.mimeType);
      const outFormat = mimeTypeToCanvasFormat(file.mimeType, file.name);

      let sx: number;
      let sy: number;
      let sw: number;
      let sh: number;

      if (ratioMode === 'custom') {
        sx = Math.max(0, Math.min(source.width - 1, Math.round(Number(params.x ?? 0))));
        sy = Math.max(0, Math.min(source.height - 1, Math.round(Number(params.y ?? 0))));
        const reqW = params.width ? Math.round(Number(params.width)) : source.width - sx;
        const reqH = params.height ? Math.round(Number(params.height)) : source.height - sy;
        sw = Math.max(1, Math.min(source.width - sx, reqW));
        sh = Math.max(1, Math.min(source.height - sy, reqH));
      } else {
        const targetRatio = ratioMap[ratioMode] ?? 1;
        const currentRatio = source.width / source.height;
        if (currentRatio > targetRatio) {
          sh = source.height;
          sw = Math.max(1, Math.round(sh * targetRatio));
          sx = Math.round((source.width - sw) / 2);
          sy = 0;
        } else {
          sw = source.width;
          sh = Math.max(1, Math.round(sw / targetRatio));
          sx = 0;
          sy = Math.round((source.height - sh) / 2);
        }
      }

      const surface = await createCanvasSurface(sw, sh);
      if (outFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, sw, sh);
      }
      surface.ctx.drawImage(source.raw, sx, sy, sw, sh, 0, 0, sw, sh);
      const outBytes = await surface.toBytes(outFormat, 92);

      outputs.push({
        name: `cropped_${file.name}`,
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: { width: sw, height: sh, crop: { sx, sy, sw, sh } },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Cropped ${outputs.length} image(s) using mode "${ratioMode}".`,
      metadata: { count: outputs.length, aspectRatio: ratioMode },
    };
  },
};

export const imageRotateFlipTool: ToolDefinition<{
  angle?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}> = {
  id: 'image.rotate_flip',
  mcpName: 'tenggoo_image_rotate_flip',
  category: 'image',
  name: 'Rotate & Flip Images',
  description: 'Rotate images by 0/90/180/270 degrees and optionally flip horizontally or vertically.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      angle: {
        type: 'integer',
        description: 'Clockwise rotation in degrees (0, 90, 180, 270).',
        enum: [0, 90, 180, 270],
        default: 90,
      },
      flipHorizontal: {
        type: 'boolean',
        description: 'Mirror image horizontally.',
        default: false,
      },
      flipVertical: {
        type: 'boolean',
        description: 'Mirror image vertically.',
        default: false,
      },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.rotate_flip');
    const angle = Number(params.angle ?? 90);
    if (![0, 90, 180, 270].includes(angle)) {
      throw new Error('angle must be 0, 90, 180, or 270.');
    }
    const flipH = Boolean(params.flipHorizontal ?? false);
    const flipV = Boolean(params.flipVertical ?? false);

    const outputs: VirtualFile[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Transforming ${file.name}`);
      const source = await loadImageSource(file.bytes, file.mimeType);
      const outFormat = mimeTypeToCanvasFormat(file.mimeType, file.name);

      const swapDims = angle === 90 || angle === 270;
      const outW = swapDims ? source.height : source.width;
      const outH = swapDims ? source.width : source.height;

      const surface = await createCanvasSurface(outW, outH);
      if (outFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, outW, outH);
      }

      surface.ctx.save();
      surface.ctx.translate(outW / 2, outH / 2);
      surface.ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      surface.ctx.rotate((angle * Math.PI) / 180);
      surface.ctx.drawImage(
        source.raw,
        -source.width / 2,
        -source.height / 2,
        source.width,
        source.height,
      );
      surface.ctx.restore();

      const outBytes = await surface.toBytes(outFormat, 92);
      outputs.push({
        name: file.name,
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: { width: outW, height: outH, angle, flipH, flipV },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Transformed ${outputs.length} image(s) (rotate=${angle}°, flipH=${flipH}, flipV=${flipV}).`,
    };
  },
};

export const imageWatermarkTool: ToolDefinition<{
  text?: string;
  position?:
    | 'center-diagonal'
    | 'center'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-right'
    | 'top-left'
    | 'tiled';
  fontSize?: number;
  opacity?: number;
  color?: string;
}> = {
  id: 'image.watermark',
  mcpName: 'tenggoo_image_watermark',
  category: 'image',
  name: 'Watermark Images',
  description: 'Overlay customizable text watermarks onto one or more images.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Watermark text to stamp on the image(s).',
        default: 'CONFIDENTIAL',
      },
      position: {
        type: 'string',
        description: 'Placement position.',
        enum: [
          'center-diagonal',
          'center',
          'bottom-right',
          'bottom-left',
          'top-right',
          'top-left',
          'tiled',
        ],
        default: 'bottom-right',
      },
      fontSize: {
        type: 'number',
        description: 'Font size in pixels (0 or omitted auto-scales to image size).',
        default: 0,
      },
      opacity: {
        type: 'number',
        description: 'Text opacity from 0.05 to 1.0 (default: 0.45).',
        default: 0.45,
        minimum: 0.05,
        maximum: 1,
      },
      color: {
        type: 'string',
        description: 'Text color in hex (default: "#ffffff").',
        default: '#ffffff',
      },
    },
    required: ['text'],
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.watermark');
    const text = (params.text ?? 'CONFIDENTIAL').trim();
    if (!text) {
      throw new Error('Watermark text cannot be empty.');
    }
    const position = params.position ?? 'bottom-right';
    const opacity = Math.max(0.05, Math.min(1, Number(params.opacity ?? 0.45)));
    const color = params.color ?? '#ffffff';
    const outputs: VirtualFile[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Watermarking ${file.name}`);
      const source = await loadImageSource(file.bytes, file.mimeType);
      const outFormat = mimeTypeToCanvasFormat(file.mimeType, file.name);
      const surface = await createCanvasSurface(source.width, source.height);

      if (outFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, source.width, source.height);
      }
      surface.ctx.drawImage(source.raw, 0, 0, source.width, source.height);

      const resolvedSize =
        params.fontSize && Number(params.fontSize) > 0
          ? Number(params.fontSize)
          : Math.max(16, Math.round(Math.min(source.width, source.height) * 0.06));
      const pad = Math.max(16, Math.round(resolvedSize * 0.7));

      surface.ctx.save();
      surface.ctx.globalAlpha = opacity;
      surface.ctx.fillStyle = color;
      surface.ctx.font = `bold ${resolvedSize}px sans-serif`;

      if (position === 'center-diagonal') {
        surface.ctx.translate(source.width / 2, source.height / 2);
        surface.ctx.rotate(-Math.PI / 4);
        surface.ctx.textAlign = 'center';
        surface.ctx.textBaseline = 'middle';
        surface.ctx.fillText(text, 0, 0);
      } else if (position === 'center') {
        surface.ctx.textAlign = 'center';
        surface.ctx.textBaseline = 'middle';
        surface.ctx.fillText(text, source.width / 2, source.height / 2);
      } else if (position === 'tiled') {
        surface.ctx.textAlign = 'center';
        surface.ctx.textBaseline = 'middle';
        const cols = 3;
        const rows = 3;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const cx = ((c + 0.5) * source.width) / cols;
            const cy = ((r + 0.5) * source.height) / rows;
            surface.ctx.save();
            surface.ctx.translate(cx, cy);
            surface.ctx.rotate(-Math.PI / 6);
            surface.ctx.fillText(text, 0, 0);
            surface.ctx.restore();
          }
        }
      } else {
        const isRight = position.endsWith('right');
        const isBottom = position.startsWith('bottom');
        surface.ctx.textAlign = isRight ? 'right' : 'left';
        surface.ctx.textBaseline = isBottom ? 'bottom' : 'top';
        surface.ctx.fillText(
          text,
          isRight ? source.width - pad : pad,
          isBottom ? source.height - pad : pad,
        );
      }

      surface.ctx.restore();
      const outBytes = await surface.toBytes(outFormat, 92);

      outputs.push({
        name: `wm_${file.name}`,
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: { width: source.width, height: source.height },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Applied "${text}" watermark (${position}) to ${outputs.length} image(s).`,
    };
  },
};

export const imageStripMetadataTool: ToolDefinition<Record<string, never>> = {
  id: 'image.strip_metadata',
  mcpName: 'tenggoo_image_strip_metadata',
  category: 'image',
  name: 'Strip EXIF & Privacy Metadata',
  description: 'Remove all EXIF, GPS location, camera, and embedded metadata from images.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  producesMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {},
  },
  async execute(inputs, _params, context) {
    const images = ensureImageInputs(inputs, 'image.strip_metadata');
    const outputs: VirtualFile[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      context?.onProgress?.(Math.round(((i + 1) / images.length) * 90), `Cleaning ${file.name}`);
      const source = await loadImageSource(file.bytes, file.mimeType);
      const outFormat = mimeTypeToCanvasFormat(file.mimeType, file.name);
      const surface = await createCanvasSurface(source.width, source.height);

      if (outFormat === 'jpeg') {
        surface.ctx.fillStyle = '#ffffff';
        surface.ctx.fillRect(0, 0, source.width, source.height);
      }
      surface.ctx.drawImage(source.raw, 0, 0, source.width, source.height);
      const outBytes = await surface.toBytes(outFormat, 95);

      outputs.push({
        name: `clean_${file.name}`,
        mimeType: formatToMimeType(outFormat),
        bytes: outBytes,
        metadata: { width: source.width, height: source.height, metadataStripped: true },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Stripped EXIF/GPS metadata from ${outputs.length} image(s).`,
    };
  },
};

export const imageInfoTool: ToolDefinition<Record<string, never>> = {
  id: 'image.info',
  mcpName: 'tenggoo_image_info',
  category: 'image',
  name: 'Inspect Image Info',
  description: 'Inspect dimensions, aspect ratio, format, and byte size of one or more images as JSON.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['application/json'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {},
  },
  async execute(inputs, _params, context) {
    const images = ensureImageInputs(inputs, 'image.info');
    const infoList: Record<string, unknown>[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const source = await loadImageSource(file.bytes, file.mimeType);
      infoList.push({
        fileName: file.name,
        mimeType: file.mimeType,
        width: source.width,
        height: source.height,
        aspectRatio: Number((source.width / source.height).toFixed(3)),
        sizeBytes: file.bytes.byteLength,
        sizeFormatted: formatByteSize(file.bytes.byteLength),
      });
    }

    const base = getBaseName(images[0].name);
    const jsonText = JSON.stringify({ count: infoList.length, images: infoList }, null, 2);
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: images.length === 1 ? `${base}_info.json` : 'images_info.json',
          mimeType: 'application/json',
          bytes: new TextEncoder().encode(jsonText),
        },
      ],
      summary: `Inspected ${infoList.length} image(s).`,
      metadata: { count: infoList.length, images: infoList },
    };
  },
};

export const imageDiffTool: ToolDefinition<{
  threshold?: number;
}> = {
  id: 'image.diff',
  mcpName: 'tenggoo_image_diff',
  category: 'image',
  name: 'Visual Image Diff Heatmap',
  description:
    'Compare two images pixel-by-pixel and output a visual diff heatmap highlighting changed areas in red.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/png'],
  minInputs: 2,
  maxInputs: 2,
  parameterSchema: {
    type: 'object',
    properties: {
      threshold: {
        type: 'integer',
        description: 'Per-channel pixel difference threshold 1..255 (default: 25).',
        default: 25,
        minimum: 1,
        maximum: 255,
      },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.diff');
    if (images.length < 2) {
      throw new Error('image.diff requires 2 images to compare.');
    }

    const threshold = Math.max(1, Math.min(255, Number(params.threshold ?? 25)));
    const srcA = await loadImageSource(images[0].bytes, images[0].mimeType);
    const srcB = await loadImageSource(images[1].bytes, images[1].mimeType);

    const w = Math.max(srcA.width, srcB.width);
    const h = Math.max(srcA.height, srcB.height);

    const surfA = await createCanvasSurface(w, h);
    surfA.ctx.fillStyle = '#ffffff';
    surfA.ctx.fillRect(0, 0, w, h);
    surfA.ctx.drawImage(srcA.raw, 0, 0, srcA.width, srcA.height);

    const surfB = await createCanvasSurface(w, h);
    surfB.ctx.fillStyle = '#ffffff';
    surfB.ctx.fillRect(0, 0, w, h);
    surfB.ctx.drawImage(srcB.raw, 0, 0, srcB.width, srcB.height);

    const dataA = surfA.ctx.getImageData(0, 0, w, h);
    const dataB = surfB.ctx.getImageData(0, 0, w, h);
    const outSurf = await createCanvasSurface(w, h);
    const outData = outSurf.ctx.getImageData(0, 0, w, h);

    const totalPixels = w * h;
    let diffPixels = 0;

    for (let i = 0; i < dataA.data.length; i += 4) {
      const dr = Math.abs(dataA.data[i] - dataB.data[i]);
      const dg = Math.abs(dataA.data[i + 1] - dataB.data[i + 1]);
      const db = Math.abs(dataA.data[i + 2] - dataB.data[i + 2]);
      const maxDelta = Math.max(dr, dg, db);

      if (maxDelta > threshold) {
        diffPixels++;
        outData.data[i] = 239;
        outData.data[i + 1] = 68;
        outData.data[i + 2] = 68;
        outData.data[i + 3] = 255;
      } else {
        const lum = Math.round(
          dataB.data[i] * 0.299 + dataB.data[i + 1] * 0.587 + dataB.data[i + 2] * 0.114,
        );
        const muted = Math.round(255 - (255 - lum) * 0.35);
        outData.data[i] = muted;
        outData.data[i + 1] = muted;
        outData.data[i + 2] = muted;
        outData.data[i + 3] = 255;
      }
    }

    outSurf.ctx.putImageData(outData, 0, 0);
    const outBytes = await outSurf.toBytes('png');
    const diffPercent = Number(((diffPixels / totalPixels) * 100).toFixed(2));
    context?.onProgress?.(100, 'Complete');

    return {
      files: [
        {
          name: 'diff_heatmap.png',
          mimeType: 'image/png',
          bytes: outBytes,
          metadata: { width: w, height: h },
        },
      ],
      summary: `Compared ${images[0].name} vs ${images[1].name}: ${diffPixels} changed pixel(s) (${diffPercent}%).`,
      metadata: {
        width: w,
        height: h,
        totalPixels,
        diffPixels,
        diffPercent,
        threshold,
      },
    };
  },
};

export const imageScanEnhanceTool: ToolDefinition<{
  mode?: 'whiten-bg' | 'grayscale-contrast' | 'bw-threshold';
  contrast?: number;
  threshold?: number;
}> = {
  id: 'image.scan_enhance',
  mcpName: 'tenggoo_image_scan_enhance',
  category: 'image',
  name: 'Document Scan Enhancer',
  description:
    'Clean up camera photos of paper documents by whitening shadows and boosting text contrast.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/png', 'image/jpeg'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        description: 'Enhancement mode ("whiten-bg", "grayscale-contrast", or "bw-threshold").',
        enum: ['whiten-bg', 'grayscale-contrast', 'bw-threshold'],
        default: 'whiten-bg',
      },
      contrast: {
        type: 'integer',
        description: 'Contrast boost 0..100 (default: 45).',
        default: 45,
        minimum: 0,
        maximum: 100,
      },
      threshold: {
        type: 'integer',
        description: 'Luminance cutoff 50..240 for bw-threshold / background whitening (default: 175).',
        default: 175,
        minimum: 50,
        maximum: 240,
      },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.scan_enhance');
    const mode = params.mode ?? 'whiten-bg';
    const contrast = Math.max(0, Math.min(100, Number(params.contrast ?? 45)));
    const threshold = Math.max(50, Math.min(240, Number(params.threshold ?? 175)));
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const outputs: VirtualFile[] = [];

    for (let idx = 0; idx < images.length; idx++) {
      const file = images[idx];
      context?.onProgress?.(Math.round(((idx + 1) / images.length) * 90), `Enhancing ${file.name}`);

      const source = await loadImageSource(file.bytes, file.mimeType);
      const surface = await createCanvasSurface(source.width, source.height);
      surface.ctx.drawImage(source.raw, 0, 0, source.width, source.height);
      const imgData = surface.ctx.getImageData(0, 0, source.width, source.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

        if (mode === 'bw-threshold') {
          const v = lum >= threshold ? 255 : 0;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        } else if (mode === 'grayscale-contrast') {
          const stretched = Math.max(0, Math.min(255, Math.round(factor * (lum - 128) + 128)));
          d[i] = stretched;
          d[i + 1] = stretched;
          d[i + 2] = stretched;
        } else {
          // whiten-bg: push bright paper shadows to pure white, sharpen darker text/stamps
          if (lum >= threshold) {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
          } else {
            d[i] = Math.max(0, Math.min(255, Math.round(factor * (d[i] - 128) + 115)));
            d[i + 1] = Math.max(0, Math.min(255, Math.round(factor * (d[i + 1] - 128) + 115)));
            d[i + 2] = Math.max(0, Math.min(255, Math.round(factor * (d[i + 2] - 128) + 115)));
          }
        }
      }

      surface.ctx.putImageData(imgData, 0, 0);
      const outBytes = await surface.toBytes('png');
      outputs.push({
        name: `scanned_${replaceExtension(file.name, 'png')}`,
        mimeType: 'image/png',
        bytes: outBytes,
        metadata: { width: source.width, height: source.height, scanMode: mode },
      });
    }

    context?.onProgress?.(100, 'Complete');
    return {
      files: outputs,
      summary: `Enhanced ${outputs.length} scanned image(s) using "${mode}".`,
    };
  },
};

export const imageGridSheetTool: ToolDefinition<{
  columns?: number;
  rows?: number;
  pageSize?: 'A4' | 'Letter';
  padding?: number;
  background?: string;
  outputName?: string;
}> = {
  id: 'image.grid_sheet',
  mcpName: 'tenggoo_image_grid_sheet',
  category: 'image',
  name: 'Image Grid / ID Card Sheet',
  description:
    'Combine multiple images (e.g., ID cards/KTP or photos) into a tidy multi-cell A4/Letter grid sheet PNG.',
  acceptsMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  producesMimeTypes: ['image/png'],
  minInputs: 1,
  maxInputs: null,
  parameterSchema: {
    type: 'object',
    properties: {
      columns: { type: 'integer', description: 'Number of grid columns (default: 2).', default: 2, minimum: 1, maximum: 6 },
      rows: { type: 'integer', description: 'Number of grid rows (default: 2).', default: 2, minimum: 1, maximum: 8 },
      pageSize: {
        type: 'string',
        description: 'Sheet preset ("A4" or "Letter" at 150 DPI).',
        enum: ['A4', 'Letter'],
        default: 'A4',
      },
      padding: { type: 'integer', description: 'Outer padding & cell spacing in pixels (default: 36).', default: 36, minimum: 0 },
      background: { type: 'string', description: 'Sheet background hex color (default: "#ffffff").', default: '#ffffff' },
      outputName: { type: 'string', description: 'Output PNG filename (default: grid_sheet.png).', default: 'grid_sheet.png' },
    },
  },
  async execute(inputs, params, context) {
    const images = ensureImageInputs(inputs, 'image.grid_sheet');
    const cols = Math.max(1, Math.min(6, Number(params.columns ?? 2)));
    const rows = Math.max(1, Math.min(8, Number(params.rows ?? 2)));
    const pageSize = params.pageSize ?? 'A4';
    const padding = Math.max(0, Number(params.padding ?? 36));
    const background = params.background ?? '#ffffff';

    const sheetW = pageSize === 'A4' ? 1240 : 1275;
    const sheetH = pageSize === 'A4' ? 1754 : 1650;
    const cellW = Math.max(20, (sheetW - padding * (cols + 1)) / cols);
    const cellH = Math.max(20, (sheetH - padding * (rows + 1)) / rows);
    const perSheet = cols * rows;

    const outputs: VirtualFile[] = [];
    const baseOut = getBaseName(params.outputName?.trim() || 'grid_sheet.png');
    const totalSheets = Math.ceil(images.length / perSheet);

    for (let s = 0; s < totalSheets; s++) {
      const surface = await createCanvasSurface(sheetW, sheetH);
      surface.ctx.fillStyle = background;
      surface.ctx.fillRect(0, 0, sheetW, sheetH);
      surface.ctx.imageSmoothingEnabled = true;
      surface.ctx.imageSmoothingQuality = 'high';

      for (let slot = 0; slot < perSheet; slot++) {
        const imgIdx = s * perSheet + slot;
        if (imgIdx >= images.length) break;

        const file = images[imgIdx];
        const source = await loadImageSource(file.bytes, file.mimeType);
        const col = slot % cols;
        const row = Math.floor(slot / cols);

        const cellX = padding + col * (cellW + padding);
        const cellY = padding + row * (cellH + padding);
        const scale = Math.min(cellW / source.width, cellH / source.height);
        const drawW = source.width * scale;
        const drawH = source.height * scale;

        surface.ctx.drawImage(
          source.raw,
          cellX + (cellW - drawW) / 2,
          cellY + (cellH - drawH) / 2,
          drawW,
          drawH,
        );
      }

      const bytes = await surface.toBytes('png');
      const outName = totalSheets === 1 ? `${baseOut}.png` : `${baseOut}_${s + 1}.png`;
      outputs.push({
        name: outName,
        mimeType: 'image/png',
        bytes,
        metadata: { width: sheetW, height: sheetH, columns: cols, rows },
      });
      context?.onProgress?.(Math.round(((s + 1) / totalSheets) * 100));
    }

    return {
      files: outputs,
      summary: `Arranged ${images.length} image(s) into ${outputs.length} ${cols}x${rows} ${pageSize} sheet(s).`,
      metadata: { sheetCount: outputs.length, columns: cols, rows },
    };
  },
};

export const IMAGE_TOOLS: ToolDefinition[] = [
  imageCompressTool as ToolDefinition,
  imageConvertTool as ToolDefinition,
  imageResizeTool as ToolDefinition,
  imageCropTool as ToolDefinition,
  imageRotateFlipTool as ToolDefinition,
  imageWatermarkTool as ToolDefinition,
  imageStripMetadataTool as ToolDefinition,
  imageInfoTool as ToolDefinition,
  imageDiffTool as ToolDefinition,
  imageScanEnhanceTool as ToolDefinition,
  imageGridSheetTool as ToolDefinition,
];
