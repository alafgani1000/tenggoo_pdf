import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { FileText, Zap } from 'lucide-react';

export const CompressPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  const handleFilesDrop = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setOriginalSize(files[0].size);
      setCompressedSize(null);
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Load PDF. We ignore encryption to avoid some errors if possible, 
      // but if it's encrypted it might fail anyway.
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      
      // Basic optimization: resave with useObjectStreams to true
      // Note: Client-side compression with pdf-lib is limited. It removes unused objects.
      const pdfBytes = await pdf.save({ useObjectStreams: true });
      
      const newSize = pdfBytes.length;
      setCompressedSize(newSize);

      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error compressing PDF:", error);
      alert("An error occurred. The PDF might be encrypted or unsupported for client-side optimization.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 animate-float" style={{ animationDuration: '9s' }}>
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Compress PDF</h2>
        <p className="text-slate-500">Optimize PDF file size</p>
      </div>

      {!file ? (
        <FileDropzone onFilesDrop={handleFilesDrop} multiple={false} label="Drop a PDF to compress" />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-amber-500" size={24} />
              <div>
                <p className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {originalSize && `${(originalSize / 1024 / 1024).toFixed(2)} MB`}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { setFile(null); setOriginalSize(null); setCompressedSize(null); }}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Change File
            </button>
          </div>

          {compressedSize && originalSize && (
            <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-100 text-center">
              <p className="text-sm font-medium text-green-800">
                Optimization Complete!
              </p>
              <p className="text-xs text-green-600 mt-1">
                New Size: {(compressedSize / 1024 / 1024).toFixed(2)} MB 
                (Saved {(((originalSize - compressedSize) / originalSize) * 100).toFixed(1)}%)
              </p>
            </div>
          )}

          <div className="mb-6 text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <strong>Note:</strong> Since this runs entirely in your browser, compression is limited to structural optimization (removing unused objects). It may not significantly reduce the size of image-heavy PDFs.
          </div>

          <button
            onClick={handleCompress}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Optimizing...</span>
            ) : (
              <>
                <Zap size={20} />
                Optimize PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
