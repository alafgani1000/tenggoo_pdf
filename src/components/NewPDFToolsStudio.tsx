import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardList,
  Copy,
  Crop,
  Download,
  Eraser,
  EyeOff,
  FileSearch,
  FileText,
  ImagePlus,
  LayoutGrid,
  PenTool,
  ScanSearch,
  Table,
  Tags,
  Terminal,
  Upload,
  Workflow,
} from 'lucide-react';
import { FileDropzone } from './FileDropzone.tsx';
import { getTool } from '../core/registry.ts';
import { formatByteSize } from '../core/types.ts';
import type { VirtualFile } from '../core/types.ts';
import {
  downloadVirtualFile,
  filesToVirtualFiles,
  virtualFileToBlobUrl,
} from '../utils/virtualFileWeb.ts';

export type NewPdfToolMode =
  | 'extract-text'
  | 'pdf-metadata'
  | 'stamp-image'
  | 'redact-pdf'
  | 'crop-pdf'
  | 'redact-text'
  | 'form-pdf'
  | 'nup-pdf'
  | 'extract-tables';

interface NewPDFToolsStudioProps {
  mode: NewPdfToolMode;
  onSendToPipeline?: (files: VirtualFile[]) => void;
}

export const NewPDFToolsStudio: React.FC<NewPDFToolsStudioProps> = ({ mode, onSendToPipeline }) => {
  const [pdfFile, setPdfFile] = useState<VirtualFile | null>(null);
  const [stampImage, setStampImage] = useState<VirtualFile | null>(null);
  const [outputFiles, setOutputFiles] = useState<VirtualFile[]>([]);
  const [textPreview, setTextPreview] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Extract text options
  const [extractFormat, setExtractFormat] = useState<'markdown' | 'txt' | 'json'>('markdown');
  const [extractPages, setExtractPages] = useState('');

  // Metadata options
  const [metaAction, setMetaAction] = useState<'inspect' | 'set' | 'clear'>('inspect');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAuthor, setMetaAuthor] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');

  // Stamp & Signature Pad options
  const [stampSourceMode, setStampSourceMode] = useState<'upload' | 'signature'>('upload');
  const [stampPosition, setStampPosition] = useState<
    'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
  >('bottom-right');
  const [stampWidth, setStampWidth] = useState(110);
  const [stampMargin, setStampMargin] = useState(24);
  const [stampOpacity, setStampOpacity] = useState(1);
  const [stampPages, setStampPages] = useState('');

  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [sigInkColor, setSigInkColor] = useState('#0f172a');
  const [sigStrokeWidth, setSigStrokeWidth] = useState(3);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  // Redact options
  const [redactPreset, setRedactPreset] = useState<
    'top-banner' | 'bottom-banner' | 'center-strip' | 'custom'
  >('center-strip');
  const [redactLabel, setRedactLabel] = useState('REDACTED');
  const [redactX, setRedactX] = useState(50);
  const [redactY, setRedactY] = useState(300);
  const [redactWidth, setRedactWidth] = useState(300);
  const [redactHeight, setRedactHeight] = useState(60);
  const [redactPages, setRedactPages] = useState('');
  const [redactBurnIn, setRedactBurnIn] = useState(true);

  // Crop margins options
  const [cropUniform, setCropUniform] = useState(24);
  const [cropTop, setCropTop] = useState('');
  const [cropBottom, setCropBottom] = useState('');
  const [cropLeft, setCropLeft] = useState('');
  const [cropRight, setCropRight] = useState('');
  const [cropPages, setCropPages] = useState('');

  // Auto redact text/PII options
  const [redactTextQuery, setRedactTextQuery] = useState('');
  const [redactTextPreset, setRedactTextPreset] = useState<'none' | 'nik' | 'email' | 'phone' | 'all_pii'>('all_pii');
  const [redactTextIsRegex, setRedactTextIsRegex] = useState(false);
  const [redactTextBurnIn, setRedactTextBurnIn] = useState(true);

  // Form inspect/fill options
  const [formAction, setFormAction] = useState<'inspect' | 'fill'>('inspect');
  const [formValuesJson, setFormValuesJson] = useState('{\n  "full_name": "Budi Santoso"\n}');
  const [formFlatten, setFormFlatten] = useState(false);

  // N-up options
  const [nupPagesPerSheet, setNupPagesPerSheet] = useState<2 | 4 | 6 | 9>(2);
  const [nupPageSize, setNupPageSize] = useState<'A4' | 'Letter'>('A4');
  const [nupOrientation, setNupOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');

  // Extract tables options
  const [tableFormat, setTableFormat] = useState<'markdown' | 'csv' | 'json'>('markdown');
  const [tableRowTol, setTableRowTol] = useState(5);

  const outputPreviewUrl = useMemo(() => {
    const first = outputFiles[0];
    if (!first || first.mimeType !== 'application/pdf') return null;
    return virtualFileToBlobUrl(first);
  }, [outputFiles]);

  useEffect(() => {
    return () => {
      if (outputPreviewUrl) URL.revokeObjectURL(outputPreviewUrl);
    };
  }, [outputPreviewUrl]);

  const toolId =
    mode === 'extract-text'
      ? 'pdf.extract_text'
      : mode === 'pdf-metadata'
        ? 'pdf.metadata'
        : mode === 'stamp-image'
          ? 'pdf.stamp_image'
          : mode === 'redact-pdf'
            ? 'pdf.redact'
            : mode === 'crop-pdf'
              ? 'pdf.crop_margins'
              : mode === 'redact-text'
                ? 'pdf.redact_text'
                : mode === 'form-pdf'
                  ? formAction === 'inspect'
                    ? 'pdf.form_inspect'
                    : 'pdf.form_fill'
                  : mode === 'nup-pdf'
                    ? 'pdf.nup'
                    : 'pdf.extract_tables';

  const cliCommand = useMemo(() => {
    const pdfName = pdfFile?.name ?? 'document.pdf';
    if (mode === 'extract-text') {
      const params = JSON.stringify({
        format: extractFormat,
        ...(extractPages.trim() ? { pageRange: extractPages.trim() } : {}),
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.extract_text -i "${pdfName}" --params '${params}' --json`;
    }
    if (mode === 'pdf-metadata') {
      const params = JSON.stringify({
        action: metaAction,
        ...(metaAction === 'set'
          ? {
              ...(metaTitle ? { title: metaTitle } : {}),
              ...(metaAuthor ? { author: metaAuthor } : {}),
              ...(metaSubject ? { subject: metaSubject } : {}),
              ...(metaKeywords ? { keywords: metaKeywords } : {}),
            }
          : {}),
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.metadata -i "${pdfName}" --params '${params}' --json`;
    }
    if (mode === 'stamp-image') {
      const imgName = stampImage?.name ?? 'stamp.png';
      const params = JSON.stringify({
        position: stampPosition,
        width: stampWidth,
        margin: stampMargin,
        opacity: stampOpacity,
        ...(stampPages.trim() ? { pageRange: stampPages.trim() } : {}),
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.stamp_image -i "${pdfName}" "${imgName}" -o stamped.pdf --params '${params}' --json`;
    }
    if (mode === 'redact-pdf') {
      const params = JSON.stringify({
        preset: redactPreset,
        label: redactLabel,
        burnIn: redactBurnIn,
        ...(redactPreset === 'custom'
          ? { x: redactX, y: redactY, width: redactWidth, height: redactHeight }
          : {}),
        ...(redactPages.trim() ? { pageRange: redactPages.trim() } : {}),
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.redact -i "${pdfName}" -o redacted.pdf --params '${params}' --json`;
    }
    if (mode === 'redact-text') {
      const params = JSON.stringify({
        ...(redactTextQuery.trim() ? { query: redactTextQuery.trim() } : {}),
        presetPattern: redactTextPreset,
        isRegex: redactTextIsRegex,
        burnIn: redactTextBurnIn,
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.redact_text -i "${pdfName}" -o redacted_text.pdf --params '${params}' --json`;
    }
    if (mode === 'form-pdf') {
      if (formAction === 'inspect') {
        return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.form_inspect -i "${pdfName}" --json`;
      }
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.form_fill -i "${pdfName}" -o filled.pdf --params '${JSON.stringify({ values: formValuesJson, flatten: formFlatten })}' --json`;
    }
    if (mode === 'nup-pdf') {
      const params = JSON.stringify({
        pagesPerSheet: nupPagesPerSheet,
        pageSize: nupPageSize,
        orientation: nupOrientation,
      });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.nup -i "${pdfName}" -o nup.pdf --params '${params}' --json`;
    }
    if (mode === 'extract-tables') {
      const params = JSON.stringify({ format: tableFormat, rowTolerancePt: tableRowTol });
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.extract_tables -i "${pdfName}" --params '${params}' --json`;
    }
    const params = JSON.stringify({
      margin: cropUniform,
      ...(cropTop ? { top: Number(cropTop) } : {}),
      ...(cropBottom ? { bottom: Number(cropBottom) } : {}),
      ...(cropLeft ? { left: Number(cropLeft) } : {}),
      ...(cropRight ? { right: Number(cropRight) } : {}),
      ...(cropPages.trim() ? { pageRange: cropPages.trim() } : {}),
    });
    return `node --no-warnings --experimental-strip-types src/agent/cli.ts run pdf.crop_margins -i "${pdfName}" -o cropped.pdf --params '${params}' --json`;
  }, [
    mode,
    pdfFile,
    stampImage,
    extractFormat,
    extractPages,
    metaAction,
    metaTitle,
    metaAuthor,
    metaSubject,
    metaKeywords,
    stampPosition,
    stampWidth,
    stampMargin,
    stampOpacity,
    stampPages,
    redactPreset,
    redactLabel,
    redactBurnIn,
    redactX,
    redactY,
    redactWidth,
    redactHeight,
    redactPages,
    cropUniform,
    cropTop,
    cropBottom,
    cropLeft,
    cropRight,
    cropPages,
    redactTextQuery,
    redactTextPreset,
    redactTextIsRegex,
    redactTextBurnIn,
    formAction,
    formValuesJson,
    formFlatten,
    nupPagesPerSheet,
    nupPageSize,
    nupOrientation,
    tableFormat,
    tableRowTol,
  ]);

  const handleDropPdf = async (files: File[]) => {
    if (files.length === 0) return;
    const [vf] = await filesToVirtualFiles([files[0]]);
    setPdfFile(vf);
    setOutputFiles([]);
    setTextPreview('');
    setSummary('');
    setError(null);
  };

  const handleDropStamp = async (files: File[]) => {
    if (files.length === 0) return;
    const [vf] = await filesToVirtualFiles([files[0]]);
    setStampImage(vf);
    setOutputFiles([]);
    setError(null);
  };

  // Signature pad pointer handlers
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handleSigPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    ctx.strokeStyle = sigInkColor;
    ctx.lineWidth = sigStrokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setHasDrawnSignature(true);
  };

  const handleSigPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = sigCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleSigPointerUp = () => {
    isDrawingRef.current = false;
  };

  const clearSignaturePad = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
    if (stampSourceMode === 'signature') {
      setStampImage(null);
    }
  };

  const applySignatureCanvas = async () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const buf = await blob.arrayBuffer();
    setStampImage({
      name: 'signature.png',
      mimeType: 'image/png',
      bytes: new Uint8Array(buf),
    });
    setError(null);
  };

  const handleRun = async () => {
    if (!pdfFile) return;
    const tool = getTool(toolId);
    if (!tool) return;
    setIsProcessing(true);
    setError(null);
    setTextPreview('');
    setOutputFiles([]);

    try {
      if (mode === 'extract-text') {
        const res = await tool.execute([pdfFile], {
          format: extractFormat,
          ...(extractPages.trim() ? { pageRange: extractPages.trim() } : {}),
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
        if (res.files[0]) {
          setTextPreview(new TextDecoder('utf-8').decode(res.files[0].bytes));
        }
      } else if (mode === 'pdf-metadata') {
        const res = await tool.execute([pdfFile], {
          action: metaAction,
          ...(metaAction === 'set'
            ? {
                ...(metaTitle ? { title: metaTitle } : {}),
                ...(metaAuthor ? { author: metaAuthor } : {}),
                ...(metaSubject ? { subject: metaSubject } : {}),
                ...(metaKeywords ? { keywords: metaKeywords } : {}),
              }
            : {}),
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
        if (metaAction === 'inspect' && res.files[0]) {
          setTextPreview(new TextDecoder('utf-8').decode(res.files[0].bytes));
        }
      } else if (mode === 'stamp-image') {
        let activeStamp = stampImage;
        if (!activeStamp && stampSourceMode === 'signature' && hasDrawnSignature && sigCanvasRef.current) {
          const blob = await new Promise<Blob | null>((resolve) =>
            sigCanvasRef.current?.toBlob(resolve, 'image/png'),
          );
          if (blob) {
            const buf = await blob.arrayBuffer();
            activeStamp = {
              name: 'signature.png',
              mimeType: 'image/png',
              bytes: new Uint8Array(buf),
            };
            setStampImage(activeStamp);
          }
        }
        if (!activeStamp) {
          throw new Error('Silakan upload gambar stempel atau gambar tanda tangan di kanvas.');
        }
        const res = await tool.execute([pdfFile, activeStamp], {
          position: stampPosition,
          width: stampWidth,
          margin: stampMargin,
          opacity: stampOpacity,
          ...(stampPages.trim() ? { pageRange: stampPages.trim() } : {}),
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
      } else if (mode === 'redact-pdf') {
        const res = await tool.execute([pdfFile], {
          preset: redactPreset,
          label: redactLabel,
          burnIn: redactBurnIn,
          ...(redactPreset === 'custom'
            ? { x: redactX, y: redactY, width: redactWidth, height: redactHeight }
            : {}),
          ...(redactPages.trim() ? { pageRange: redactPages.trim() } : {}),
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
      } else if (mode === 'redact-text') {
        const res = await tool.execute([pdfFile], {
          ...(redactTextQuery.trim() ? { query: redactTextQuery.trim() } : {}),
          presetPattern: redactTextPreset,
          isRegex: redactTextIsRegex,
          burnIn: redactTextBurnIn,
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
      } else if (mode === 'form-pdf') {
        if (formAction === 'inspect') {
          const res = await tool.execute([pdfFile], {});
          setOutputFiles(res.files);
          setSummary(res.summary);
          if (res.files[0]) {
            setTextPreview(new TextDecoder('utf-8').decode(res.files[0].bytes));
          }
        } else {
          const parsedValues = JSON.parse(formValuesJson) as Record<string, unknown>;
          const res = await tool.execute([pdfFile], {
            values: parsedValues,
            flatten: formFlatten,
          });
          setOutputFiles(res.files);
          setSummary(res.summary);
        }
      } else if (mode === 'nup-pdf') {
        const res = await tool.execute([pdfFile], {
          pagesPerSheet: nupPagesPerSheet,
          pageSize: nupPageSize,
          orientation: nupOrientation,
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
      } else if (mode === 'extract-tables') {
        const res = await tool.execute([pdfFile], {
          format: tableFormat,
          rowTolerancePt: tableRowTol,
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
        if (res.files[0]) {
          setTextPreview(new TextDecoder('utf-8').decode(res.files[0].bytes));
        }
      } else {
        const res = await tool.execute([pdfFile], {
          margin: cropUniform,
          ...(cropTop ? { top: Number(cropTop) } : {}),
          ...(cropBottom ? { bottom: Number(cropBottom) } : {}),
          ...(cropLeft ? { left: Number(cropLeft) } : {}),
          ...(cropRight ? { right: Number(cropRight) } : {}),
          ...(cropPages.trim() ? { pageRange: cropPages.trim() } : {}),
        });
        setOutputFiles(res.files);
        setSummary(res.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const headerMeta =
    mode === 'extract-text'
      ? {
          badge: 'PDF Text & AI Reader',
          title: 'Ekstrak Teks PDF (TXT / Markdown / JSON)',
          desc: 'Ekstrak seluruh teks terstruktur per halaman untuk dibaca langsung atau diproses oleh AI Agent',
          icon: FileSearch,
        }
      : mode === 'pdf-metadata'
        ? {
            badge: 'Metadata Inspector & Privacy',
            title: 'Inspeksi & Edit Metadata PDF',
            desc: 'Lihat info halaman & properti dokumen, ubah Title/Author, atau bersihkan metadata rahasia',
            icon: Tags,
          }
        : mode === 'stamp-image'
          ? {
              badge: 'Signature Pad, Logo & QR Stamping',
              title: 'Tanda Tangan & Stempel Gambar ke PDF',
              desc: 'Gambar tanda tangan langsung di layar atau upload gambar logo/QR code untuk ditempel ke halaman PDF',
              icon: ImagePlus,
            }
          : mode === 'redact-pdf'
            ? {
                badge: 'Permanent Privacy Redaction',
                title: 'Sensor / Redact Area PDF',
                desc: 'Tutup permanen area tertentu dengan blok hitam (burn-in ke piksel agar teks tidak bisa diekstrak)',
                icon: EyeOff,
              }
            : mode === 'redact-text'
              ? {
                  badge: 'Smart Regex & PII Auto-Redactor',
                  title: 'Sensor Kata / PII Otomatis (NIK, Email, HP)',
                  desc: 'Cari kata kunci atau pola PII secara otomatis, tutup kotak hitam tepat pada posisinya, dan burn-in permanen',
                  icon: ScanSearch,
                }
              : mode === 'form-pdf'
                ? {
                    badge: 'AcroForm Inspector & Filler',
                    title: 'Inspeksi & Isi Formulir PDF',
                    desc: 'Baca daftar field interaktif AcroForm ke JSON atau isi nilai form PDF secara otomatis',
                    icon: ClipboardList,
                  }
                : mode === 'nup-pdf'
                  ? {
                      badge: 'Multi-Page Sheet Print',
                      title: 'Cetak N-up PDF (2 / 4 / 6 / 9 Halaman per Lembar)',
                      desc: 'Gabungkan beberapa halaman PDF menjadi satu lembar A4/Letter untuk cetak hemat kertas atau handout',
                      icon: LayoutGrid,
                    }
                  : mode === 'extract-tables'
                    ? {
                        badge: 'Tabular Extraction',
                        title: 'Ekstrak Tabel & Baris PDF (CSV / Markdown / JSON)',
                        desc: 'Kelompokkan teks PDF berdasarkan koordinat baris & kolom menjadi tabel siap olah',
                        icon: Table,
                      }
                    : {
                        badge: 'Page Trim & Margin Cropper',
                        title: 'Potong Margin Halaman PDF',
                        desc: 'Pangkas ruang kosong di tepi halaman PDF secara seragam atau per sisi (atas, bawah, kiri, kanan)',
                        icon: Crop,
                      };

  const HeaderIcon = headerMeta.icon;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
          <HeaderIcon size={14} /> {headerMeta.badge}
        </div>
        <h2 className="text-3xl font-bold text-slate-800">{headerMeta.title}</h2>
        <p className="text-slate-500 text-sm sm:text-base">{headerMeta.desc}</p>
      </div>

      {!pdfFile ? (
        <FileDropzone onFilesDrop={handleDropPdf} multiple={false} label="Pilih atau Drop file PDF" />
      ) : (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-indigo-500 shrink-0" size={24} />
              <div>
                <p className="text-sm font-semibold text-slate-800">{pdfFile.name}</p>
                <p className="text-xs text-slate-500">{formatByteSize(pdfFile.bytes.byteLength)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPdfFile(null);
                setOutputFiles([]);
                setTextPreview('');
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Ganti PDF
            </button>
          </div>

          {mode === 'extract-text' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Format Ekstraksi</label>
                <select
                  value={extractFormat}
                  onChange={(e) => setExtractFormat(e.target.value as typeof extractFormat)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="markdown">Markdown (.md)</option>
                  <option value="txt">Plain Text (.txt)</option>
                  <option value="json">Structured JSON (.json)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Halaman Target (opsional, misal: 1-3, 5)
                </label>
                <input
                  type="text"
                  value={extractPages}
                  onChange={(e) => setExtractPages(e.target.value)}
                  placeholder="Kosongkan untuk semua halaman"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>
            </div>
          )}

          {mode === 'pdf-metadata' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'inspect', label: 'Inspeksi (JSON)' },
                  { id: 'set', label: 'Ubah Metadata' },
                  { id: 'clear', label: 'Hapus Semua Metadata' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setMetaAction(act.id as typeof metaAction)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                      metaAction === act.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
              {metaAction === 'set' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  <input type="text" placeholder="Author" value={metaAuthor} onChange={(e) => setMetaAuthor(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  <input type="text" placeholder="Subject" value={metaSubject} onChange={(e) => setMetaSubject(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  <input type="text" placeholder="Keywords (pisahkan koma)" value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                </div>
              )}
            </div>
          )}

          {mode === 'stamp-image' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStampSourceMode('upload')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    stampSourceMode === 'upload'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload size={14} /> Upload Gambar / Logo / QR
                </button>
                <button
                  type="button"
                  onClick={() => setStampSourceMode('signature')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    stampSourceMode === 'signature'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PenTool size={14} /> Gambar Tanda Tangan (Pad)
                </button>
              </div>

              {stampSourceMode === 'upload' ? (
                !stampImage ? (
                  <FileDropzone
                    onFilesDrop={handleDropStamp}
                    multiple={false}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    label="Pilih atau Drop Gambar Stempel / Tanda Tangan / QR Code"
                    helpText="PNG transparan sangat disarankan untuk tanda tangan/stempel"
                  />
                ) : (
                  <div className="flex items-center justify-between bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                    <span className="text-xs font-bold text-indigo-800">
                      Gambar Stempel: {stampImage.name} ({formatByteSize(stampImage.bytes.byteLength)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setStampImage(null)}
                      className="text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      Ganti Gambar
                    </button>
                  </div>
                )
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Warna Tinta:</span>
                      {[
                        { hex: '#0f172a', label: 'Hitam' },
                        { hex: '#1d4ed8', label: 'Biru' },
                        { hex: '#dc2626', label: 'Merah' },
                      ].map((ink) => (
                        <button
                          key={ink.hex}
                          type="button"
                          onClick={() => setSigInkColor(ink.hex)}
                          title={ink.label}
                          className={`w-6 h-6 rounded-full border-2 ${
                            sigInkColor === ink.hex ? 'border-indigo-600 scale-110' : 'border-white shadow'
                          }`}
                          style={{ backgroundColor: ink.hex }}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">Tebal:</span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={sigStrokeWidth}
                        onChange={(e) => setSigStrokeWidth(Number(e.target.value))}
                        className="w-20 accent-indigo-600"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearSignaturePad}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Eraser size={13} /> Bersihkan
                      </button>
                      <button
                        type="button"
                        onClick={applySignatureCanvas}
                        disabled={!hasDrawnSignature}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40"
                      >
                        <Check size={13} /> Gunakan Tanda Tangan Ini
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
                    <canvas
                      ref={sigCanvasRef}
                      width={520}
                      height={170}
                      onPointerDown={handleSigPointerDown}
                      onPointerMove={handleSigPointerMove}
                      onPointerUp={handleSigPointerUp}
                      onPointerLeave={handleSigPointerUp}
                      className="w-full h-44 touch-none cursor-crosshair block"
                    />
                  </div>
                  {stampImage && stampImage.name === 'signature.png' && (
                    <p className="text-xs font-semibold text-emerald-700">
                      Tanda tangan siap ditempel ({formatByteSize(stampImage.bytes.byteLength)}).
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Posisi</label>
                  <select
                    value={stampPosition}
                    onChange={(e) => setStampPosition(e.target.value as typeof stampPosition)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="bottom-right">Kanan Bawah</option>
                    <option value="bottom-left">Kiri Bawah</option>
                    <option value="top-right">Kanan Atas</option>
                    <option value="top-left">Kiri Atas</option>
                    <option value="center">Tengah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lebar (pt)</label>
                  <input
                    type="number"
                    min={10}
                    value={stampWidth}
                    onChange={(e) => setStampWidth(Number(e.target.value) || 100)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Margin (pt)</label>
                  <input
                    type="number"
                    min={0}
                    value={stampMargin}
                    onChange={(e) => setStampMargin(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Halaman (opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 1"
                    value={stampPages}
                    onChange={(e) => setStampPages(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opacity ({Math.round(stampOpacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={stampOpacity}
                    onChange={(e) => setStampOpacity(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'redact-pdf' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Area Sensor</label>
                  <select
                    value={redactPreset}
                    onChange={(e) => setRedactPreset(e.target.value as typeof redactPreset)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="center-strip">Pita Tengah Halaman</option>
                    <option value="top-banner">Header / Atas Halaman</option>
                    <option value="bottom-banner">Footer / Bawah Halaman</option>
                    <option value="custom">Koordinat Custom (pt)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Label Blok</label>
                  <input
                    type="text"
                    value={redactLabel}
                    onChange={(e) => setRedactLabel(e.target.value)}
                    placeholder="REDACTED / SENSOR"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Halaman Target</label>
                  <input
                    type="text"
                    value={redactPages}
                    onChange={(e) => setRedactPages(e.target.value)}
                    placeholder="Kosong = semua halaman"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>

              {redactPreset === 'custom' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">X (pt)</label>
                    <input type="number" value={redactX} onChange={(e) => setRedactX(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Y (pt)</label>
                    <input type="number" value={redactY} onChange={(e) => setRedactY(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Width (pt)</label>
                    <input type="number" value={redactWidth} onChange={(e) => setRedactWidth(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Height (pt)</label>
                    <input type="number" value={redactHeight} onChange={(e) => setRedactHeight(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  </div>
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redactBurnIn}
                  onChange={(e) => setRedactBurnIn(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span>Burn-in permanen ke piksel (mencegah teks di balik sensor di-copy atau diekstrak)</span>
              </label>
            </div>
          )}

          {mode === 'crop-pdf' && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Seragam (pt)</label>
                <input type="number" min={0} value={cropUniform} onChange={(e) => setCropUniform(Number(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Atas (ops)</label>
                <input type="number" min={0} placeholder="Auto" value={cropTop} onChange={(e) => setCropTop(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bawah (ops)</label>
                <input type="number" min={0} placeholder="Auto" value={cropBottom} onChange={(e) => setCropBottom(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kiri (ops)</label>
                <input type="number" min={0} placeholder="Auto" value={cropLeft} onChange={(e) => setCropLeft(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kanan (ops)</label>
                <input type="number" min={0} placeholder="Auto" value={cropRight} onChange={(e) => setCropRight(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Halaman</label>
                <input type="text" placeholder="Semua" value={cropPages} onChange={(e) => setCropPages(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
            </div>
          )}

          {mode === 'redact-text' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kata Kunci / Regex (opsional)</label>
                  <input
                    type="text"
                    value={redactTextQuery}
                    onChange={(e) => setRedactTextQuery(e.target.value)}
                    placeholder="Contoh: Rahasia atau \b\d{16}\b"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deteksi PII Otomatis</label>
                  <select
                    value={redactTextPreset}
                    onChange={(e) => setRedactTextPreset(e.target.value as typeof redactTextPreset)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="all_pii">Semua PII (NIK + Email + No. HP)</option>
                    <option value="nik">Hanya NIK (16 Digit)</option>
                    <option value="email">Hanya Alamat Email</option>
                    <option value="phone">Hanya Nomor HP Indonesia</option>
                    <option value="none">Tidak Pakai Preset (Hanya Query)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={redactTextIsRegex} onChange={(e) => setRedactTextIsRegex(e.target.checked)} className="accent-indigo-600" />
                  <span>Gunakan Query sebagai Regex</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={redactTextBurnIn} onChange={(e) => setRedactTextBurnIn(e.target.checked)} className="accent-indigo-600" />
                  <span>Burn-in permanen ke piksel</span>
                </label>
              </div>
            </div>
          )}

          {mode === 'form-pdf' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormAction('inspect')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                    formAction === 'inspect' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Inspeksi Field Form (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setFormAction('fill')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                    formAction === 'fill' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Isi Field Form (JSON)
                </button>
              </div>
              {formAction === 'fill' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">JSON Nilai Field</label>
                    <textarea
                      rows={5}
                      value={formValuesJson}
                      onChange={(e) => setFormValuesJson(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={formFlatten} onChange={(e) => setFormFlatten(e.target.checked)} className="accent-indigo-600" />
                    <span>Flatten form (kunci permanen setelah diisi)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {mode === 'nup-pdf' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Halaman per Lembar</label>
                <select
                  value={nupPagesPerSheet}
                  onChange={(e) => setNupPagesPerSheet(Number(e.target.value) as 2 | 4 | 6 | 9)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value={2}>2 Halaman / Lembar</option>
                  <option value={4}>4 Halaman / Lembar</option>
                  <option value={6}>6 Halaman / Lembar</option>
                  <option value={9}>9 Halaman / Lembar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Kertas</label>
                <select value={nupPageSize} onChange={(e) => setNupPageSize(e.target.value as 'A4' | 'Letter')} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm">
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Orientasi</label>
                <select value={nupOrientation} onChange={(e) => setNupOrientation(e.target.value as typeof nupOrientation)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm">
                  <option value="auto">Otomatis</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          )}

          {mode === 'extract-tables' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Format Output Tabel</label>
                <select value={tableFormat} onChange={(e) => setTableFormat(e.target.value as typeof tableFormat)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm">
                  <option value="markdown">Markdown Table (.md)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="json">Structured JSON (.json)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Toleransi Baris (pt)</label>
                <input type="number" min={1} max={30} value={tableRowTol} onChange={(e) => setTableRowTol(Number(e.target.value) || 5)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              </div>
            </div>
          )}

          {/* CLI Box */}
          <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Terminal size={14} className="text-indigo-400 shrink-0" />
              <code className="whitespace-nowrap">{cliCommand}</code>
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(cliCommand);
                setCopiedCli(true);
                setTimeout(() => setCopiedCli(false), 1800);
              }}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700"
            >
              {copiedCli ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedCli ? 'Tersalin' : 'Salin CLI'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={
              isProcessing ||
              (mode === 'stamp-image' && !stampImage && !(stampSourceMode === 'signature' && hasDrawnSignature))
            }
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-bold shadow-md disabled:opacity-50"
          >
            {isProcessing ? 'Memproses...' : 'Jalankan Tool'}
          </button>

          {outputFiles.length > 0 && (
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-emerald-700">{summary}</p>
                <div className="flex gap-2">
                  {onSendToPipeline && (
                    <button
                      type="button"
                      onClick={() => onSendToPipeline(outputFiles)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold"
                    >
                      <Workflow size={14} /> Kirim ke Pipeline Studio
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadVirtualFile(outputFiles[0])}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <Download size={14} /> Download {outputFiles[0].name}
                  </button>
                </div>
              </div>

              {textPreview && (
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                  {textPreview}
                </pre>
              )}

              {outputPreviewUrl && (
                <iframe
                  src={outputPreviewUrl}
                  title="PDF Output Preview"
                  className="w-full h-[55vh] min-h-[380px] rounded-xl border border-slate-200 bg-white"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
