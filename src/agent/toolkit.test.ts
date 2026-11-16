import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  ALL_TOOLS,
  getTool,
  listTools,
  runPipeline,
} from '../core/index.ts';
import type { VirtualFile } from '../core/types.ts';
import { createCanvasSurface } from '../core/runtime/canvasAdapter.ts';

async function createSampleImage(
  width = 400,
  height = 300,
  name = 'sample.png',
  fillHex = '#2563eb',
): Promise<VirtualFile> {
  const surface = await createCanvasSurface(width, height);
  surface.ctx.fillStyle = fillHex;
  surface.ctx.fillRect(0, 0, width, height);
  surface.ctx.fillStyle = '#ffffff';
  surface.ctx.fillRect(40, 40, Math.max(10, width - 80), Math.max(10, height - 80));
  const bytes = await surface.toBytes('png');
  return { name, mimeType: 'image/png', bytes };
}

test('Registry registers all 38 headless tools across PDF, Image, and Utility', () => {
  assert.equal(ALL_TOOLS.length, 38);
  assert.equal(listTools('pdf').length, 21);
  assert.equal(listTools('image').length, 11);
  assert.equal(listTools('utility').length, 6);
  assert.ok(getTool('pdf.redact_text'));
  assert.ok(getTool('tenggoo_pdf_form_inspect'));
  assert.ok(getTool('pdf.form_fill'));
  assert.ok(getTool('pdf.diff_text'));
  assert.ok(getTool('pdf.nup'));
  assert.ok(getTool('pdf.extract_tables'));
  assert.ok(getTool('image.diff'));
  assert.ok(getTool('image.scan_enhance'));
  assert.ok(getTool('image.grid_sheet'));
  assert.ok(getTool('util.table_to_pdf'));
});

test('Cross-domain pipeline: Markdown -> PDF -> QR Stamp -> Watermark -> Page Numbers -> Extract Text', async () => {
  const res = await runPipeline([], [
    {
      tool: 'util.md_to_pdf',
      params: {
        markdown: '# Invoice #1001\n\nTotal amount due: $250.\n\n- Verified item A\n- Verified item B',
        title: 'Invoice 1001',
        pageSize: 'A4',
        outputName: 'invoice.pdf',
      },
    },
    {
      tool: 'util.qr_generate',
      params: { text: 'https://tenggoo.my.id/inv/1001', size: 220 },
    },
    {
      tool: 'pdf.stamp_image',
      params: { position: 'bottom-right', width: 70 },
    },
    {
      tool: 'pdf.watermark',
      params: { text: 'PAID', opacity: 0.25 },
    },
    {
      tool: 'pdf.page_numbers',
      params: { position: 'bottom-center', format: 'page-of-total' },
    },
    {
      tool: 'pdf.extract_text',
      params: { format: 'json' },
    },
  ]);

  assert.equal(res.steps.length, 6);
  assert.equal(res.files.length, 1);
  assert.equal(res.files[0].mimeType, 'application/json');
  const parsed = JSON.parse(new TextDecoder('utf-8').decode(res.files[0].bytes)) as {
    totalPages: number;
    pages: { text: string }[];
  };
  assert.equal(parsed.totalPages, 1);
  assert.match(parsed.pages[0].text, /Invoice #1001/);
  assert.match(parsed.pages[0].text, /PAID/);
  assert.match(parsed.pages[0].text, /Page 1 of 1/);
});

test('P1: PDF Auto Redact Text/PII (pdf.redact_text), AcroForm Fill/Inspect, and Text Diff', async () => {
  const doc1 = await getTool('util.md_to_pdf')!.execute([], {
    markdown: '# Kontrak Kerja\n\nNIK: 3171234567890001\nEmail: budi.rahasia@example.com\nStatus: Aktif',
    outputName: 'kontrak_v1.pdf',
  });
  const doc2 = await getTool('util.md_to_pdf')!.execute([], {
    markdown: '# Kontrak Kerja\n\nNIK: 3171234567890001\nEmail: budi.rahasia@example.com\nStatus: Disetujui Final',
    outputName: 'kontrak_v2.pdf',
  });

  // Auto-redact PII (NIK & Email) and burn in
  const redacted = await getTool('pdf.redact_text')!.execute(doc1.files, {
    presetPattern: 'all_pii',
    burnIn: true,
  });
  assert.ok(Number(redacted.metadata?.redactedMatches ?? 0) >= 2);
  const extracted = await getTool('pdf.extract_text')!.execute(redacted.files, { format: 'txt' });
  const extractedText = String(extracted.metadata?.text ?? '');
  assert.ok(!extractedText.includes('3171234567890001'), 'Burned-in PII NIK must not be extractable');
  assert.ok(!extractedText.includes('budi.rahasia@example.com'), 'Burned-in email must not be extractable');

  // AcroForm create + fill + inspect
  const blankDoc = await PDFDocument.create();
  blankDoc.addPage([500, 400]);
  const blankPdf: VirtualFile = {
    name: 'form.pdf',
    mimeType: 'application/pdf',
    bytes: await blankDoc.save(),
  };

  const filled = await getTool('pdf.form_fill')!.execute([blankPdf], {
    createFields: [
      { name: 'full_name', type: 'text', page: 1, x: 50, y: 300, width: 200, height: 22 },
      { name: 'agreed', type: 'checkbox', page: 1, x: 50, y: 260, width: 16, height: 16 },
    ],
    values: { full_name: 'Siti Rahma', agreed: true },
    flatten: false,
  });

  const inspected = await getTool('pdf.form_inspect')!.execute(filled.files, {});
  const fields = inspected.metadata?.fields as { name: string; value: unknown }[];
  assert.equal(fields.length, 2);
  assert.equal(fields.find((f) => f.name === 'full_name')?.value, 'Siti Rahma');
  assert.equal(fields.find((f) => f.name === 'agreed')?.value, true);

  // PDF text diff
  const diffRes = await getTool('pdf.diff_text')!.execute([doc1.files[0], doc2.files[0]], {
    format: 'json',
  });
  assert.equal(diffRes.metadata?.pagesChanged, 1);
});

test('P2: Table to PDF, Extract Tables, PDF N-up, Image Scan Enhance, Grid Sheet, and Image Diff', async () => {
  const csvData = 'Item,Qty,Total\nLisensi Pro,2,$98\nSupport,1,$50\nTraining,3,$150';
  const tablePdf = await getTool('util.table_to_pdf')!.execute([], {
    data: csvData,
    title: 'Rekap Penjualan',
    pageSize: 'A4',
    outputName: 'sales.pdf',
  });
  assert.equal(tablePdf.files[0].mimeType, 'application/pdf');
  assert.equal(tablePdf.metadata?.rowCount, 3);

  const extractedTables = await getTool('pdf.extract_tables')!.execute(tablePdf.files, {
    format: 'csv',
  });
  const csvOut = String(extractedTables.metadata?.text ?? '');
  assert.match(csvOut, /Rekap Penjualan/);
  assert.match(csvOut, /Lisensi Pro/);

  // Create 2-page PDF and pack into 2-up single sheet
  const docA = await getTool('util.md_to_pdf')!.execute([], { markdown: '# Page 1' });
  const docB = await getTool('util.md_to_pdf')!.execute([], { markdown: '# Page 2' });
  const merged = await getTool('pdf.merge')!.execute([docA.files[0], docB.files[0]], {});
  const nup = await getTool('pdf.nup')!.execute(merged.files, { pagesPerSheet: 2 });
  assert.equal(nup.metadata?.sourcePages, 2);
  assert.equal(nup.metadata?.outputSheets, 1);

  // Image Scan Enhance, Grid Sheet, and Visual Image Diff
  const img1 = await createSampleImage(300, 200, 'img1.png', '#e2e8f0');
  const img2 = await createSampleImage(300, 200, 'img2.png', '#ef4444');

  const scanned = await getTool('image.scan_enhance')!.execute([img1], {
    mode: 'whiten-bg',
    threshold: 180,
  });
  assert.equal(scanned.files[0].mimeType, 'image/png');

  const grid = await getTool('image.grid_sheet')!.execute([img1, img2], {
    columns: 2,
    rows: 1,
    pageSize: 'A4',
  });
  assert.equal(grid.metadata?.sheetCount, 1);

  const imgDiff = await getTool('image.diff')!.execute([img1, img2], { threshold: 20 });
  assert.equal(imgDiff.files[0].name, 'diff_heatmap.png');
  assert.ok(Number(imgDiff.metadata?.diffPixels ?? 0) > 0);
});

test('PDF Merge, Split, Reorder, Rotate, Compress, Crop Margins, and Redact (burnIn)', async () => {
  const doc1 = await getTool('util.md_to_pdf')!.execute([], {
    markdown: '# Secret Alpha\n\nSensitive NIK: 1234567890',
    outputName: 'doc1.pdf',
  });
  const doc2 = await getTool('util.md_to_pdf')!.execute([], {
    markdown: '# Public Beta\n\nGeneral overview text.',
    outputName: 'doc2.pdf',
  });

  const merged = await getTool('pdf.merge')!.execute([doc1.files[0], doc2.files[0]], {
    outputName: 'combined.pdf',
  });
  assert.equal(merged.metadata?.pageCount, 2);

  const reordered = await getTool('pdf.reorder')!.execute(merged.files, {
    pageOrder: [2, 1],
    rotation: 90,
  });
  assert.equal(reordered.metadata?.pageCount, 2);

  const split = await getTool('pdf.split')!.execute(reordered.files, {
    mode: 'ranges',
    ranges: '2',
  });
  assert.equal(split.files.length, 1);

  const cropped = await getTool('pdf.crop_margins')!.execute(split.files, { margin: 20 });
  const croppedDoc = await PDFDocument.load(cropped.files[0].bytes);
  const croppedSize = croppedDoc.getPages()[0].getSize();
  assert.ok(croppedSize.width < 842);

  const compressed = await getTool('pdf.compress')!.execute(cropped.files, {
    quality: 'low',
    preserveText: false,
  });
  assert.equal(compressed.files[0].mimeType, 'application/pdf');
  assert.ok(compressed.files[0].bytes.byteLength > 0);

  const redacted = await getTool('pdf.redact')!.execute(split.files, {
    preset: 'top-banner',
    label: 'CONFIDENTIAL',
    burnIn: true,
  });
  const extractedAfterRedact = await getTool('pdf.extract_text')!.execute(redacted.files, {
    format: 'txt',
  });
  const extractedStr = String(extractedAfterRedact.metadata?.text ?? '');
  assert.ok(!extractedStr.includes('1234567890'), 'Burned-in redaction must destroy raw text layer');
});

test('Image Suite Pipeline & Utilities: ICO, Crop, Watermark, EXIF, ZIP, SHA-256', async () => {
  const sample = await createSampleImage(600, 400, 'photo.png');

  const chain = await runPipeline([sample], [
    { tool: 'image.resize', params: { width: 480, fit: 'inside' } },
    { tool: 'image.crop', params: { aspectRatio: '3:4' } },
    { tool: 'image.rotate_flip', params: { angle: 180, flipHorizontal: true } },
    { tool: 'image.watermark', params: { text: 'TENGGOO', position: 'center-diagonal' } },
    { tool: 'image.strip_metadata', params: {} },
    { tool: 'image.compress', params: { quality: 75, format: 'jpeg' } },
    { tool: 'image.info', params: {} },
  ]);

  assert.equal(chain.files.length, 1);
  assert.equal(chain.files[0].mimeType, 'application/json');

  const icoRes = await getTool('image.convert')!.execute([sample], { targetFormat: 'ico' });
  assert.equal(icoRes.files[0].mimeType, 'image/x-icon');
  assert.equal(icoRes.files[0].bytes[2], 1);

  const qr = await getTool('util.qr_generate')!.execute([], { text: 'https://tenggoo.my.id' });
  const md = await getTool('util.md_to_pdf')!.execute([], { markdown: '# Bundle Test' });

  const packed = await getTool('util.zip_pack')!.execute([qr.files[0], md.files[0]], {
    archiveName: 'test_bundle.zip',
  });
  const unpacked = await getTool('util.zip_unpack')!.execute(packed.files, {
    filterExtensions: 'pdf',
  });
  assert.equal(unpacked.files.length, 1);

  const hashRes = await getTool('util.hash_checksum')!.execute(unpacked.files, {
    algorithm: 'SHA-256',
  });
  const checksums = hashRes.metadata?.checksums as { digestHex: string }[];
  assert.match(checksums[0].digestHex, /^[0-9a-f]{64}$/);
});
