import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { FileText, Download, X, GripVertical } from 'lucide-react';

export const MergePDF: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesDrop = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("An error occurred while merging PDFs.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Merge PDF</h2>
        <p className="text-slate-500">Combine multiple PDFs into a single file</p>
      </div>

      <FileDropzone onFilesDrop={handleFilesDrop} multiple={true} label="Drop PDFs to merge" />

      {files.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Files to merge ({files.length})</h3>
          <div className="space-y-3 mb-6">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                  <GripVertical size={20} />
                </div>
                <FileText className="text-indigo-500" size={24} />
                <span className="flex-1 truncate text-sm font-medium text-slate-700">{file.name}</span>
                <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button 
                  onClick={() => removeFile(idx)}
                  className="p-1 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Remove file"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Merging...</span>
            ) : (
              <>
                <Download size={20} />
                Merge PDFs
              </>
            )}
          </button>
          {files.length < 2 && (
             <p className="text-center text-xs text-amber-600 mt-3">Please add at least 2 files to merge.</p>
          )}
        </div>
      )}
    </div>
  );
};
