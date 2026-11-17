import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  FileText,
  FolderOpen,
  QrCode,
  ShieldCheck,
  Table,
  Terminal,
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

export type UtilityTab =
  | 'util.qr_generate'
  | 'util.md_to_pdf'
  | 'util.table_to_pdf'
  | 'util.zip_pack'
  | 'util.zip_unpack'
  | 'util.hash_checksum';

interface UtilityToolsStudioProps {
  activeToolId?: UtilityTab;
  onSelectToolId?: (id: UtilityTab) => void;
  onSendToPipeline?: (files: VirtualFile[]) => void;
}

const SAMPLE_MARKDOWN = `# Laporan Ringkas Proyek

Dokumen ini dihasilkan langsung secara lokal melalui utilitas **Markdown to PDF**.

## Keunggulan Utama
- 100% Client-side & Offline tanpa unggah server
- Dapat langsung dipanggil oleh AI Agent (Antigravity, Codex, MCP)
- Output PDF dapat langsung diteruskan ke Watermark, Stempel QR, atau Nomor Halaman

---

### Catatan Penutup
Silakan ubah teks ini sesuka hati lalu klik **Generate PDF**.`;

const SAMPLE_TABLE_CSV = `Produk,Kategori,Qty,Harga
WorkTool Pro License,Software,2,$49
PDF Audit Service,Consulting,1,$120
Image Batch Pack,Add-on,5,$15`;

export const UtilityToolsStudio: React.FC<UtilityToolsStudioProps> = ({
  activeToolId,
  onSelectToolId,
  onSendToPipeline,
}) => {
  const [internalTool, setInternalTool] = useState<UtilityTab>('util.qr_generate');
  const activeTool = activeToolId ?? internalTool;
  const handleSelectTool = (id: UtilityTab) => {
    setInternalTool(id);
    onSelectToolId?.(id);
    setOutputs([]);
    setSummary('');
    setHashJsonOutput('');
    setError(null);
  };
  const [inputs, setInputs] = useState<VirtualFile[]>([]);
  const [outputs, setOutputs] = useState<VirtualFile[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // QR parameters
  const [qrText, setQrText] = useState('https://worktool.local');
  const [qrSize, setQrSize] = useState(320);
  const [qrDark, setQrDark] = useState('#0f172a');
  const [qrLight, setQrLight] = useState('#ffffff');

  // MD -> PDF parameters
  const [mdText, setMdText] = useState(SAMPLE_MARKDOWN);
  const [mdTitle, setMdTitle] = useState('Dokumen Kerja');
  const [mdPageSize, setMdPageSize] = useState<'A4' | 'Letter'>('A4');
  const [mdFontSize, setMdFontSize] = useState(11);

  // ZIP & Table & Hash parameters
  const [archiveName, setArchiveName] = useState('worktool_bundle.zip');
  const [zipFilter, setZipFilter] = useState('');
  const [tableData, setTableData] = useState(SAMPLE_TABLE_CSV);
  const [tableTitle, setTableTitle] = useState('Laporan Tabel Data');
  const [tableOrientation, setTableOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-1' | 'SHA-512'>('SHA-256');
  const [hashJsonOutput, setHashJsonOutput] = useState('');

  const previewUrl = useMemo(() => {
    const first = outputs[0];
    if (!first) return null;
    if (first.mimeType === 'image/png' || first.mimeType === 'application/pdf') {
      return virtualFileToBlobUrl(first);
    }
    return null;
  }, [outputs]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const cliCommand = useMemo(() => {
    if (activeTool === 'util.qr_generate') {
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.qr_generate --text "${qrText}" --size ${qrSize} -o qrcode.png --json`;
    }
    if (activeTool === 'util.md_to_pdf') {
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.md_to_pdf -i notes.md -o document.pdf --pageSize ${mdPageSize} --json`;
    }
    if (activeTool === 'util.table_to_pdf') {
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.table_to_pdf -i data.csv -o table_report.pdf --orientation ${tableOrientation} --json`;
    }
    if (activeTool === 'util.zip_pack') {
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.zip_pack -i file1.pdf file2.png -o "${archiveName}" --json`;
    }
    if (activeTool === 'util.hash_checksum') {
      return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.hash_checksum -i file.pdf --algorithm ${hashAlgorithm} --json`;
    }
    return `node --no-warnings --experimental-strip-types src/agent/cli.ts run util.zip_unpack -i bundle.zip -o ./extracted --json`;
  }, [activeTool, qrText, qrSize, mdPageSize, tableOrientation, archiveName, hashAlgorithm]);

  const handleFilesDrop = async (files: File[]) => {
    const vFiles = await filesToVirtualFiles(files);
    if (activeTool === 'util.md_to_pdf' && vFiles[0]) {
      setMdText(new TextDecoder('utf-8').decode(vFiles[0].bytes));
    } else if (activeTool === 'util.table_to_pdf' && vFiles[0]) {
      setTableData(new TextDecoder('utf-8').decode(vFiles[0].bytes));
    }
    setInputs(
      activeTool === 'util.zip_pack' || activeTool === 'util.hash_checksum'
        ? [...inputs, ...vFiles]
        : vFiles,
    );
    setOutputs([]);
    setHashJsonOutput('');
    setError(null);
  };

  const handleRun = async () => {
    const tool = getTool(activeTool);
    if (!tool) return;
    setIsProcessing(true);
    setError(null);
    setHashJsonOutput('');
    try {
      let res;
      if (activeTool === 'util.qr_generate') {
        res = await tool.execute([], {
          text: qrText,
          size: qrSize,
          darkColor: qrDark,
          lightColor: qrLight,
        });
      } else if (activeTool === 'util.md_to_pdf') {
        res = await tool.execute([], {
          markdown: mdText,
          title: mdTitle,
          pageSize: mdPageSize,
          fontSize: mdFontSize,
        });
      } else if (activeTool === 'util.table_to_pdf') {
        res = await tool.execute([], {
          data: tableData,
          title: tableTitle,
          orientation: tableOrientation,
        });
      } else if (activeTool === 'util.zip_pack') {
        res = await tool.execute(inputs, { archiveName });
      } else if (activeTool === 'util.hash_checksum') {
        res = await tool.execute(inputs, { algorithm: hashAlgorithm });
        if (res.files[0]) {
          setHashJsonOutput(new TextDecoder('utf-8').decode(res.files[0].bytes));
        }
      } else {
        res = await tool.execute(inputs, {
          ...(zipFilter.trim() ? { filterExtensions: zipFilter.trim() } : {}),
        });
      }
      setOutputs(res.files);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider">
          <QrCode size={14} /> Document & Archive Utilities
        </div>
        <h2 className="text-3xl font-bold text-slate-800">
          {activeToolId
            ? (
                {
                  'util.qr_generate': 'QR Code Generator',
                  'util.md_to_pdf': 'Markdown to PDF',
                  'util.table_to_pdf': 'CSV / JSON Table to PDF',
                  'util.zip_pack': 'Pack ke ZIP',
                  'util.zip_unpack': 'Ekstrak ZIP',
                  'util.hash_checksum': 'Hash Checksum (SHA-256 / SHA-512)',
                } as Record<UtilityTab, string>
              )[activeTool]
            : 'Utilities & Generators'}
        </h2>
        <p className="text-slate-500 text-sm sm:text-base">
          Buat QR Code siap tempel ke PDF, ubah Markdown/Tabel menjadi PDF rapi, dan kelola arsip ZIP & checksum secara lokal
        </p>
      </div>

      {/* Tabs (hidden when Sidebar controls the active tool) */}
      {!activeToolId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/80 shadow-sm">
          {[
            { id: 'util.qr_generate', label: 'QR Code Generator', icon: QrCode },
            { id: 'util.md_to_pdf', label: 'Markdown to PDF', icon: FileText },
            { id: 'util.table_to_pdf', label: 'Table CSV/JSON -> PDF', icon: Table },
            { id: 'util.zip_pack', label: 'Pack ke ZIP', icon: Archive },
            { id: 'util.zip_unpack', label: 'Ekstrak ZIP', icon: FolderOpen },
            { id: 'util.hash_checksum', label: 'Hash SHA-256', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTool(tab.id as UtilityTab)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                  active
                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm'
                    : 'border-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
        {activeTool === 'util.qr_generate' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">URL / Teks QR Code</label>
              <input
                type="text"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran (px)</label>
              <input
                type="number"
                min={64}
                max={2048}
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value) || 320)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Modul</label>
                <input type="color" value={qrDark} onChange={(e) => setQrDark(e.target.value)} className="w-full h-10 rounded-xl border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Latar</label>
                <input type="color" value={qrLight} onChange={(e) => setQrLight(e.target.value)} className="w-full h-10 rounded-xl border border-slate-300 cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {activeTool === 'util.md_to_pdf' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Dokumen</label>
                <input type="text" value={mdTitle} onChange={(e) => setMdTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Kertas</label>
                <select value={mdPageSize} onChange={(e) => setMdPageSize(e.target.value as 'A4' | 'Letter')} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Font (pt)</label>
                <input type="number" min={8} max={24} value={mdFontSize} onChange={(e) => setMdFontSize(Number(e.target.value) || 11)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Isi Markdown / Teks</label>
                <label className="text-xs font-semibold text-amber-700 cursor-pointer hover:underline">
                  Muat dari file .md / .txt
                  <input
                    type="file"
                    accept=".md,.txt,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFilesDrop(Array.from(e.target.files));
                    }}
                  />
                </label>
              </div>
              <textarea
                rows={10}
                value={mdText}
                onChange={(e) => setMdText(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        )}

        {activeTool === 'util.table_to_pdf' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Tabel Laporan</label>
                <input type="text" value={tableTitle} onChange={(e) => setTableTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Orientasi Kertas</label>
                <select value={tableOrientation} onChange={(e) => setTableOrientation(e.target.value as 'portrait' | 'landscape')} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape (Kolom Lebar)</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Data CSV atau JSON Array</label>
                <label className="text-xs font-semibold text-amber-700 cursor-pointer hover:underline">
                  Muat file .csv / .json
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFilesDrop(Array.from(e.target.files));
                    }}
                  />
                </label>
              </div>
              <textarea
                rows={8}
                value={tableData}
                onChange={(e) => setTableData(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        )}

        {(activeTool === 'util.zip_pack' || activeTool === 'util.zip_unpack' || activeTool === 'util.hash_checksum') && (
          <div className="space-y-4">
            <FileDropzone
              onFilesDrop={handleFilesDrop}
              multiple={activeTool !== 'util.zip_unpack'}
              accept={activeTool === 'util.zip_unpack' ? '.zip,application/zip' : '*'}
              label={
                activeTool === 'util.zip_pack'
                  ? 'Drop file apa saja untuk dikemas ke ZIP'
                  : activeTool === 'util.hash_checksum'
                    ? 'Drop file apa saja untuk dihitung checksum SHA-256/SHA-512'
                    : 'Drop file .zip untuk diekstrak'
              }
              helpText={activeTool === 'util.zip_pack' ? 'Mendukung PDF, gambar, teks, dll.' : '100% lokal di perangkat Anda'}
            />
            {inputs.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{inputs.length} file dipilih</span>
                  <button type="button" onClick={() => setInputs([])} className="text-rose-600">Reset</button>
                </div>
                <div className="text-slate-500 truncate">{inputs.map((f) => f.name).join(', ')}</div>
              </div>
            )}
            {activeTool === 'util.zip_pack' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama File ZIP</label>
                <input type="text" value={archiveName} onChange={(e) => setArchiveName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
              </div>
            )}
            {activeTool === 'util.zip_unpack' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Filter Ekstensi (opsional, misal: pdf,png)</label>
                <input type="text" value={zipFilter} onChange={(e) => setZipFilter(e.target.value)} placeholder="Kosongkan untuk ekstrak semua" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
              </div>
            )}
            {activeTool === 'util.hash_checksum' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Algoritma Hash</label>
                <select value={hashAlgorithm} onChange={(e) => setHashAlgorithm(e.target.value as typeof hashAlgorithm)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                  <option value="SHA-256">SHA-256 (Standar)</option>
                  <option value="SHA-512">SHA-512</option>
                  <option value="SHA-1">SHA-1</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* CLI Bar */}
        <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Terminal size={14} className="text-amber-400 shrink-0" />
            <code className="whitespace-nowrap">{cliCommand}</code>
          </div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(cliCommand);
              setCopiedCli(true);
              setTimeout(() => setCopiedCli(false), 1800);
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700"
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
          onClick={handleRun}
          disabled={
            isProcessing ||
            ((activeTool === 'util.zip_pack' ||
              activeTool === 'util.zip_unpack' ||
              activeTool === 'util.hash_checksum') &&
              inputs.length === 0)
          }
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-md disabled:opacity-50"
        >
          {isProcessing ? 'Memproses...' : 'Jalankan Utilitas'}
        </button>

        {outputs.length > 0 && (
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-700">{summary}</p>
              <div className="flex gap-2">
                {onSendToPipeline && (
                  <button
                    type="button"
                    onClick={() => onSendToPipeline(outputs)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold"
                  >
                    <Workflow size={14} /> Kirim ke Pipeline Studio
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadVirtualFiles(outputs, 'extracted_files.zip')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  <Download size={14} />
                  <span>{outputs.length > 1 ? 'Download Semua (ZIP)' : `Download ${outputs[0].name}`}</span>
                </button>
              </div>
            </div>

            {activeTool === 'util.qr_generate' && previewUrl && (
              <div className="flex justify-center p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <img src={previewUrl} alt="Generated QR Code" className="w-48 h-48 rounded-lg shadow-sm border border-slate-200 bg-white" />
              </div>
            )}

            {(activeTool === 'util.md_to_pdf' || activeTool === 'util.table_to_pdf') && previewUrl && (
              <iframe src={previewUrl} title="PDF Utility Preview" className="w-full h-[55vh] min-h-[380px] rounded-xl border border-slate-200 bg-white" />
            )}

            {activeTool === 'util.hash_checksum' && hashJsonOutput && (
              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 text-xs overflow-x-auto max-h-80">
                {hashJsonOutput}
              </pre>
            )}

            {activeTool === 'util.zip_unpack' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {outputs.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-700">{f.name} ({formatByteSize(f.bytes.byteLength)})</span>
                    <button type="button" onClick={() => downloadVirtualFile(f)} className="text-emerald-700 font-bold hover:underline">
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
