import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
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

const execFileAsync = promisify(execFile);

async function createMultiPagePdf(pagesText: string[], name = 'multi.pdf'): Promise<VirtualFile> {
  const docs: VirtualFile[] = [];
  for (let i = 0; i < pagesText.length; i++) {
    const res = await getTool('util.md_to_pdf')!.execute([], {
      markdown: pagesText[i],
      pageSize: 'A4',
      outputName: `page_${i + 1}.pdf`,
    });
    docs.push(res.files[0]);
  }
  if (docs.length === 1) {
    return { ...docs[0], name };
  }
  const merged = await getTool('pdf.merge')!.execute(docs, { outputName: name });
  return merged.files[0];
}

async function createEncryptedPdf(
  sourceBytes: Uint8Array,
  userPassword: string,
  ownerPassword = 'owner-secret',
): Promise<Uint8Array> {
  const wasmBuf = await readFile(
    resolve(process.cwd(), 'node_modules/@jspawn/ghostscript-wasm/gs.wasm'),
  );
  const wasmBytes = new Uint8Array(wasmBuf.buffer, wasmBuf.byteOffset, wasmBuf.byteLength);
  const gsSpec = '@jspawn/ghostscript-wasm/' + 'gs.js';
  const gsMod = (await import(gsSpec)) as {
    default: (options: {
      noInitialRun?: boolean;
      print?: (text: string) => void;
      printErr?: (text: string) => void;
      instantiateWasm?: (
        imports: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance) => void,
      ) => Record<string, unknown>;
    }) => Promise<{
      FS: {
        writeFile(path: string, data: Uint8Array): void;
        readFile(path: string): Uint8Array;
      };
      callMain(args?: string[]): void;
    }>;
  };
  const gs = await gsMod.default({
    noInitialRun: true,
    print: () => {},
    printErr: () => {},
    instantiateWasm(
      imports: WebAssembly.Imports,
      receiveInstance: (instance: WebAssembly.Instance) => void,
    ) {
      void WebAssembly.instantiate(wasmBytes, imports).then((res) => receiveInstance(res.instance));
      return {};
    },
  });
  gs.FS.writeFile('in.pdf', sourceBytes);
  gs.callMain([
    '-sDEVICE=pdfwrite',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    `-sOwnerPassword=${ownerPassword}`,
    `-sUserPassword=${userPassword}`,
    '-dEncryptionR=3',
    '-dKeyLength=128',
    '-sOutputFile=enc.pdf',
    'in.pdf',
  ]);
  return new Uint8Array(gs.FS.readFile('enc.pdf'));
}

test('Coverage: pdf.rotate, pdf.split modes, pdf.compress preserveText, pdf.watermark variants & pdf.page_numbers', async () => {
  const twoPagePdf = await createMultiPagePdf([
    '# Halaman Satu\n\nTeks penting halaman pertama.',
    '# Halaman Dua\n\nTeks penting halaman kedua.',
  ]);

  // pdf.rotate: 90 deg on page 1 only, then 180 deg on all pages, then 270 deg on page 2
  const rot1 = await getTool('pdf.rotate')!.execute([twoPagePdf], { angle: 90, pageRange: '1' });
  const rot1Doc = await PDFDocument.load(rot1.files[0].bytes);
  assert.equal(rot1Doc.getPage(0).getRotation().angle, 90);
  assert.equal(rot1Doc.getPage(1).getRotation().angle, 0);

  const rot2 = await getTool('pdf.rotate')!.execute(rot1.files, { angle: 180 });
  const rot2Doc = await PDFDocument.load(rot2.files[0].bytes);
  assert.equal(rot2Doc.getPage(0).getRotation().angle, 270);
  assert.equal(rot2Doc.getPage(1).getRotation().angle, 180);

  const rot3 = await getTool('pdf.rotate')!.execute(rot2.files, { angle: 270, pageRange: '2' });
  const rot3Doc = await PDFDocument.load(rot3.files[0].bytes);
  assert.equal(rot3Doc.getPage(1).getRotation().angle, 90);

  // pdf.split: each_page and separate_ranges
  const splitEach = await getTool('pdf.split')!.execute([twoPagePdf], { mode: 'each_page' });
  assert.equal(splitEach.files.length, 2);
  assert.equal(splitEach.files[0].name, 'multi_page_1.pdf');
  assert.equal(splitEach.files[1].name, 'multi_page_2.pdf');

  const splitSep = await getTool('pdf.split')!.execute([twoPagePdf], {
    mode: 'separate_ranges',
    ranges: '1; 2',
  });
  assert.equal(splitSep.files.length, 2);

  // pdf.compress with preserveText: true must keep extractable text intact
  const compressedLossless = await getTool('pdf.compress')!.execute([twoPagePdf], {
    quality: 'medium',
    preserveText: true,
  });
  const extractedLossless = await getTool('pdf.extract_text')!.execute(compressedLossless.files, {
    format: 'txt',
  });
  const extractedText = String(extractedLossless.metadata?.text ?? '');
  assert.match(extractedText, /Halaman Satu/);
  assert.match(extractedText, /Halaman Dua/);

  // pdf.watermark variants: tiled, top, bottom, center
  for (const position of ['tiled', 'top', 'bottom', 'center'] as const) {
    const wm = await getTool('pdf.watermark')!.execute([twoPagePdf], {
      text: `WM-${position.toUpperCase()}`,
      position,
      opacity: 0.3,
    });
    assert.equal(wm.metadata?.position, position);
    const wmText = await getTool('pdf.extract_text')!.execute(wm.files, { format: 'txt' });
    assert.match(String(wmText.metadata?.text ?? ''), new RegExp(`WM-${position.toUpperCase()}`));
  }

  // pdf.page_numbers with skipFirstPage + startNumber + format n-of-total
  const numbered = await getTool('pdf.page_numbers')!.execute([twoPagePdf], {
    format: 'n-of-total',
    position: 'top-right',
    startNumber: 2,
    skipFirstPage: true,
  });
  assert.equal(numbered.metadata?.pagesNumbered, 1);
  const numText = await getTool('pdf.extract_text')!.execute(numbered.files, { format: 'json' });
  const numParsed = JSON.parse(new TextDecoder('utf-8').decode(numText.files[0].bytes)) as {
    pages: { pageNumber: number; text: string }[];
  };
  assert.ok(!numParsed.pages[0].text.includes('2 / 1'));
  assert.match(numParsed.pages[1].text, /2 \/ 1/);
});

test('Coverage: pdf.from_images, pdf.to_images, pdf.unlock & pdf.metadata', async () => {
  const imgA = await createSampleImage(300, 200, 'a.png', '#16a34a');
  const imgB = await createSampleImage(200, 300, 'b.png', '#9333ea');

  // pdf.from_images: fit, A4 auto, Letter
  const pdfFit = await getTool('pdf.from_images')!.execute([imgA, imgB], {
    pageSize: 'fit',
    outputName: 'fit_images',
  });
  assert.equal(pdfFit.files[0].name, 'fit_images.pdf');
  const fitDoc = await PDFDocument.load(pdfFit.files[0].bytes);
  assert.equal(fitDoc.getPageCount(), 2);
  assert.equal(Math.round(fitDoc.getPage(0).getSize().width), 300);
  assert.equal(Math.round(fitDoc.getPage(1).getSize().height), 300);

  const pdfA4 = await getTool('pdf.from_images')!.execute([imgA, imgB], {
    pageSize: 'A4',
    orientation: 'auto',
    margin: 20,
  });
  const a4Doc = await PDFDocument.load(pdfA4.files[0].bytes);
  assert.ok(a4Doc.getPage(0).getSize().width > a4Doc.getPage(0).getSize().height);
  assert.ok(a4Doc.getPage(1).getSize().height > a4Doc.getPage(1).getSize().width);

  const pdfLetter = await getTool('pdf.from_images')!.execute([imgA], {
    pageSize: 'Letter',
    orientation: 'portrait',
  });
  const letterDoc = await PDFDocument.load(pdfLetter.files[0].bytes);
  assert.equal(Math.round(letterDoc.getPage(0).getSize().width), 612);

  // pdf.to_images: png, jpeg, webp
  const sourcePdf = await createMultiPagePdf(['# Render PNG/JPEG/WebP', '# Second Page']);

  const pngPages = await getTool('pdf.to_images')!.execute([sourcePdf], {
    format: 'png',
    scale: 1,
    pageRange: '1',
  });
  assert.equal(pngPages.files.length, 1);
  assert.equal(pngPages.files[0].mimeType, 'image/png');
  assert.equal(pngPages.files[0].bytes[0], 0x89);
  assert.equal(pngPages.files[0].bytes[1], 0x50);

  const jpgPages = await getTool('pdf.to_images')!.execute([sourcePdf], {
    format: 'jpeg',
    scale: 1,
    quality: 85,
    pageRange: '1',
  });
  assert.equal(jpgPages.files[0].mimeType, 'image/jpeg');
  assert.equal(jpgPages.files[0].bytes[0], 0xff);
  assert.equal(jpgPages.files[0].bytes[1], 0xd8);

  const webpPages = await getTool('pdf.to_images')!.execute([sourcePdf], {
    format: 'webp',
    scale: 1,
    quality: 85,
    pageRange: '1',
  });
  assert.equal(webpPages.files[0].mimeType, 'image/webp');
  assert.equal(new TextDecoder().decode(webpPages.files[0].bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(webpPages.files[0].bytes.slice(8, 12)), 'WEBP');

  // pdf.unlock: encrypted PDF (wrong password, empty password, correct password) + corrupt PDF error
  const encryptedBytes = await createEncryptedPdf(sourcePdf.bytes, 'tenggoo-secret-123');
  const encryptedFile: VirtualFile = {
    name: 'encrypted.pdf',
    mimeType: 'application/pdf',
    bytes: encryptedBytes,
  };

  await assert.rejects(() => PDFDocument.load(encryptedBytes));

  await assert.rejects(
    () => getTool('pdf.unlock')!.execute([encryptedFile], { password: 'wrong-password' }),
    /Incorrect password for encrypted PDF/i,
  );

  await assert.rejects(
    () => getTool('pdf.unlock')!.execute([encryptedFile], { password: '' }),
    /Incorrect password for encrypted PDF/i,
  );

  const unlocked = await getTool('pdf.unlock')!.execute([encryptedFile], {
    password: 'tenggoo-secret-123',
    scale: 1,
  });
  assert.equal(unlocked.files[0].name, 'encrypted_unlocked.pdf');
  assert.equal(unlocked.metadata?.pageCount, 2);
  const unlockedDoc = await PDFDocument.load(unlocked.files[0].bytes);
  assert.equal(unlockedDoc.getPageCount(), 2);

  await assert.rejects(
    () =>
      getTool('pdf.unlock')!.execute(
        [{ name: 'corrupt.pdf', mimeType: 'application/pdf', bytes: new Uint8Array([1, 2, 3, 4]) }],
        { password: 'secret' },
      ),
    (err: unknown) => err instanceof Error && err.message.length > 0,
  );

  // pdf.metadata: set -> inspect -> clear -> inspect
  const metaSet = await getTool('pdf.metadata')!.execute([sourcePdf], {
    action: 'set',
    title: 'Dokumen Uji Tenggoo',
    author: 'Tim QA',
    subject: 'Automated Test',
    keywords: 'pdf, qa, tenggoo',
    creator: 'Tenggoo Test Suite',
  });
  const metaInspect1 = await getTool('pdf.metadata')!.execute(metaSet.files, { action: 'inspect' });
  assert.equal(metaInspect1.metadata?.title, 'Dokumen Uji Tenggoo');
  assert.equal(metaInspect1.metadata?.author, 'Tim QA');
  assert.equal(metaInspect1.metadata?.subject, 'Automated Test');
  assert.match(String(metaInspect1.metadata?.keywords ?? ''), /tenggoo/);

  const metaCleared = await getTool('pdf.metadata')!.execute(metaSet.files, { action: 'clear' });
  const metaInspect2 = await getTool('pdf.metadata')!.execute(metaCleared.files, { action: 'inspect' });
  assert.ok(!metaInspect2.metadata?.title, 'Title should be cleared');
  assert.ok(!metaInspect2.metadata?.author, 'Author should be cleared');
  assert.ok(!metaInspect2.metadata?.subject, 'Subject should be cleared');
});

test('Coverage: image.convert formats, util.hash_checksum algorithms, util.table_to_pdf JSON, & pipeline errors', async () => {
  const sample = await createSampleImage(120, 90, 'convert_src.png');

  for (const targetFormat of ['png', 'jpeg', 'webp', 'ico'] as const) {
    const conv = await getTool('image.convert')!.execute([sample], { targetFormat, quality: 88 });
    assert.equal(conv.files.length, 1);
    assert.ok(conv.files[0].bytes.byteLength > 0);
  }

  // util.hash_checksum: SHA-1, SHA-256, SHA-512
  const expectedLen: Record<'SHA-1' | 'SHA-256' | 'SHA-512', number> = {
    'SHA-1': 40,
    'SHA-256': 64,
    'SHA-512': 128,
  };
  for (const algorithm of ['SHA-1', 'SHA-256', 'SHA-512'] as const) {
    const hashOut = await getTool('util.hash_checksum')!.execute([sample], { algorithm });
    const list = hashOut.metadata?.checksums as { digestHex: string }[];
    assert.equal(list[0].digestHex.length, expectedLen[algorithm]);
    assert.match(list[0].digestHex, /^[0-9a-f]+$/);
  }

  // util.table_to_pdf with JSON array & landscape orientation
  const jsonRows = JSON.stringify([
    { Layanan: 'Merge PDF', Status: 'OK', WaktuMs: 12 },
    { Layanan: 'Redact PII', Status: 'OK', WaktuMs: 45 },
  ]);
  const jsonPdf = await getTool('util.table_to_pdf')!.execute([], {
    data: jsonRows,
    title: 'QA Matrix',
    orientation: 'landscape',
    outputName: 'qa_matrix.pdf',
  });
  assert.equal(jsonPdf.files[0].name, 'qa_matrix.pdf');
  assert.equal(jsonPdf.metadata?.rowCount, 2);
  const jsonPdfDoc = await PDFDocument.load(jsonPdf.files[0].bytes);
  const pSize = jsonPdfDoc.getPage(0).getSize();
  assert.ok(pSize.width > pSize.height, 'Landscape page should be wider than tall');

  // Pipeline error handling
  await assert.rejects(() => runPipeline([], []), /at least one step/i);
  await assert.rejects(
    () => runPipeline([], [{ tool: 'nonexistent.tool', params: {} }]),
    /Unknown tool/i,
  );
  await assert.rejects(
    () => runPipeline([], [{ tool: 'pdf.merge', params: {} }]),
    /requires at least 2 input/i,
  );
});

test('Integration: CLI (bin/tenggoo.mjs) list, describe, run, pipeline & error handling', async () => {
  const cliBin = resolve(process.cwd(), 'bin/tenggoo.mjs');
  const tmpDir = await mkdtemp(join(tmpdir(), 'tenggoo-cli-test-'));

  try {
    // 1. list --json
    const listAll = await execFileAsync(process.execPath, [cliBin, 'list', '--json']);
    const listAllJson = JSON.parse(listAll.stdout) as { count: number; tools: { id: string }[] };
    assert.equal(listAllJson.count, 38);
    assert.equal(listAllJson.tools.length, 38);

    // 2. list --category pdf --json
    const listPdf = await execFileAsync(process.execPath, [
      cliBin,
      'list',
      '--category',
      'pdf',
      '--json',
    ]);
    const listPdfJson = JSON.parse(listPdf.stdout) as { count: number };
    assert.equal(listPdfJson.count, 21);

    // 3. describe pdf.redact_text --json
    const descRes = await execFileAsync(process.execPath, [
      cliBin,
      'describe',
      'pdf.redact_text',
      '--json',
    ]);
    const descJson = JSON.parse(descRes.stdout) as { id: string; mcpName: string };
    assert.equal(descJson.id, 'pdf.redact_text');
    assert.equal(descJson.mcpName, 'tenggoo_pdf_redact_text');

    // 4. run util.qr_generate
    const qrOut = join(tmpDir, 'qr.png');
    const qrRes = await execFileAsync(process.execPath, [
      cliBin,
      'run',
      'util.qr_generate',
      '--text',
      'https://tenggoo.my.id',
      '-o',
      qrOut,
      '--json',
    ]);
    const qrJson = JSON.parse(qrRes.stdout) as { ok: boolean; outputs: { path: string }[] };
    assert.equal(qrJson.ok, true);
    const qrStat = await stat(qrOut);
    assert.ok(qrStat.size > 100);

    // 5. run util.md_to_pdf then inspection-only pdf.extract_text
    const mdPdfOut = join(tmpDir, 'cli.pdf');
    await execFileAsync(process.execPath, [
      cliBin,
      'run',
      'util.md_to_pdf',
      '--markdown',
      '# CLI Test Heading',
      '-o',
      mdPdfOut,
      '--json',
    ]);
    const extractRes = await execFileAsync(process.execPath, [
      cliBin,
      'run',
      'pdf.extract_text',
      '-i',
      mdPdfOut,
      '--json',
    ]);
    const extractJson = JSON.parse(extractRes.stdout) as {
      ok: boolean;
      metadata: { text: string };
    };
    assert.equal(extractJson.ok, true);
    assert.match(extractJson.metadata.text, /CLI Test Heading/);

    // 6. pipeline
    const pipeOut = join(tmpDir, 'pipe.pdf');
    const pipeRes = await execFileAsync(process.execPath, [
      cliBin,
      'pipeline',
      '--step',
      'util.md_to_pdf:markdown=# Pipe Heading',
      '--step',
      'pdf.watermark:text=VERIFIED',
      '-o',
      pipeOut,
      '--json',
    ]);
    const pipeJson = JSON.parse(pipeRes.stdout) as { ok: boolean; steps: unknown[] };
    assert.equal(pipeJson.ok, true);
    assert.equal(pipeJson.steps.length, 2);
    const pipeBytes = await readFile(pipeOut);
    assert.ok(pipeBytes.byteLength > 100);

    // 7. error handling on unknown tool
    let unknownFailed = false;
    try {
      await execFileAsync(process.execPath, [cliBin, 'run', 'unknown.tool', '--json']);
    } catch (err: unknown) {
      unknownFailed = true;
      const execErr = err as { code?: number; stdout?: string };
      assert.equal(execErr.code, 1);
      const errJson = JSON.parse(execErr.stdout ?? '{}') as { ok: boolean; error: string };
      assert.equal(errJson.ok, false);
      assert.match(errJson.error, /Unknown tool/i);
    }
    assert.equal(unknownFailed, true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('Integration: MCP Server (bin/tenggoo-mcp.mjs) JSON-RPC 2.0 protocol, 39 tools & pipeline execution', async () => {
  const mcpBin = resolve(process.cwd(), 'bin/tenggoo-mcp.mjs');
  const tmpDir = await mkdtemp(join(tmpdir(), 'tenggoo-mcp-test-'));

  try {
    const qrOut = join(tmpDir, 'mcp_qr.png');
    const pipeOut = join(tmpDir, 'mcp_pipe.pdf');

    const requests = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'tenggoo_util_qr_generate',
          arguments: { text: 'https://tenggoo.my.id', output_path: qrOut },
        },
      },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'tenggoo_pipeline_run',
          arguments: {
            output_path: pipeOut,
            steps: [
              { tool: 'util.md_to_pdf', params: { markdown: '# MCP Pipe Test' } },
              { tool: 'pdf.page_numbers', params: { format: 'n-only' } },
            ],
          },
        },
      },
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'tenggoo_unknown', arguments: {} },
      },
      { jsonrpc: '2.0', id: 7, method: 'unknown/method' },
    ];

    const responses = await new Promise<Record<string, unknown>[]>((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [mcpBin], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.setEncoding('utf-8');
      child.stdout.on('data', (chunk: string) => {
        stdoutBuf += chunk;
      });
      child.stderr.setEncoding('utf-8');
      child.stderr.on('data', (chunk: string) => {
        stderrBuf += chunk;
      });
      child.on('error', rejectPromise);
      child.on('close', (code) => {
        if (code !== 0) {
          rejectPromise(new Error(`MCP exited with ${code}: ${stderrBuf}`));
          return;
        }
        const parsedLines = stdoutBuf
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>);
        resolvePromise(parsedLines);
      });

      for (const req of requests) {
        child.stdin.write(`${JSON.stringify(req)}\n`);
      }
      child.stdin.end();
    });

    assert.equal(responses.length, 7);

    const byId = new Map<number, Record<string, unknown>>();
    for (const r of responses) {
      byId.set(Number(r.id), r);
    }

    // 1. initialize
    const initRes = byId.get(1)?.result as { serverInfo?: { name: string } };
    assert.equal(initRes?.serverInfo?.name, 'tenggoo-toolkit');

    // 2. ping
    assert.deepEqual(byId.get(2)?.result, {});

    // 3. tools/list -> 39 tools
    const listRes = byId.get(3)?.result as { tools: { name: string }[] };
    assert.equal(listRes.tools.length, 39);
    assert.ok(listRes.tools.some((t) => t.name === 'tenggoo_pipeline_run'));

    // 4. tools/call single tool
    const qrCall = byId.get(4)?.result as {
      isError?: boolean;
      content: { type: string; text: string }[];
    };
    assert.ok(!qrCall.isError);
    const qrPayload = JSON.parse(qrCall.content[0].text) as { ok: boolean };
    assert.equal(qrPayload.ok, true);
    assert.ok((await stat(qrOut)).size > 100);

    // 5. tools/call pipeline
    const pipeCall = byId.get(5)?.result as {
      isError?: boolean;
      content: { type: string; text: string }[];
    };
    assert.ok(!pipeCall.isError);
    const pipePayload = JSON.parse(pipeCall.content[0].text) as { ok: boolean };
    assert.equal(pipePayload.ok, true);
    assert.ok((await stat(pipeOut)).size > 100);

    // 6. unknown tool returns isError: true
    const unknownCall = byId.get(6)?.result as { isError?: boolean };
    assert.equal(unknownCall.isError, true);

    // 7. unknown JSON-RPC method returns -32601
    const methodErr = byId.get(7)?.error as { code: number };
    assert.equal(methodErr.code, -32601);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
