import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileDropzoneProps {
  onFilesDrop: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ 
  onFilesDrop, 
  multiple = true, 
  accept = "application/pdf",
  label = "Drag & drop PDF files here, or click to select"
}) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(f => f.type === accept || accept === '*');
      if (files.length > 0) {
        if (!multiple) {
          onFilesDrop([files[0]]);
        } else {
          onFilesDrop(files);
        }
      }
    },
    [onFilesDrop, multiple, accept]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesDrop(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="w-full relative group cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
      <div className="relative glass-panel rounded-2xl p-10 flex flex-col items-center justify-center border-dashed border-2 border-indigo-200 hover:border-indigo-400 transition-colors bg-white/50 hover:bg-white/60">
        <UploadCloud className="w-16 h-16 text-indigo-500 mb-4 animate-bounce" />
        <p className="text-lg font-medium text-slate-700 text-center">{label}</p>
        <p className="text-sm text-slate-500 mt-2 text-center">Only PDF files are supported</p>
        
        <input 
          type="file" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          multiple={multiple}
          accept={accept}
          onChange={handleFileInput}
        />
      </div>
    </div>
  );
};
