import React, { useState, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { 
  Binary, 
  Download, 
  Eye, 
  FileText, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

type Position = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

interface PageNumberOptions {
  format: 'page-of-total' | 'n-of-total' | 'page-n' | 'hyphen-n' | 'n-only';
  position: Position;
  startNumber: number;
  skipFirstPage: boolean;
  fontSize: number;
  color: string;
  margin: number;
}

const COLOR_OPTIONS = [
  { label: 'Gray', hex: '#64748b', rgb: rgb(0.39, 0.45, 0.54) },
  { label: 'Dark Slate', hex: '#334155', rgb: rgb(0.2, 0.25, 0.33) },
  { label: 'Black', hex: '#000000', rgb: rgb(0, 0, 0) },
  { label: 'Indigo', hex: '#4f46e5', rgb: rgb(0.31, 0.27, 0.9) },
  { label: 'Blue', hex: '#2563eb', rgb: rgb(0.15, 0.39, 0.92) },
];

export const PageNumberPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<PageNumberOptions>({
    format: 'page-of-total',
    position: 'bottom-center',
    startNumber: 1,
    skipFirstPage: false,
    fontSize: 10,
    color: '#64748b',
    margin: 25,
  });

  const handleFilesDrop = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setError(null);
    setShowPreview(false);

    try {
      const buffer = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      setTotalPages(doc.getPageCount());
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Gagal membaca PDF. Pastikan file valid dan tidak terenkripsi.');
    }
  };

  const formatText = (pageNum: number, total: number, formatType: PageNumberOptions['format']) => {
    switch (formatType) {
      case 'page-of-total':
        return `Page ${pageNum} of ${total}`;
      case 'n-of-total':
        return `${pageNum} / ${total}`;
      case 'page-n':
        return `Page ${pageNum}`;
      case 'hyphen-n':
        return `- ${pageNum} -`;
      case 'n-only':
      default:
        return `${pageNum}`;
    }
  };

  const applyNumbersToDoc = useCallback(async (
    sourceDoc: PDFDocument,
    opts: PageNumberOptions
  ) => {
    const font = await sourceDoc.embedFont(StandardFonts.Helvetica);
    const pages = sourceDoc.getPages();
    const count = pages.length;

    const selectedColor = COLOR_OPTIONS.find((c) => c.hex === opts.color)?.rgb || rgb(0.4, 0.4, 0.4);

    const startIndex = opts.skipFirstPage ? 1 : 0;
    const effectiveTotal = opts.skipFirstPage ? count - 1 : count;

    for (let i = startIndex; i < count; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const currentNumber = opts.startNumber + (i - startIndex);
      const text = formatText(currentNumber, effectiveTotal, opts.format);

      const textWidth = font.widthOfTextAtSize(text, opts.fontSize);
      const textHeight = font.heightAtSize(opts.fontSize);

      let x: number;
      let y: number;

      const margin = opts.margin;

      // X coordinate calculation
      if (opts.position.includes('left')) {
        x = margin + 15;
      } else if (opts.position.includes('right')) {
        x = width - margin - 15 - textWidth;
      } else {
        // center
        x = width / 2 - textWidth / 2;
      }

      // Y coordinate calculation
      if (opts.position.startsWith('top')) {
        y = height - margin - textHeight;
      } else {
        // bottom
        y = margin;
      }

      page.drawText(text, {
        x,
        y,
        size: opts.fontSize,
        font,
        color: selectedColor,
      });
    }
  }, []);

  const generatePreview = useCallback(async () => {
    if (!file) return;
    setIsGeneratingPreview(true);
    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      await applyNumbersToDoc(doc, options);

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [file, options, previewUrl, applyNumbersToDoc]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      await applyNumbersToDoc(doc, options);

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `numbered_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Page numbering error:', err);
      setError('Terjadi kesalahan saat menambahkan nomor halaman.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold uppercase tracking-wider mb-1">
          <Binary size={14} /> Page Numbering Tool
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Add Page Numbers to PDF</h2>
        <p className="text-slate-500">Tambahkan penomoran halaman otomatis dengan format dan tata letak rapi</p>
      </div>

      {!file ? (
        <FileDropzone 
          onFilesDrop={handleFilesDrop} 
          multiple={false} 
          label="Pilih atau Drop file PDF untuk diberi nomor halaman" 
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* File Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-cyan-600 shrink-0" size={26} />
              <div>
                <p className="text-sm font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {totalPages} Halaman
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setPreviewUrl(null);
                setShowPreview(false);
              }}
              className="text-sm text-cyan-600 hover:text-cyan-700 font-medium px-3 py-1.5 rounded-lg hover:bg-cyan-50 transition-colors"
            >
              Ganti File
            </button>
          </div>

          {/* Configuration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50/80 border border-slate-200">
            {/* Left Column: Format & Position */}
            <div className="space-y-4">
              {/* Format Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Format Penomoran
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'page-of-total', label: 'Halaman 1 dari 10', sample: 'Page 1 of 10' },
                    { id: 'n-of-total', label: '1 / 10', sample: '1 / 10' },
                    { id: 'page-n', label: 'Halaman 1', sample: 'Page 1' },
                    { id: 'hyphen-n', label: '- 1 -', sample: '- 1 -' },
                    { id: 'n-only', label: 'Hanya Angka: 1', sample: '1' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setOptions({ ...options, format: fmt.id as PageNumberOptions['format'] })}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                        options.format === fmt.id
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{fmt.label}</span>
                      <span className={options.format === fmt.id ? 'text-cyan-100' : 'text-slate-400'}>
                        {fmt.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Position Layout Matrix */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Posisi di Halaman
                </label>
                <div className="space-y-2">
                  {/* Header Row */}
                  <div className="text-[11px] font-semibold text-slate-500">Header (Atas):</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'top-left', label: 'Kiri Atas', icon: AlignLeft },
                      { id: 'top-center', label: 'Tengah Atas', icon: AlignCenter },
                      { id: 'top-right', label: 'Kanan Atas', icon: AlignRight },
                    ].map((pos) => {
                      const Icon = pos.icon;
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setOptions({ ...options, position: pos.id as Position })}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border transition-all ${
                            options.position === pos.id
                              ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm font-semibold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{pos.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer Row */}
                  <div className="text-[11px] font-semibold text-slate-500 pt-1">Footer (Bawah):</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'bottom-left', label: 'Kiri Bawah', icon: AlignLeft },
                      { id: 'bottom-center', label: 'Tengah Bawah', icon: AlignCenter },
                      { id: 'bottom-right', label: 'Kanan Bawah', icon: AlignRight },
                    ].map((pos) => {
                      const Icon = pos.icon;
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setOptions({ ...options, position: pos.id as Position })}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border transition-all ${
                            options.position === pos.id
                              ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm font-semibold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{pos.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Numbers, Options & Styling */}
            <div className="space-y-4">
              {/* Starting Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor Halaman Awal
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={options.startNumber}
                  onChange={(e) =>
                    setOptions({ ...options, startNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-cyan-500 outline-none text-sm font-medium bg-white"
                />
              </div>

              {/* Skip First Page Checkbox */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="skipFirst"
                  checked={options.skipFirstPage}
                  onChange={(e) => setOptions({ ...options, skipFirstPage: e.target.checked })}
                  className="w-4 h-4 text-cyan-600 accent-cyan-600 rounded cursor-pointer"
                />
                <label htmlFor="skipFirst" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Lewati Halaman Pertama (Contoh: Sampul / Cover)
                </label>
              </div>

              {/* Font Size Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Ukuran Font</span>
                  <span className="text-cyan-600">{options.fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="20"
                  step="1"
                  value={options.fontSize}
                  onChange={(e) => setOptions({ ...options, fontSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* Margin Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Jarak dari Tepi (Margin)</span>
                  <span className="text-cyan-600">{options.margin} pt</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={options.margin}
                  onChange={(e) => setOptions({ ...options, margin: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Warna Teks
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setOptions({ ...options, color: col.hex })}
                      title={col.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                        options.color === col.hex
                          ? 'border-cyan-600 ring-2 ring-cyan-500/30 scale-110'
                          : 'border-white hover:scale-105 shadow-sm'
                      }`}
                      style={{ backgroundColor: col.hex }}
                    >
                      {options.color === col.hex && (
                        <CheckCircle2 size={16} className="text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              onClick={generatePreview}
              disabled={isGeneratingPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-semibold text-xs transition-colors border border-cyan-200"
            >
              {isGeneratingPreview ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              {isGeneratingPreview ? 'Menyiapkan Preview...' : 'Tampilkan / Segarkan Preview'}
            </button>
            {showPreview && (
              <span className="text-xs text-slate-500 font-medium">Preview penomoran tampil di bawah</span>
            )}
          </div>

          {/* Inline Preview */}
          {showPreview && previewUrl && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-inner">
              <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between items-center">
                <span>Preview Hasil Nomor Halaman</span>
                <span className="text-slate-400 text-[11px]">Real-time rendered PDF</span>
              </div>
              <iframe
                src={previewUrl}
                className="w-full h-[60vh] min-h-[400px]"
                title="Page Numbers PDF Preview"
              />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Download Action Button */}
          <button
            onClick={handleDownload}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white py-3.5 px-6 rounded-xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Menambahkan Nomor Halaman...</span>
            ) : (
              <>
                <Download size={18} />
                <span>Simpan & Download PDF Bernomor</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
