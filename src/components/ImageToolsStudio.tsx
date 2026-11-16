import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Crop,
  Download,
  FileImage,
  GitCompare,
  Grid,
  Info,
  Minimize2,
  RefreshCw,
  RotateCw,
  ScanLine,
  ShieldOff,
  Sliders,
  Stamp,
  Terminal,
  Trash2,
  Workflow,
} from 'lucide-react';
import { FileDropzone } from './FileDropzone.tsx';
import { getTool } from '../core/registry.ts';
import { formatByteSize } from '../core/types.ts';
import type { VirtualFile } from '../core/types.ts';
import {
  downloadVirtualFile,
  downloadVirtualFiles,
  filesToVirtualFiles,
  virtualFileToBlobUrl,
} from '../utils/virtualFileWeb.ts';

type ImageToolId =
  | 'image.compress'
  | 'image.convert'
  | 'image.resize'
  | 'image.crop'
  | 'image.rotate_flip'
  | 'image.watermark'
  | 'image.strip_metadata'
  | 'image.info'
  | 'image.scan_enhance'
  | 'image.grid_sheet'
  | 'image.diff';

interface ImageToolTab {
  id: ImageToolId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const IMAGE_TABS: ImageToolTab[] = [
  { id: 'image.compress', label: 'Kompres', desc: 'Perkecil ukuran JPG/PNG/WebP', icon: Minimize2 },
  { id: 'image.convert', label: 'Konversi Format', desc: 'PNG / JPG / WebP / ICO', icon: RefreshCw },
  { id: 'image.resize', label: 'Resize', desc: 'Ubah dimensi px atau %', icon: Sliders },
  { id: 'image.crop', label: 'Crop / Pas Foto', desc: '1:1, 3:4, 4:6, 16:9, custom', icon: Crop },
  { id: 'image.rotate_flip', label: 'Putar & Balik', desc: 'Rotate 90/180/270 & Flip', icon: RotateCw },
  { id: 'image.watermark', label: 'Watermark', desc: 'Teks watermark pada foto', icon: Stamp },
  { id: 'image.scan_enhance', label: 'Scan Enhancer', desc: 'Bersihkan bayangan foto kertas', icon: ScanLine },
  { id: 'image.grid_sheet', label: 'Grid / KTP Sheet', desc: 'Gabung beberapa foto ke 1 lembar', icon: Grid },
  { id: 'image.diff', label: 'Bandingkan Gambar', desc: 'Visual diff heatmap 2 gambar', icon: GitCompare },
  { id: 'image.strip_metadata', label: 'Hapus EXIF', desc: 'Hapus lokasi GPS & kamera', icon: ShieldOff },
  { id: 'image.info', label: 'Info Gambar', desc: 'Cek resolusi & metadata', icon: Info },
];

interface ImageToolsStudioProps {
  onSendToPipeline?: (files: VirtualFile[]) => void;
}

export const ImageToolsStudio: React.FC<ImageToolsStudioProps> = ({ onSendToPipeline }) => {
  const [activeTool, setActiveTool] = useState<ImageToolId>('image.compress');
  const [inputs, setInputs] = useState<VirtualFile[]>([]);
  const [outputs, setOutputs] = useState<VirtualFile[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [jsonMetadata, setJsonMetadata] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Tool parameters
  const [compressQuality, setCompressQuality] = useState(80);
  const [compressFormat, setCompressFormat] = useState<'keep' | 'jpeg' | 'webp' | 'png'>('keep');
  const [compressMaxWidth, setCompressMaxWidth] = useState<string>('');

  const [convertFormat, setConvertFormat] = useState<'png' | 'jpeg' | 'webp' | 'ico'>('webp');
  const [convertQuality, setConvertQuality] = useState(90);

  const [resizeWidth, setResizeWidth] = useState<string>('1200');
  const [resizeHeight, setResizeHeight] = useState<string>('');
  const [resizeScalePercent, setResizeScalePercent] = useState<string>('');
  const [resizeFit, setResizeFit] = useState<'inside' | 'contain' | 'cover' | 'stretch'>('inside');

  const [cropRatio, setCropRatio] = useState<'1:1' | '3:4' | '4:6' | '4:3' | '16:9' | 'custom'>('3:4');
  const [cropX, setCropX] = useState('0');
  const [cropY, setCropY] = useState('0');
  const [cropW, setCropW] = useState('400');
  const [cropH, setCropH] = useState('400');

  const [rotateAngle, setRotateAngle] = useState<0 | 90 | 180 | 270>(90);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const [wmText, setWmText] = useState('TENGGOO STUDIO');
  const [wmPosition, setWmPosition] = useState<
    'center-diagonal' | 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tiled'
  >('bottom-right');
  const [wmOpacity, setWmOpacity] = useState(0.5);
  const [wmColor, setWmColor] = useState('#ffffff');

  const [scanMode, setScanMode] = useState<'whiten-bg' | 'grayscale-contrast' | 'bw-threshold'>('whiten-bg');
  const [scanContrast, setScanContrast] = useState(45);
  const [scanThreshold, setScanThreshold] = useState(175);

  const [gridCols, setGridCols] = useState(2);
  const [gridRows, setGridRows] = useState(2);
  const [gridPageSize, setGridPageSize] = useState<'A4' | 'Letter'>('A4');

  const [diffThreshold, setDiffThreshold] = useState(25);

  const inputPreviews = useMemo(
    () =>
      inputs.map((file) => ({
        name: file.name,
        size: file.bytes.byteLength,
        url: virtualFileToBlobUrl(file),
      })),
    [inputs],
  );

  const outputPreviews = useMemo(
    () =>
      outputs.map((file) => ({
        file,
        isImage: file.mimeType.startsWith('image/') && !file.mimeType.includes('icon'),
        url: virtualFileToBlobUrl(file),
      })),
    [outputs],
  );

  useEffect(() => {
    return () => {
      inputPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [inputPreviews]);

  useEffect(() => {
    return () => {
      outputPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [outputPreviews]);

  const currentParams = useMemo<Record<string, unknown>>(() => {
    switch (activeTool) {
      case 'image.compress':
        return {
          quality: compressQuality,
          format: compressFormat,
          ...(compressMaxWidth.trim() ? { maxWidth: Number(compressMaxWidth) } : {}),
        };
      case 'image.convert':
        return { targetFormat: convertFormat, quality: convertQuality };
      case 'image.resize':
        return {
          ...(resizeWidth.trim() ? { width: Number(resizeWidth) } : {}),
          ...(resizeHeight.trim() ? { height: Number(resizeHeight) } : {}),
          ...(resizeScalePercent.trim() ? { scalePercent: Number(resizeScalePercent) } : {}),
          fit: resizeFit,
        };
      case 'image.crop':
        return cropRatio === 'custom'
          ? {
              aspectRatio: 'custom',
              x: Number(cropX || 0),
              y: Number(cropY || 0),
              width: Number(cropW || 400),
              height: Number(cropH || 400),
            }
          : { aspectRatio: cropRatio };
      case 'image.rotate_flip':
        return { angle: rotateAngle, flipHorizontal: flipH, flipVertical: flipV };
      case 'image.watermark':
        return { text: wmText, position: wmPosition, opacity: wmOpacity, color: wmColor };
      case 'image.scan_enhance':
        return { mode: scanMode, contrast: scanContrast, threshold: scanThreshold };
      case 'image.grid_sheet':
        return { columns: gridCols, rows: gridRows, pageSize: gridPageSize };
      case 'image.diff':
        return { threshold: diffThreshold };
      case 'image.strip_metadata':
      case 'image.info':
      default:
        return {};
    }
  }, [
    activeTool,
    compressQuality,
    compressFormat,
    compressMaxWidth,
    convertFormat,
    convertQuality,
    resizeWidth,
    resizeHeight,
    resizeScalePercent,
    resizeFit,
    cropRatio,
    cropX,
    cropY,
    cropW,
    cropH,
    rotateAngle,
    flipH,
    flipV,
    wmText,
    wmPosition,
    wmOpacity,
    wmColor,
    scanMode,
    scanContrast,
    scanThreshold,
    gridCols,
    gridRows,
    gridPageSize,
    diffThreshold,
  ]);

  const cliCommand = useMemo(() => {
    const fileArgs = inputs.length > 0 ? inputs.map((f) => `"${f.name}"`).join(' ') : 'image.png';
    const paramsJson = JSON.stringify(currentParams);
    return `node --no-warnings --experimental-strip-types src/agent/cli.ts run ${activeTool} -i ${fileArgs} -o ./output --params '${paramsJson}' --json`;
  }, [activeTool, inputs, currentParams]);

  const handleFilesDrop = async (files: File[]) => {
    const vFiles = await filesToVirtualFiles(files);
    setInputs((prev) => [...prev, ...vFiles]);
    setOutputs([]);
    setSummary('');
    setJsonMetadata('');
    setError(null);
  };

  const handleRunTool = async () => {
    const tool = getTool(activeTool);
    if (!tool || inputs.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setJsonMetadata('');

    try {
      const res = await tool.execute(inputs, currentParams);
      setOutputs(res.files);
      setSummary(res.summary);
      if (activeTool === 'image.info' && res.files[0]) {
        setJsonMetadata(new TextDecoder('utf-8').decode(res.files[0].bytes));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseOutputsAsInputs = () => {
    const imageOutputs = outputs.filter((f) => f.mimeType.startsWith('image/'));
    if (imageOutputs.length === 0) return;
    setInputs(imageOutputs);
    setOutputs([]);
    setSummary('Output gambar dimuat sebagai input baru. Pilih tool berikutnya untuk melanjutkan chain.');
  };

  const handleCopyCli = async () => {
    await navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold uppercase tracking-wider">
          <FileImage size={14} /> Image Processing Suite
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Image Tools Studio</h2>
        <p className="text-slate-500 text-sm sm:text-base">
          Kompres, konversi format, resize, crop pas foto, watermark, dan hapus EXIF 100% lokal di perangkat Anda
        </p>
      </div>

      {/* Sub-tool Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/80 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200/80 shadow-sm">
        {IMAGE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTool(tab.id);
                setError(null);
              }}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                active
                  ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-sm'
                  : 'border-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{tab.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{tab.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dropzone */}
      <FileDropzone
        onFilesDrop={handleFilesDrop}
        multiple={true}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        label="Drop atau pilih gambar (PNG, JPG, WebP)"
        helpText="Mendukung batch multiple file sekaligus"
      />

      {inputs.length > 0 && (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* Input Queue */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-700">
              File Input ({inputs.length} gambar)
            </h3>
            <button
              type="button"
              onClick={() => {
                setInputs([]);
                setOutputs([]);
                setSummary('');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50"
            >
              <Trash2 size={14} /> Hapus Semua
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {inputPreviews.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="relative group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="aspect-square flex items-center justify-center p-2 bg-slate-100">
                  <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="p-2 bg-white border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400">{formatByteSize(item.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInputs((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Hapus gambar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Tool Specific Controls */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-4">
            {activeTool === 'image.compress' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kualitas Kompresi ({compressQuality}%)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={compressQuality}
                    onChange={(e) => setCompressQuality(Number(e.target.value))}
                    className="w-full accent-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Format Output</label>
                  <select
                    value={compressFormat}
                    onChange={(e) => setCompressFormat(e.target.value as typeof compressFormat)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="keep">Pertahankan Format Asli</option>
                    <option value="jpeg">JPEG (Paling Ringan)</option>
                    <option value="webp">WebP (Modern Web)</option>
                    <option value="png">PNG (Lossless)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lebar Maksimal (px, opsional)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 1600"
                    value={compressMaxWidth}
                    onChange={(e) => setCompressMaxWidth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>
            )}

            {activeTool === 'image.convert' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Format Tujuan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['png', 'jpeg', 'webp', 'ico'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setConvertFormat(fmt)}
                        className={`py-2 rounded-xl border text-xs font-bold uppercase ${
                          convertFormat === fmt
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kualitas JPEG / WebP ({convertQuality}%)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={convertQuality}
                    onChange={(e) => setConvertQuality(Number(e.target.value))}
                    className="w-full accent-teal-600"
                  />
                </div>
              </div>
            )}

            {activeTool === 'image.resize' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lebar (px)</label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={resizeWidth}
                    onChange={(e) => setResizeWidth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tinggi (px)</label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={resizeHeight}
                    onChange={(e) => setResizeHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Skala (%)</label>
                  <input
                    type="number"
                    placeholder="Misal: 50"
                    value={resizeScalePercent}
                    onChange={(e) => setResizeScalePercent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mode Fit</label>
                  <select
                    value={resizeFit}
                    onChange={(e) => setResizeFit(e.target.value as typeof resizeFit)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="inside">Inside (Proporsional)</option>
                    <option value="contain">Contain (Letterbox)</option>
                    <option value="cover">Cover (Crop Penuh)</option>
                    <option value="stretch">Stretch</option>
                  </select>
                </div>
              </div>
            )}

            {activeTool === 'image.crop' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Rasio Potong (Center Crop)</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: '1:1', label: '1:1 Square' },
                    { id: '3:4', label: '3:4 Pas Foto' },
                    { id: '4:6', label: '4:6 Pas Foto' },
                    { id: '4:3', label: '4:3 Standar' },
                    { id: '16:9', label: '16:9 Wide' },
                    { id: 'custom', label: 'Custom px' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCropRatio(item.id as typeof cropRatio)}
                      className={`py-2 px-2 rounded-xl border text-xs font-semibold ${
                        cropRatio === item.id
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {cropRatio === 'custom' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <input type="number" placeholder="X" value={cropX} onChange={(e) => setCropX(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                    <input type="number" placeholder="Y" value={cropY} onChange={(e) => setCropY(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                    <input type="number" placeholder="Width" value={cropW} onChange={(e) => setCropW(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                    <input type="number" placeholder="Height" value={cropH} onChange={(e) => setCropH(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                  </div>
                )}
              </div>
            )}

            {activeTool === 'image.rotate_flip' && (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sudut Rotasi</label>
                  <div className="flex gap-2">
                    {([0, 90, 180, 270] as const).map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRotateAngle(deg)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                          rotateAngle === deg
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer mt-4">
                  <input type="checkbox" checked={flipH} onChange={(e) => setFlipH(e.target.checked)} className="accent-teal-600" />
                  Flip Horizontal
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer mt-4">
                  <input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} className="accent-teal-600" />
                  Flip Vertical
                </label>
              </div>
            )}

            {activeTool === 'image.watermark' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teks Watermark</label>
                  <input
                    type="text"
                    value={wmText}
                    onChange={(e) => setWmText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Posisi</label>
                  <select
                    value={wmPosition}
                    onChange={(e) => setWmPosition(e.target.value as typeof wmPosition)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="bottom-right">Kanan Bawah</option>
                    <option value="bottom-left">Kiri Bawah</option>
                    <option value="top-right">Kanan Atas</option>
                    <option value="top-left">Kiri Atas</option>
                    <option value="center">Tengah</option>
                    <option value="center-diagonal">Diagonal Tengah</option>
                    <option value="tiled">Pola Kisi (Tiled)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opacity ({Math.round(wmOpacity * 100)}%)</label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(Number(e.target.value))}
                    className="w-full accent-teal-600 mt-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Warna</label>
                  <input
                    type="color"
                    value={wmColor}
                    onChange={(e) => setWmColor(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTool === 'image.strip_metadata' && (
              <p className="text-xs text-slate-600">
                Menghapus seluruh metadata EXIF, koordinat GPS, model kamera, dan timestamp dengan merender ulang piksel secara bersih.
              </p>
            )}

            {activeTool === 'image.scan_enhance' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mode Scanner</label>
                  <select
                    value={scanMode}
                    onChange={(e) => setScanMode(e.target.value as typeof scanMode)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="whiten-bg">Whiten Background (Dokumen Berwarna)</option>
                    <option value="grayscale-contrast">Grayscale High Contrast</option>
                    <option value="bw-threshold">Hitam Putih Tajam (B&W)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontras ({scanContrast})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={scanContrast}
                    onChange={(e) => setScanContrast(Number(e.target.value))}
                    className="w-full accent-teal-600 mt-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ambang Putih ({scanThreshold})
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={240}
                    value={scanThreshold}
                    onChange={(e) => setScanThreshold(Number(e.target.value))}
                    className="w-full accent-teal-600 mt-2"
                  />
                </div>
              </div>
            )}

            {activeTool === 'image.grid_sheet' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kolom</label>
                  <input type="number" min={1} max={6} value={gridCols} onChange={(e) => setGridCols(Number(e.target.value) || 2)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Baris</label>
                  <input type="number" min={1} max={8} value={gridRows} onChange={(e) => setGridRows(Number(e.target.value) || 2)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Kertas</label>
                  <select value={gridPageSize} onChange={(e) => setGridPageSize(e.target.value as 'A4' | 'Letter')} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm">
                    <option value="A4">A4 (150 DPI)</option>
                    <option value="Letter">Letter (150 DPI)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTool === 'image.diff' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Masukkan tepat <strong>2 gambar</strong> di atas untuk melihat area piksel yang berbeda (ditandai merah).
                </p>
                <div className="max-w-xs">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sensitivitas Threshold ({diffThreshold})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={150}
                    value={diffThreshold}
                    onChange={(e) => setDiffThreshold(Number(e.target.value))}
                    className="w-full accent-teal-600"
                  />
                </div>
              </div>
            )}

            {activeTool === 'image.info' && (
              <p className="text-xs text-slate-600">
                Membaca dimensi piksel, rasio aspek, MIME type, dan ukuran file untuk semua gambar yang dipilih.
              </p>
            )}
          </div>

          {/* Agent CLI Snippet */}
          <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Terminal size={14} className="text-teal-400 shrink-0" />
              <code className="whitespace-nowrap">{cliCommand}</code>
            </div>
            <button
              type="button"
              onClick={handleCopyCli}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"
            >
              {copiedCli ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedCli ? 'Tersalin' : 'Salin CLI'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleRunTool}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-bold shadow-md disabled:opacity-50"
          >
            {isProcessing ? 'Memproses Gambar...' : `Jalankan ${IMAGE_TABS.find((t) => t.id === activeTool)?.label}`}
          </button>

          {/* Outputs Section */}
          {outputs.length > 0 && (
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Hasil Pemrosesan</h4>
                  <p className="text-xs text-emerald-700 font-medium">{summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {outputs.some((f) => f.mimeType.startsWith('image/')) && (
                    <button
                      type="button"
                      onClick={handleUseOutputsAsInputs}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold"
                    >
                      <ArrowRight size={14} /> Lanjutkan ke Tool Gambar Lain
                    </button>
                  )}
                  {onSendToPipeline && (
                    <button
                      type="button"
                      onClick={() => onSendToPipeline(outputs)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold"
                    >
                      <Workflow size={14} /> Kirim ke Pipeline Studio
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadVirtualFiles(outputs, 'tenggoo_images.zip')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >
                    <Download size={14} />
                    <span>{outputs.length > 1 ? 'Download Semua (ZIP)' : 'Download Hasil'}</span>
                  </button>
                </div>
              </div>

              {jsonMetadata ? (
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 text-xs overflow-x-auto max-h-80">
                  {jsonMetadata}
                </pre>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {outputPreviews.map((item, idx) => (
                    <div key={`${item.file.name}-${idx}`} className="rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden">
                      <div className="aspect-square flex items-center justify-center p-2 bg-white">
                        {item.isImage ? (
                          <img src={item.url} alt={item.file.name} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <FileImage size={32} className="text-teal-500" />
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between gap-2 bg-white border-t border-slate-100">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700 truncate">{item.file.name}</p>
                          <p className="text-[10px] text-slate-500">{formatByteSize(item.file.bytes.byteLength)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadVirtualFile(item.file)}
                          className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          title="Download file"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
