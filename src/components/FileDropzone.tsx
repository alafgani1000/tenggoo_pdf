import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileDropzoneProps {
  onFilesDrop: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  helpText?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesDrop,
  multiple = true,
  accept = 'application/pdf',
  label = 'Drag & drop PDF files here, or click to select',
  helpText,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      // Handle comma-separated accept string (e.g. "image/png, image/jpeg")
      const acceptList = accept.split(',').map((a) => a.trim());
      const files = Array.from(e.dataTransfer.files).filter(
        (f) =>
          accept === '*' ||
          acceptList.includes(f.type) ||
          acceptList.some((a) => f.name.toLowerCase().endsWith(a.toLowerCase())),
      );
      if (files.length > 0) {
        if (!multiple) {
          onFilesDrop([files[0]]);
        } else {
          onFilesDrop(files);
        }
      }
    },
    [onFilesDrop, multiple, accept],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
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
      onDragLeave={handleDragLeave}
      className="w-full relative group cursor-pointer"
    >
      <div
        className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-10 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/70 shadow-sm'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-base font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-1">
          {helpText ||
            (accept === 'application/pdf'
              ? 'Only PDF files are supported'
              : `Supported files: ${accept}`)}
        </p>

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
