import React, { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { pdfjsLib, renderPageToCanvas } from '../utils/pdfjs';
import JSZip from 'jszip';
import { 
  FileImage, 
  Download, 
  CheckSquare, 
  Square, 
  Layers, 
  Archive,
  RefreshCw
} from 'lucide-react';

interface PageItem {
  pageNum: number;
  dataUrl: string;
  selected: boolean;
}

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [format, setFormat] = useState<'jpeg' | 'png'>('png');
  const [qualityScale, setQualityScale] = useState<number>(2); // 2x for crisp HD
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setPages([]);
    setIsLoadingThumbnails(true);
    setProgress(0);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const loadedPages: PageItem[] = [];

      for (let i = 1; i <= numPages; i++) {
        const canvas = await renderPageToCanvas(pdfDoc, i, 0.6); // lightweight preview scale
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        loadedPages.push({
          pageNum: i,
          dataUrl,
          selected: true,
        });
        setProgress(Math.round((i / numPages) * 100));
      }

      setPages(loadedPages);
    } catch (err) {
      console.error('Error loading PDF for image conversion:', err);
      setError('Gagal membaca dokumen PDF. Pastikan file tidak terkunci password atau rusak.');
    } finally {
      setIsLoadingThumbnails(false);
      setProgress(0);
    }
  }, []);

  const handleFilesDrop = (files: File[]) => {
    if (files.length > 0) {
      loadPdf(files[0]);
    }
  };

  const toggleSelectPage = (pageNum: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNum === pageNum ? { ...p, selected: !p.selected } : p))
    );
  };

  const selectAll = (selected: boolean) => {
    setPages((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const selectedCount = pages.filter((p) => p.selected).length;

  const downloadSinglePage = async (pageNum: number) => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const canvas = await renderPageToCanvas(pdfDoc, pageNum, qualityScale);
      
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';
      const dataUrl = canvas.toDataURL(mime, 0.95);
      
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_page_${pageNum}.${ext}`;
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download single page:', err);
      alert('Gagal mendownload gambar halaman.');
    }
  };

  const handleExportImages = async (asZip: boolean) => {
    if (!file || selectedCount === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';

      const selectedPages = pages.filter((p) => p.selected);

      if (asZip || selectedPages.length > 1) {
        const zip = new JSZip();
        const folder = zip.folder(`${baseName}_images`) || zip;

        for (let i = 0; i < selectedPages.length; i++) {
          const item = selectedPages[i];
          const canvas = await renderPageToCanvas(pdfDoc, item.pageNum, qualityScale);
          
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), mime, 0.95)
          );

          if (blob) {
            folder.file(`${baseName}_page_${item.pageNum}.${ext}`, blob);
          }

          setProgress(Math.round(((i + 1) / selectedPages.length) * 80));
        }

        setProgress(90);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_images.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (selectedPages.length === 1) {
        await downloadSinglePage(selectedPages[0].pageNum);
      }
    } catch (err) {
      console.error('Error converting PDF to images:', err);
      setError('Terjadi kesalahan saat mengonversi PDF ke gambar.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
          <FileImage size={14} /> High Quality Export
        </div>
        <h2 className="text-3xl font-bold text-slate-800">PDF to Image</h2>
        <p className="text-slate-500">Konversi setiap halaman PDF menjadi gambar PNG atau JPG resolusi tinggi</p>
      </div>

      {!file ? (
        <FileDropzone 
          onFilesDrop={handleFilesDrop} 
          multiple={false} 
          label="Pilih atau Drop file PDF untuk diubah ke gambar" 
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* File Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileImage className="text-emerald-500 shrink-0" size={26} />
              <div>
                <p className="text-sm font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {pages.length > 0 ? `${pages.length} Halaman` : 'Memuat halaman...'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setPages([]);
                setError(null);
              }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              Ganti File
            </button>
          </div>

          {/* Configuration Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200">
            {/* Format Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Format Gambar
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormat('png')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    format === 'png'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  PNG (Lossless / Tajam)
                </button>
                <button
                  onClick={() => setFormat('jpeg')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    format === 'jpeg'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  JPG (Ukuran Ringan)
                </button>
              </div>
            </div>

            {/* Quality / Resolution Scale */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Resolusi & Kualitas
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { scale: 1, label: 'Standar', dpi: '1x' },
                  { scale: 2, label: 'HD Crisp', dpi: '2x' },
                  { scale: 3, label: 'Ultra HD', dpi: '3x' },
                ].map((item) => (
                  <button
                    key={item.scale}
                    onClick={() => setQualityScale(item.scale)}
                    className={`py-2 px-2 text-center rounded-lg text-xs font-medium border transition-all ${
                      qualityScale === item.scale
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold">{item.label}</div>
                    <div className={qualityScale === item.scale ? 'text-emerald-100' : 'text-slate-400'}>{item.dpi}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress / Loading Indicator */}
          {isLoadingThumbnails && (
            <div className="space-y-2 py-6 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Mempersiapkan preview halaman...</p>
              <div className="w-48 mx-auto h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Page Grid Selection */}
          {pages.length > 0 && !isLoadingThumbnails && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    Pilih Halaman ({selectedCount} dari {pages.length} dipilih)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => selectAll(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    <CheckSquare size={13} /> Pilih Semua
                  </button>
                  <button
                    onClick={() => selectAll(false)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    <Square size={13} /> Hapus Pilihan
                  </button>
                </div>
              </div>

              {/* Grid of Pages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-2 bg-slate-50/50 rounded-xl border border-slate-200">
                {pages.map((p) => (
                  <div
                    key={p.pageNum}
                    onClick={() => toggleSelectPage(p.pageNum)}
                    className={`relative group rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                      p.selected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white opacity-70'
                    }`}
                  >
                    <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img
                        src={p.dataUrl}
                        alt={`Page ${p.pageNum}`}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                    
                    {/* Badge & Checkbox */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[11px] font-bold text-white shadow">
                      Hal. {p.pageNum}
                    </div>

                    <div className="absolute top-2 right-2">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shadow transition-colors ${
                          p.selected ? 'bg-emerald-600 text-white' : 'bg-white/80 border border-slate-300'
                        }`}
                      >
                        {p.selected && <CheckSquare size={14} />}
                      </div>
                    </div>

                    {/* Single Download Overlay Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSinglePage(p.pageNum);
                      }}
                      title="Download halaman ini saja"
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Merender gambar resolusi tinggi & mengemas ZIP...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleExportImages(true)}
              disabled={isProcessing || selectedCount === 0 || isLoadingThumbnails}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 px-6 rounded-xl font-semibold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isProcessing ? (
                <span className="animate-pulse">Memproses ({progress}%)...</span>
              ) : (
                <>
                  <Archive size={18} />
                  <span>Download {selectedCount} Gambar (ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
