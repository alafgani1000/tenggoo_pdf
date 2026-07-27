import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { Download, X, GripVertical, Image as ImageIcon } from 'lucide-react';

export const ImageToPDF: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFilesDrop = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      handleDragEnd(e);
      return;
    }
    
    setFiles((prev) => {
      const newFiles = [...prev];
      const draggedFile = newFiles[draggedIndex];
      newFiles.splice(draggedIndex, 1);
      newFiles.splice(index, 0, draggedFile);
      return newFiles;
    });
    
    handleDragEnd(e);
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let image;
        
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          console.warn(`Unsupported file type: ${file.type}`);
          continue;
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'images-converted.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error converting images to PDF:", error);
      alert("An error occurred while converting images to PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Image to PDF</h2>
        <p className="text-slate-500">Convert JPG and PNG images into a single PDF document</p>
      </div>

      <FileDropzone 
        onFilesDrop={handleFilesDrop} 
        multiple={true} 
        accept="image/jpeg, image/png, image/jpg"
        label="Drop images to convert" 
        helpText="Only JPG and PNG files are supported"
      />

      {files.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Images to convert ({files.length})</h3>
          <div className="space-y-3 mb-6">
            {files.map((file, idx) => (
              <div 
                key={`${file.name}-${idx}`} 
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex items-center gap-3 p-3 rounded-xl border group transition-colors ${
                  dragOverIndex === idx 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                } ${draggedIndex === idx ? 'opacity-50' : ''}`}
              >
                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                  <GripVertical size={20} />
                </div>
                <ImageIcon className="text-emerald-500 shrink-0" size={24} />
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
            onClick={handleConvert}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Converting...</span>
            ) : (
              <>
                <Download size={20} />
                Convert to PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
