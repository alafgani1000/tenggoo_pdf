import React, { useState, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { 
  Stamp, 
  Download, 
  Eye, 
  Palette, 
  FileText,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
  position: 'center-diagonal' | 'center' | 'top' | 'bottom' | 'tiled';
  pageRange: string;
}

const COLOR_PRESETS = [
  { label: 'Gray', hex: '#64748b', rgb: rgb(0.39, 0.45, 0.54) },
  { label: 'Red', hex: '#ef4444', rgb: rgb(0.93, 0.27, 0.27) },
  { label: 'Blue', hex: '#3b82f6', rgb: rgb(0.23, 0.51, 0.96) },
  { label: 'Emerald', hex: '#10b981', rgb: rgb(0.06, 0.72, 0.5) },
  { label: 'Amber', hex: '#f59e0b', rgb: rgb(0.96, 0.62, 0.04) },
  { label: 'Purple', hex: '#8b5cf6', rgb: rgb(0.54, 0.36, 0.96) },
  { label: 'Black', hex: '#000000', rgb: rgb(0, 0, 0) },
];

const TEXT_PRESETS = ['CONFIDENTIAL', 'DRAFT', 'RAHASIA', 'COPY', 'ORIGINAL', 'SAMPLE', 'FOR INTERNAL USE'];

export const WatermarkPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<WatermarkOptions>({
    text: 'CONFIDENTIAL',
    fontSize: 48,
    opacity: 0.25,
    rotation: 45,
    color: '#64748b',
    position: 'center-diagonal',
    pageRange: '',
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
      setError('Gagal membaca PDF. Pastikan file tidak rusak.');
    }
  };

  const applyWatermarkToDoc = useCallback(async (
    sourceDoc: PDFDocument,
    opts: WatermarkOptions
  ) => {
    const font = await sourceDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = sourceDoc.getPages();
    const count = pages.length;

    // Determine target page indices
    let targetIndices: number[] = [];
    if (!opts.pageRange.trim()) {
      targetIndices = pages.map((_, i) => i);
    } else {
      const parts = opts.pageRange.split(',').map((p) => p.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.max(1, start); i <= Math.min(count, end); i++) {
              targetIndices.push(i - 1);
            }
          }
        } else {
          const num = parseInt(part, 10);
          if (!isNaN(num) && num >= 1 && num <= count) {
            targetIndices.push(num - 1);
          }
        }
      }
      targetIndices = Array.from(new Set(targetIndices));
    }

    const selectedColor = COLOR_PRESETS.find((c) => c.hex === opts.color)?.rgb || rgb(0.4, 0.4, 0.4);

    for (const idx of targetIndices) {
      const page = pages[idx];
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(opts.text, opts.fontSize);
      const textHeight = font.heightAtSize(opts.fontSize);

      if (opts.position === 'tiled') {
        // Render 3x3 tiled grid
        const cols = 3;
        const rows = 3;
        const colWidth = width / cols;
        const rowHeight = height / rows;

        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const centerX = c * colWidth + colWidth / 2;
            const centerY = r * rowHeight + rowHeight / 2;
            page.drawText(opts.text, {
              x: centerX - textWidth / 2,
              y: centerY - textHeight / 2,
              size: opts.fontSize * 0.7,
              font,
              color: selectedColor,
              opacity: opts.opacity,
              rotate: degrees(opts.rotation),
            });
          }
        }
      } else if (opts.position === 'top') {
        page.drawText(opts.text, {
          x: width / 2 - textWidth / 2,
          y: height - 60,
          size: opts.fontSize * 0.6,
          font,
          color: selectedColor,
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        });
      } else if (opts.position === 'bottom') {
        page.drawText(opts.text, {
          x: width / 2 - textWidth / 2,
          y: 40,
          size: opts.fontSize * 0.6,
          font,
          color: selectedColor,
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        });
      } else {
        // center or center-diagonal
        page.drawText(opts.text, {
          x: width / 2 - (textWidth / 2) * Math.cos((opts.rotation * Math.PI) / 180),
          y: height / 2 - (textWidth / 2) * Math.sin((opts.rotation * Math.PI) / 180),
          size: opts.fontSize,
          font,
          color: selectedColor,
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        });
      }
    }
  }, []);

  const generatePreview = useCallback(async () => {
    if (!file || !options.text.trim()) return;
    setIsGeneratingPreview(true);
    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      await applyWatermarkToDoc(doc, options);
      
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
  }, [file, options, previewUrl, applyWatermarkToDoc]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = async () => {
    if (!file || !options.text.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      await applyWatermarkToDoc(doc, options);

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Watermark error:', err);
      setError('Terjadi kesalahan saat menambahkan watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold uppercase tracking-wider mb-1">
          <Stamp size={14} /> Text Watermark Tool
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Add Watermark to PDF</h2>
        <p className="text-slate-500">Beri tanda air (watermark) kustom untuk melindungi hak cipta dokumen Anda</p>
      </div>

      {!file ? (
        <FileDropzone 
          onFilesDrop={handleFilesDrop} 
          multiple={false} 
          label="Pilih atau Drop file PDF untuk diberi watermark" 
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* File Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-violet-500 shrink-0" size={26} />
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
              className="text-sm text-violet-600 hover:text-violet-700 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
            >
              Ganti File
            </button>
          </div>

          {/* Watermark Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50/80 border border-slate-200">
            {/* Left Column: Text & Presets */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Teks Watermark
                </label>
                <input
                  type="text"
                  value={options.text}
                  onChange={(e) => setOptions({ ...options, text: e.target.value })}
                  placeholder="e.g. CONFIDENTIAL / RAHASIA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm font-medium bg-white"
                />
              </div>

              {/* Quick Text Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Preset Cepat
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOptions({ ...options, text: preset })}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        options.text === preset
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette size={14} /> Warna Watermark
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setOptions({ ...options, color: col.hex })}
                      title={col.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                        options.color === col.hex
                          ? 'border-violet-600 ring-2 ring-violet-500/30 scale-110'
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

              {/* Placement Layout */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Posisi & Tata Letak
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                  {[
                    { id: 'center-diagonal', label: 'Diagonal Tengah' },
                    { id: 'center', label: 'Tengah Lurus' },
                    { id: 'tiled', label: 'Pola Kisi (Grid)' },
                    { id: 'top', label: 'Header Atas' },
                    { id: 'bottom', label: 'Footer Bawah' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        setOptions({
                          ...options,
                          position: pos.id as WatermarkOptions['position'],
                          rotation: pos.id === 'center-diagonal' ? 45 : pos.id === 'tiled' ? 30 : 0,
                        })
                      }
                      className={`py-2 px-2 text-center rounded-lg border transition-all ${
                        options.position === pos.id
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Sliders & Range */}
            <div className="space-y-4">
              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Transparansi (Opacity)</span>
                  <span className="text-violet-600">{Math.round(options.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={options.opacity}
                  onChange={(e) => setOptions({ ...options, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-violet-600 cursor-pointer"
                />
              </div>

              {/* Font Size Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Ukuran Font</span>
                  <span className="text-violet-600">{options.fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="100"
                  step="2"
                  value={options.fontSize}
                  onChange={(e) => setOptions({ ...options, fontSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600 cursor-pointer"
                />
              </div>

              {/* Rotation Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Sudut Rotasi</span>
                  <span className="text-violet-600">{options.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  value={options.rotation}
                  onChange={(e) => setOptions({ ...options, rotation: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-medium">
                  <button type="button" onClick={() => setOptions({ ...options, rotation: -45 })} className="hover:text-violet-600">-45°</button>
                  <button type="button" onClick={() => setOptions({ ...options, rotation: 0 })} className="hover:text-violet-600">0° Horizontal</button>
                  <button type="button" onClick={() => setOptions({ ...options, rotation: 45 })} className="hover:text-violet-600">+45° Diagonal</button>
                </div>
              </div>

              {/* Page Range */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Halaman Target (Opsional)
                </label>
                <input
                  type="text"
                  value={options.pageRange}
                  onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                  placeholder="Kosongkan untuk Semua Halaman, atau contoh: 1-3, 5"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-xs bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">Default: Watermark diterapkan ke seluruh halaman PDF.</p>
              </div>
            </div>
          </div>

          {/* Preview Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              onClick={generatePreview}
              disabled={isGeneratingPreview || !options.text.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold text-xs transition-colors border border-violet-200"
            >
              {isGeneratingPreview ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              {isGeneratingPreview ? 'Menyiapkan Preview...' : 'Perbarui / Tampilkan Preview'}
            </button>
            {showPreview && (
              <span className="text-xs text-slate-500 font-medium">Preview watermark siap di bawah</span>
            )}
          </div>

          {/* Inline Preview Section */}
          {showPreview && previewUrl && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-inner">
              <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between items-center">
                <span>Preview Hasil Watermark</span>
                <span className="text-slate-400 text-[11px]">Real-time rendered PDF</span>
              </div>
              <iframe
                src={previewUrl}
                className="w-full h-[60vh] min-h-[400px]"
                title="Watermark PDF Preview"
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
            disabled={isProcessing || !options.text.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-3.5 px-6 rounded-xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Menambahkan Watermark...</span>
            ) : (
              <>
                <Download size={18} />
                <span>Simpan & Download PDF Ber-watermark</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
