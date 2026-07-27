import { useEffect, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { Download, FileText, RotateCw, RotateCcw, ExternalLink, Eye } from 'lucide-react';

const toDataUrl = (sourceFile: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file as data URL"));
    reader.readAsDataURL(sourceFile);
  });

const tryOpenInNewTab = (url: string) => {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  return popup !== null;
};

type Rotation = 90 | 180 | 270;

export const RotatePDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rotation, setRotation] = useState<Rotation>(90);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const [isPreparingInlinePreview, setIsPreparingInlinePreview] = useState(false);
  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inlinePreviewUrl, setInlinePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    const generatePreview = async () => {
      if (!file) {
        setPreviewUrl(null);
        if (showInlinePreview) setInlinePreviewUrl(null);
        return;
      }
      setIsPreparingInlinePreview(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        for (const page of pages) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + rotation) % 360));
        }
        const pdfBytes = await pdfDoc.save();
        if (!active) return;
        
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        // If inline preview is currently visible, update it too
        if (showInlinePreview) {
          setInlinePreviewUrl(url);
        }
      } catch (error) {
        console.error("Error generating preview:", error);
      } finally {
        if (active) setIsPreparingInlinePreview(false);
      }
    };

    generatePreview();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, rotation]); // Re-run whenever file or rotation changes

  const handleFilesDrop = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    
    setFile(selectedFile);
    setRotation(90);
    setTotalPages(null);
    setShowInlinePreview(false);
    setInlinePreviewUrl(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setTotalPages(pdf.getPageCount());
    } catch (error) {
      console.error("Could not prepare selected PDF", error);
    }
  };

  const openPdf = async () => {
    if (!file) return;
    setIsOpeningPdf(true);

    try {
      if (previewUrl && tryOpenInNewTab(previewUrl)) return;

      const dataUrl = await toDataUrl(file);
      if (tryOpenInNewTab(dataUrl)) return;

      alert(
        "Browser memblokir tab baru. Gunakan tombol Download lalu buka filenya dari perangkat Anda.",
      );
    } finally {
      setIsOpeningPdf(false);
    }
  };

  const showPreviewInline = async () => {
    if (!file || !previewUrl) return;
    setInlinePreviewUrl(previewUrl);
    setShowInlinePreview(true);
  };

  const handleRotate = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + rotation) % 360));
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotated_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error rotating PDF:", error);
      alert("An error occurred while rotating the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Rotate PDF</h2>
        <p className="text-slate-500">Rotate all pages in your PDF file</p>
      </div>

      {!file ? (
        <FileDropzone onFilesDrop={handleFilesDrop} multiple={false} label="Drop a PDF to rotate" />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-500 shrink-0" size={24} />
              <div>
                <p className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB {totalPages && `| ${totalPages} Pages`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setTotalPages(null);
                setShowInlinePreview(false);
                setInlinePreviewUrl(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Change File
            </button>
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Preview Dokumen
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan tombol preview untuk memastikan isi dan orientasi PDF Anda.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={showPreviewInline}
                disabled={isPreparingInlinePreview}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {isPreparingInlinePreview
                  ? "Menyiapkan Preview..."
                  : "Tampilkan Preview"}
              </button>
              <button
                onClick={openPdf}
                disabled={isOpeningPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <Eye size={16} />
                {isOpeningPdf ? "Membuka PDF..." : "Buka PDF"}
                <ExternalLink size={14} className="text-slate-400" />
              </button>
            </div>
          </div>

          {showInlinePreview && inlinePreviewUrl && (
            <div className="mb-6 rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                Preview Inline: jika kosong di browser tertentu, gunakan tombol
                "Buka PDF".
              </div>
              <iframe
                src={inlinePreviewUrl}
                className="w-full h-[70vh] min-h-[420px]"
                title="PDF Inline Preview"
              />
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Rotation Angle</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setRotation(90)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  rotation === 90 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <RotateCw size={24} className="mb-2" />
                <span className="text-sm font-medium">90° Right</span>
              </button>
              <button
                onClick={() => setRotation(270)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  rotation === 270 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <RotateCcw size={24} className="mb-2" />
                <span className="text-sm font-medium">90° Left</span>
              </button>
              <button
                onClick={() => setRotation(180)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  rotation === 180 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <RotateCw size={24} className="mb-2 transform rotate-90" />
                <span className="text-sm font-medium">180°</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleRotate}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Rotating...</span>
            ) : (
              <>
                <Download size={20} />
                Rotate & Save PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
