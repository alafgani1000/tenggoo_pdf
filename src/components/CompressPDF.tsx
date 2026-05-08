import { useState, useCallback, useRef, useEffect } from 'react';
import { FileDropzone } from './FileDropzone';
import { FileText, Zap, Settings } from 'lucide-react';

type Quality = 'low' | 'medium' | 'high' | 'pro';

const QUALITY_CONFIG: Record<Quality, { label: string; desc: string }> = {
  low: {
    label: 'Maximum Shrink',
    desc: 'Smallest size priority',
  },
  medium: {
    label: 'Balanced',
    desc: 'Good quality and size',
  },
  high: {
    label: 'High',
    desc: 'Sharper output, larger size risk',
  },
  pro: {
    label: 'Pro',
    desc: 'Best quality, may reduce less',
  },
};

const formatSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

export const CompressPDF: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState<Quality>('medium');
  const [progress, setProgress] = useState(0);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getFriendlyError = useCallback((details?: string) => {
    const text = (details || '').toLowerCase();
    if (
      text.includes('password') ||
      text.includes('encrypted') ||
      text.includes('invalidfileaccess') ||
      text.includes('authentication')
    ) {
      return 'PDF ini kemungkinan terkunci/password-protected. Buka proteksinya dulu lalu coba kompres lagi.';
    }
    if (text.includes('syntaxerror') || text.includes('corrupt') || text.includes('damaged')) {
      return 'File PDF terlihat rusak atau tidak valid. Coba buka filenya dulu untuk memastikan bisa dibaca.';
    }
    if (text.includes('rangeerror') || text.includes('memory') || text.includes('out of bounds')) {
      return 'Ukuran file terlalu berat untuk diproses di browser ini. Coba pilih kualitas lebih rendah atau gunakan file yang lebih kecil.';
    }
    if (text.includes('undefinedfilename') || text.includes('ioerror') || text.includes('undefined')) {
      return 'PDF tidak dapat diproses karena format internalnya tidak didukung oleh engine kompresi saat ini.';
    }
    return 'Kompresi gagal diproses. Pastikan PDF tidak terenkripsi dan file tidak rusak, lalu coba lagi.';
  }, []);

  const handleFilesDrop = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setOriginalSize(files[0].size);
      setCompressedSize(null);
      setError(null);
      setResultNote(null);
      setProgress(0);
    }
  }, []);

  const getQualityPlan = useCallback((start: Quality): Quality[] => {
    if (start === 'pro') return ['pro', 'high', 'medium', 'low'];
    if (start === 'high') return ['high', 'medium', 'low'];
    if (start === 'medium') return ['medium', 'low'];
    return ['low'];
  }, []);

  const runWorkerCompress = useCallback(
    (fileBuffer: ArrayBuffer, qualityToRun: Quality, progressStart: number, progressEnd: number) =>
      new Promise<Uint8Array>((resolve, reject) => {
        workerRef.current?.terminate();
        workerRef.current = new Worker(new URL('../workers/pdfCompress.worker.ts', import.meta.url), {
          type: 'module',
        });
        const worker = workerRef.current;

        worker.onmessage = (workerEvent: MessageEvent) => {
          const data = workerEvent.data as
            | { type: 'progress'; progress: number }
            | { type: 'success'; outputBuffer: ArrayBuffer }
            | { type: 'error'; message: string; details?: string };

          if (data.type === 'progress') {
            const localProgress = Math.max(0, Math.min(100, Math.round(data.progress)));
            const mappedProgress = progressStart + ((progressEnd - progressStart) * localProgress) / 100;
            setProgress(Math.round(mappedProgress));
            return;
          }

          if (data.type === 'success') {
            resolve(new Uint8Array(data.outputBuffer));
            worker.terminate();
            return;
          }

          if (data.type === 'error') {
            reject(new Error(data.details || data.message));
            worker.terminate();
          }
        };

        worker.onerror = (workerError) => {
          reject(new Error(workerError.message || 'Worker crashed during PDF compression.'));
          worker.terminate();
        };

        worker.postMessage({
          type: 'compress',
          fileBuffer,
          quality: qualityToRun,
        });
      }),
    []
  );

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setCompressedSize(null);
    setResultNote(null);
    setProgress(0);

    try {
      const fileBuffer = await file.arrayBuffer();
      const plans = getQualityPlan(quality);
      let bestOutput: Uint8Array | null = null;
      let bestQuality: Quality | null = null;

      for (let i = 0; i < plans.length; i++) {
        const q = plans[i];
        const start = (i / plans.length) * 100;
        const end = ((i + 1) / plans.length) * 100;
        const output = await runWorkerCompress(fileBuffer, q, start, end);

        if (!bestOutput || output.byteLength < bestOutput.byteLength) {
          bestOutput = output;
          bestQuality = q;
        }
        if (output.byteLength < file.size) {
          break;
        }
      }

      setProgress(100);

      if (!bestOutput) {
        throw new Error('No output generated by compressor.');
      }

      setCompressedSize(bestOutput.byteLength);

      if (bestOutput.byteLength >= file.size) {
        setResultNote('File ini sudah sangat optimal. Tidak ada hasil kompres yang lebih kecil dari file asli.');
        return;
      }

      const outputCopy = new Uint8Array(bestOutput.byteLength);
      outputCopy.set(bestOutput);
      const blob = new Blob([outputCopy], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (bestQuality && bestQuality !== quality) {
        setResultNote(`Agar ukuran mengecil, sistem otomatis memakai profil ${QUALITY_CONFIG[bestQuality].label}.`);
      }
    } catch (err) {
      console.error('Compression error:', err);
      const details = err instanceof Error ? err.message : String(err);
      setError(getFriendlyError(details));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const savings =
    originalSize && compressedSize
      ? (((originalSize - compressedSize) / originalSize) * 100).toFixed(1)
      : null;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 animate-float" style={{ animationDuration: '9s' }}>
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Compress PDF</h2>
        <p className="text-slate-500">Fokus mengecilkan ukuran PDF, dengan fallback otomatis jika perlu</p>
      </div>

      {!file ? (
        <FileDropzone onFilesDrop={handleFilesDrop} multiple={false} label="Drop a PDF to compress" />
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <FileText className="text-amber-500 shrink-0" size={24} />
              <div>
                <p className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-400">{originalSize && formatSize(originalSize)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setOriginalSize(null);
                setCompressedSize(null);
                setError(null);
                setResultNote(null);
              }}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              Change File
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings size={16} className="text-slate-500" />
              <p className="text-sm font-semibold text-slate-700">Compression Profile</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.entries(QUALITY_CONFIG) as [Quality, typeof QUALITY_CONFIG[Quality]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  disabled={isProcessing}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    quality === key
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <p className={`text-sm font-bold ${quality === key ? 'text-amber-700' : 'text-slate-700'}`}>
                    {cfg.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Processing pages...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {compressedSize !== null && originalSize && !isProcessing && (
            <div
              className={`p-4 rounded-xl border text-center ${
                compressedSize < originalSize ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}
            >
              {compressedSize < originalSize ? (
                <>
                  <p className="text-sm font-semibold text-green-800">Compression Complete!</p>
                  <p className="text-xs text-green-600 mt-1">
                    {formatSize(originalSize)} -&gt; {formatSize(compressedSize)}
                    <span className="font-bold ml-2">({savings}% smaller)</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-blue-800">Done - file already optimized</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Output: {formatSize(compressedSize)} (try Lower quality for smaller size)
                  </p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {resultNote && !error && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-700">{resultNote}</p>
            </div>
          )}

          <div className="text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <strong>How it works:</strong> App akan mencoba profil yang dipilih, lalu otomatis turun ke profil lebih agresif jika hasilnya belum lebih kecil. File hanya didownload jika ukurannya benar-benar mengecil.
          </div>

          <button
            onClick={handleCompress}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3 px-6 rounded-xl font-medium transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Compressing... {progress}%</span>
            ) : (
              <>
                <Zap size={20} />
                Compress PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
