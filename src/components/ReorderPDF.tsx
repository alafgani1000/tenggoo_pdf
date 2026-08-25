import React, { useState, useCallback } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { pdfjsLib, renderPageThumbnail } from '../utils/pdfjs';
import { 
  ArrowLeftRight, 
  Download, 
  Trash2, 
  RotateCw, 
  Copy, 
  ChevronLeft, 
  RefreshCcw, 
  FileText, 
  GripVertical
} from 'lucide-react';

interface PageCard {
  id: string; // unique identifier
  originalPageIndex: number; // 0-based
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl: string;
  isDeleted: boolean;
}

export const ReorderPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageCard[]>([]);
  const [initialPages, setInitialPages] = useState<PageCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setPages([]);
    setIsLoading(true);
    setLoadingProgress(0);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const loadedPages: PageCard[] = [];

      for (let i = 1; i <= numPages; i++) {
        const thumb = await renderPageThumbnail(pdfDoc, i, 240);
        loadedPages.push({
          id: `page-${i}-${Date.now()}`,
          originalPageIndex: i - 1,
          rotation: 0,
          thumbnailUrl: thumb,
          isDeleted: false,
        });
        setLoadingProgress(Math.round((i / numPages) * 100));
      }

      setPages(loadedPages);
      setInitialPages(loadedPages);
    } catch (err) {
      console.error('Error loading PDF for page organizer:', err);
      setError('Gagal memuat dokumen PDF. Pastikan file valid.');
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  }, []);

  const handleFilesDrop = (files: File[]) => {
    if (files.length > 0) {
      loadPdf(files[0]);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      handleDragEnd();
      return;
    }

    setPages((prev) => {
      const updated = [...prev];
      const draggedItem = updated[draggedIndex];
      updated.splice(draggedIndex, 1);
      updated.splice(index, 0, draggedItem);
      return updated;
    });

    handleDragEnd();
  };

  // Move page single step
  const moveStep = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;

    setPages((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[target];
      updated[target] = temp;
      return updated;
    });
  };

  // Rotate single page
  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  // Rotate all active pages
  const rotateAll = (deg: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + deg + 360) % 360 }))
    );
  };

  // Toggle deleted state
  const toggleDelete = (index: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  // Duplicate page
  const duplicatePage = (index: number) => {
    const target = pages[index];
    const newPage: PageCard = {
      ...target,
      id: `page-dup-${Date.now()}-${Math.random()}`,
    };
    setPages((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newPage);
      return updated;
    });
  };

  // Reverse all pages
  const reversePages = () => {
    setPages((prev) => [...prev].reverse());
  };

  // Reset to initial
  const resetOrder = () => {
    setPages(initialPages);
  };

  const activePages = pages.filter((p) => !p.isDeleted);

  const handleExport = async () => {
    if (!file || activePages.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const sourceDoc = await PDFDocument.load(arrayBuffer);
      const outputDoc = await PDFDocument.create();

      for (const card of activePages) {
        const [copiedPage] = await outputDoc.copyPages(sourceDoc, [card.originalPageIndex]);
        if (card.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRotation + card.rotation) % 360));
        }
        outputDoc.addPage(copiedPage);
      }

      const pdfBytes = await outputDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `organized_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error reordering PDF:', err);
      setError('Terjadi kesalahan saat menyusun dan menyimpan PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-1">
          <ArrowLeftRight size={14} /> Visual Page Organizer
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Organize & Reorder PDF Pages</h2>
        <p className="text-slate-500">Susun ulang urutan halaman, putar halaman tertentu, hapus atau duplikasi halaman dengan mudah</p>
      </div>

      {!file ? (
        <FileDropzone 
          onFilesDrop={handleFilesDrop} 
          multiple={false} 
          label="Pilih atau Drop file PDF untuk menyusun ulang halaman" 
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-amber-500 shrink-0" size={26} />
              <div>
                <p className="text-sm font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {activePages.length} dari {pages.length} Halaman Aktif
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setPages([]);
              }}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
            >
              Ganti File
            </button>
          </div>

          {/* Quick Actions Bar */}
          {pages.length > 0 && !isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 uppercase tracking-wider">Aksi Massal:</span>
                <button
                  onClick={() => rotateAll(90)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition-colors shadow-sm"
                >
                  <RotateCw size={13} /> Putar Semua 90°
                </button>
                <button
                  onClick={reversePages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition-colors shadow-sm"
                >
                  <ArrowLeftRight size={13} /> Balik Urutan
                </button>
              </div>
              <button
                onClick={resetOrder}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition-colors shadow-sm"
              >
                <RefreshCcw size={13} /> Reset Susunan
              </button>
            </div>
          )}

          {/* Loading Progress */}
          {isLoading && (
            <div className="space-y-2 py-8 text-center">
              <RefreshCcw className="w-8 h-8 mx-auto text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Mempersiapkan kartu thumbnail halaman...</p>
              <div className="w-48 mx-auto h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          )}

          {/* Page Cards Grid */}
          {pages.length > 0 && !isLoading && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 italic">
                * Tarik (drag) kartu untuk memindahkan posisi halaman, atau gunakan tombol panah kiri / kanan.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-3 bg-slate-50/50 rounded-2xl border border-slate-200 max-h-[600px] overflow-y-auto">
                {pages.map((card, idx) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`relative group rounded-xl border-2 flex flex-col bg-white overflow-hidden transition-all select-none shadow-sm hover:shadow-md ${
                      card.isDeleted
                        ? 'opacity-40 border-red-200 bg-red-50/30'
                        : dragOverIndex === idx
                        ? 'border-amber-500 ring-2 ring-amber-400/30 scale-105'
                        : 'border-slate-200 hover:border-amber-400'
                    } ${draggedIndex === idx ? 'opacity-40 scale-95' : ''}`}
                  >
                    {/* Header Badges */}
                    <div className="flex items-center justify-between p-2 bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                      <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-slate-400" />
                        <span>#{idx + 1}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Asli: {card.originalPageIndex + 1}
                      </span>
                    </div>

                    {/* Thumbnail Display with Rotation */}
                    <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center p-2 overflow-hidden relative">
                      <img
                        src={card.thumbnailUrl}
                        alt={`Page ${idx + 1}`}
                        style={{ transform: `rotate(${card.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-300 pointer-events-none"
                      />
                      {card.rotation > 0 && (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-bold text-white">
                          +{card.rotation}°
                        </div>
                      )}
                      {card.isDeleted && (
                        <div className="absolute inset-0 bg-red-900/40 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="text-white font-bold text-xs bg-red-600 px-2 py-1 rounded shadow">
                            Dihapus
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Footer on Card */}
                    <div className="grid grid-cols-4 border-t border-slate-200 divide-x divide-slate-200 bg-slate-50 text-slate-600">
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 'left')}
                        disabled={idx === 0}
                        title="Pindah ke kiri"
                        className="py-2 flex items-center justify-center hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotatePage(idx)}
                        title="Putar 90°"
                        className="py-2 flex items-center justify-center hover:bg-amber-100 hover:text-amber-700"
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicatePage(idx)}
                        title="Duplikasi halaman"
                        className="py-2 flex items-center justify-center hover:bg-blue-100 hover:text-blue-700"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDelete(idx)}
                        title={card.isDeleted ? 'Pulihkan halaman' : 'Hapus halaman'}
                        className={`py-2 flex items-center justify-center transition-colors ${
                          card.isDeleted
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'hover:bg-red-100 hover:text-red-600'
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Export Action Button */}
          <button
            onClick={handleExport}
            disabled={isProcessing || activePages.length === 0 || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3.5 px-6 rounded-xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Menyusun & Menyimpan PDF...</span>
            ) : (
              <>
                <Download size={18} />
                <span>Simpan PDF Baru ({activePages.length} Halaman)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
