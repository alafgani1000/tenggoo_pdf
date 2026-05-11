import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { FileText, Scissors, Eye, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';


export const SplitPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  const handleFilesDrop = async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      
      const url = URL.createObjectURL(selectedFile);
      setPdfUrl(url);
      
      // Get total pages to help user
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        setTotalPages(pdf.getPageCount());
      } catch (e) {
        console.error("Could not load PDF to count pages");
      }
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const docTotalPages = pdf.getPageCount();
      
      let pagesToExtract: number[] = [];
      
      if (!pageRange.trim()) {
        // Default to splitting into individual pages or maybe just extracting first page?
        // Let's require a page range.
        alert("Please enter a page range (e.g., 1-3 or 1,4,5)");
        setIsProcessing(false);
        return;
      }

      // Parse page range like "1-3, 5, 7-9"
      const parts = pageRange.split(',').map(p => p.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
            for (let i = start; i <= end; i++) {
              if (i <= docTotalPages) pagesToExtract.push(i - 1); // 0-indexed
            }
          }
        } else {
          const pageNum = parseInt(part, 10);
          if (!isNaN(pageNum) && pageNum > 0 && pageNum <= docTotalPages) {
            pagesToExtract.push(pageNum - 1); // 0-indexed
          }
        }
      }

      // Deduplicate and sort
      pagesToExtract = Array.from(new Set(pagesToExtract)).sort((a, b) => a - b);

      if (pagesToExtract.length === 0) {
        alert("Invalid page range specified.");
        setIsProcessing(false);
        return;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(pdf, pagesToExtract);
      copiedPages.forEach(page => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `split_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error splitting PDF:", error);
      alert("An error occurred while splitting the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Split PDF</h2>
        <p className="text-slate-500">Extract pages from your PDF file</p>
      </div>

      {!file ? (
        <FileDropzone onFilesDrop={handleFilesDrop} multiple={false} label="Drop a PDF to split" />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-pink-500" size={24} />
              <div>
                <p className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB {totalPages && `• ${totalPages} Pages`}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { 
                setFile(null); 
                setTotalPages(null); 
                setPageRange(''); 
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
              }}
              className="text-sm text-pink-600 hover:text-pink-700 font-medium"
            >
              Change File
            </button>
          </div>

          {pdfUrl && (
            <div className="mb-6">
              {isMobile ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 mb-2">
                    <FileText size={32} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Pratinjau PDF</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-[240px]">
                      Browser mobile tidak mendukung pratinjau langsung di dalam aplikasi.
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(pdfUrl, '_blank')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <Eye size={18} />
                    Lihat Dokumen
                    <ExternalLink size={14} className="text-slate-400" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-[600px]">
                  <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pages to Extract
            </label>
            <input 
              type="text" 
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder="e.g., 1-5, 8, 11-13" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-2">
              Enter page numbers and/or page ranges separated by commas.
            </p>
          </div>

          <button
            onClick={handleSplit}
            disabled={isProcessing || !pageRange.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Splitting...</span>
            ) : (
              <>
                <Scissors size={20} />
                Split PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
