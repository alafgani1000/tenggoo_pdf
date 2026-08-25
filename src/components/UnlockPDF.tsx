import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDropzone } from './FileDropzone';
import { pdfjsLib, renderPageToCanvas } from '../utils/pdfjs';
import { 
  KeyRound, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export const UnlockPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fileNeedsPassword, setFileNeedsPassword] = useState<boolean | null>(null);

  const handleFilesDrop = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setPassword('');
    setStatusMessage(null);
    setFileNeedsPassword(null);

    // Test whether file is encrypted or plain
    try {
      const buffer = await selected.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      await loadingTask.promise;
      setFileNeedsPassword(false);
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      const msg = String(errorObj?.name || errorObj?.message || err).toLowerCase();
      if (msg.includes('password') || msg.includes('encrypted')) {
        setFileNeedsPassword(true);
      } else {
        setFileNeedsPassword(true);
      }
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      
      // Load document using pdfjs with password
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(buffer), 
        password: password.trim() 
      });

      const pdfDocProxy = await loadingTask.promise.catch((err: unknown) => {
        const errorObj = err as { name?: string; message?: string };
        const errorText = String(errorObj?.name || errorObj?.message || err).toLowerCase();
        if (errorText.includes('password') || errorText.includes('encrypt') || errorText.includes('incorrect')) {
          throw new Error('Password salah. Silakan periksa kembali kata sandi dokumen.');
        }
        throw err;
      });

      const numPages = pdfDocProxy.numPages;
      const outputDoc = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        const canvas = await renderPageToCanvas(pdfDocProxy, i, 2.0); // high quality 2x render
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
        const embeddedImage = await outputDoc.embedJpg(imageBytes);
        
        const page = outputDoc.addPage([canvas.width / 2.0, canvas.height / 2.0]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: canvas.width / 2.0,
          height: canvas.height / 2.0,
        });
      }

      const pdfBytes = await outputDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_unlocked.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: 'Berhasil membuka proteksi! File versi bebas password telah didownload.',
      });
    } catch (err: unknown) {
      console.error('Unlock error:', err);
      const errorObj = err as { message?: string };
      setStatusMessage({
        type: 'error',
        text: errorObj?.message || 'Gagal membuka proteksi PDF. Pastikan password benar.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-1">
          <KeyRound size={14} /> Password Removal & Decryptor
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Unlock PDF Password</h2>
        <p className="text-slate-500">
          Hapus kata sandi dari dokumen PDF terproteksi agar bisa dibuka langsung tanpa perlu memasukkan password lagi
        </p>
      </div>

      {!file ? (
        <FileDropzone 
          onFilesDrop={handleFilesDrop} 
          multiple={false} 
          label="Pilih atau Drop file PDF terkunci" 
        />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* File Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                <Lock size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                  {fileNeedsPassword === false && ' • (Dokumen tidak terenkripsi)'}
                  {fileNeedsPassword === true && ' • (Terdeteksi Terproteksi)'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setPassword('');
                setStatusMessage(null);
                setFileNeedsPassword(null);
              }}
              className="text-sm text-rose-600 hover:text-rose-700 font-medium px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
            >
              Ganti File
            </button>
          </div>

          {/* Privacy Security Callout */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
            <ShieldCheck size={18} className="shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">100% Offline & Aman</p>
              <p className="text-emerald-700">
                Password dan dokumen diproses secara lokal di perangkat Anda. Data tidak pernah dikirimkan ke server manapun.
              </p>
            </div>
          </div>

          {/* Password Input Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50/80 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Masukkan Password Dokumen
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUnlock();
                  }}
                  placeholder="Ketik password PDF di sini..."
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm font-medium bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Masukkan password yang biasa digunakan untuk membuka PDF tersebut satu kali untuk melepas proteksinya permanen.
              </p>
            </div>
          </div>

          {/* Feedback Message */}
          {statusMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={20} className="text-green-600 shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleUnlock}
            disabled={isProcessing || !password.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white py-3.5 px-6 rounded-xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Membuka proteksi PDF...</span>
            ) : (
              <>
                <Unlock size={18} />
                <span>Buka Proteksi & Simpan File Bebas Password</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
