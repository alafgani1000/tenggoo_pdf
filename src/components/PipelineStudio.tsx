import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Bot,
  Check,
  Copy,
  Download,
  FileText,
  Play,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import { FileDropzone } from './FileDropzone.tsx';
import { ALL_TOOLS, getTool } from '../core/registry.ts';
import { runPipeline } from '../core/pipeline.ts';
import { formatByteSize } from '../core/types.ts';
import type {
  PipelineExecutionResult,
  PipelineStep,
  ToolParameterProperty,
  VirtualFile,
} from '../core/types.ts';
import {
  downloadVirtualFile,
  downloadVirtualFiles,
  filesToVirtualFiles,
  virtualFileToBlobUrl,
} from '../utils/virtualFileWeb.ts';

interface EditableStep {
  uid: string;
  tool: string;
  params: Record<string, unknown>;
}

interface WorkflowPreset {
  id: string;
  title: string;
  desc: string;
  steps: PipelineStep[];
}

const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'scan-to-pdf',
    title: 'Foto Dokumen -> PDF Rapi',
    desc: 'Resize 1400px -> Kompres JPEG -> Gabung ke PDF A4 -> Watermark -> Nomor Halaman',
    steps: [
      { tool: 'image.resize', params: { width: 1400, fit: 'inside' } },
      { tool: 'image.compress', params: { quality: 82, format: 'jpeg' } },
      { tool: 'pdf.from_images', params: { pageSize: 'A4', margin: 20, outputName: 'dokumen_rapi.pdf' } },
      { tool: 'pdf.watermark', params: { text: 'INTERNAL', opacity: 0.2, position: 'center-diagonal' } },
      { tool: 'pdf.page_numbers', params: { position: 'bottom-center', format: 'page-of-total' } },
    ],
  },
  {
    id: 'md-qr-pdf',
    title: 'Markdown + QR Stamp -> PDF',
    desc: 'Buat PDF dari Markdown -> Buat QR Code -> Tempel QR di pojok PDF -> Nomor Halaman',
    steps: [
      {
        tool: 'util.md_to_pdf',
        params: {
          markdown: '# Dokumen Terverifikasi\n\nDokumen ini dibuat dan distempel otomatis oleh Work Tool Super App Pipeline.\n\n## Status\n- Terverifikasi QR\n- Siap Distribusi',
          title: 'Dokumen Verifikasi',
          pageSize: 'A4',
          outputName: 'verified_doc.pdf',
        },
      },
      { tool: 'util.qr_generate', params: { text: 'https://worktool.local/verify', size: 240 } },
      { tool: 'pdf.stamp_image', params: { position: 'bottom-right', width: 80, margin: 24 } },
      { tool: 'pdf.page_numbers', params: { position: 'bottom-left', format: 'n-of-total' } },
    ],
  },
  {
    id: 'pdf-to-compressed-jpg',
    title: 'PDF -> Gambar Kompres -> ZIP',
    desc: 'Render halaman PDF ke JPG -> Kompres ukuran -> Kemas ke arsip ZIP',
    steps: [
      { tool: 'pdf.to_images', params: { format: 'jpeg', scale: 2, quality: 90 } },
      { tool: 'image.compress', params: { quality: 75, format: 'jpeg', maxWidth: 1600 } },
      { tool: 'util.zip_pack', params: { archiveName: 'halaman_pdf.zip' } },
    ],
  },
  {
    id: 'pas-foto-clean',
    title: 'Pas Foto 3:4 & Privasi EXIF',
    desc: 'Crop rasio 3:4 -> Hapus EXIF/GPS -> Kemas ke ZIP',
    steps: [
      { tool: 'image.crop', params: { aspectRatio: '3:4' } },
      { tool: 'image.strip_metadata', params: {} },
      { tool: 'util.zip_pack', params: { archiveName: 'pas_foto_bersih.zip' } },
    ],
  },
];

const CUSTOM_PRESETS_KEY = 'tenggoo_custom_pipelines_v1';

function loadSavedPresets(): WorkflowPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkflowPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildDefaultParams(toolId: string): Record<string, unknown> {
  const def = getTool(toolId);
  if (!def) return {};
  const defaults: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(def.parameterSchema.properties)) {
    if (prop.default !== undefined) {
      defaults[key] = prop.default;
    }
  }
  return defaults;
}

function makeStep(toolId: string, overrideParams?: Record<string, unknown>): EditableStep {
  return {
    uid: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tool: toolId,
    params: { ...buildDefaultParams(toolId), ...(overrideParams ?? {}) },
  };
}

interface PipelineStudioProps {
  initialInputFiles?: VirtualFile[];
}

export const PipelineStudio: React.FC<PipelineStudioProps> = ({
  initialInputFiles,
}) => {
  const [inputs, setInputs] = useState<VirtualFile[]>(() => initialInputFiles ?? []);
  const [steps, setSteps] = useState<EditableStep[]>(() =>
    WORKFLOW_PRESETS[1].steps.map((s) => makeStep(s.tool, s.params)),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineExecutionResult | null>(null);
  const [copiedMode, setCopiedMode] = useState<'cli' | 'mcp' | null>(null);
  const [savedPresets, setSavedPresets] = useState<WorkflowPreset[]>(() => loadSavedPresets());
  const [newPresetName, setNewPresetName] = useState('');

  const cleanSteps = useMemo<PipelineStep[]>(
    () =>
      steps.map((s) => ({
        tool: s.tool,
        params: s.params,
      })),
    [steps],
  );

  const cliCommand = useMemo(() => {
    const inputArg =
      inputs.length > 0 ? `-i ${inputs.map((f) => `"${f.name}"`).join(' ')} ` : '';
    const stepsJson = JSON.stringify(cleanSteps);
    return `node --no-warnings --experimental-strip-types src/agent/cli.ts pipeline ${inputArg}-o ./output --steps '${stepsJson}' --json`;
  }, [inputs, cleanSteps]);

  const mcpCallPayload = useMemo(
    () =>
      JSON.stringify(
        {
          tool: 'tenggoo_pipeline_run',
          arguments: {
            input_paths: inputs.map((f) => f.name),
            output_path: './output',
            steps: cleanSteps,
          },
        },
        null,
        2,
      ),
    [inputs, cleanSteps],
  );

  const previewFileUrl = useMemo(() => {
    const first = result?.files[0];
    if (!first) return null;
    if (first.mimeType === 'application/pdf' || first.mimeType.startsWith('image/')) {
      return virtualFileToBlobUrl(first);
    }
    return null;
  }, [result]);

  useEffect(() => {
    return () => {
      if (previewFileUrl) URL.revokeObjectURL(previewFileUrl);
    };
  }, [previewFileUrl]);

  const handleFilesDrop = async (files: File[]) => {
    const vFiles = await filesToVirtualFiles(files);
    setInputs((prev) => [...prev, ...vFiles]);
    setError(null);
  };

  const applyPreset = (preset: WorkflowPreset) => {
    setSteps(preset.steps.map((s) => makeStep(s.tool, s.params)));
    setResult(null);
    setError(null);
  };

  const persistPresets = (next: WorkflowPreset[]) => {
    setSavedPresets(next);
    try {
      window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleSaveCustomPreset = () => {
    const title = newPresetName.trim();
    if (!title || cleanSteps.length === 0) return;
    const newPreset: WorkflowPreset = {
      id: `custom-${Date.now()}`,
      title,
      desc: cleanSteps.map((s) => s.tool).join(' -> '),
      steps: cleanSteps,
    };
    persistPresets([newPreset, ...savedPresets]);
    setNewPresetName('');
  };

  const handleDeleteCustomPreset = (id: string) => {
    persistPresets(savedPresets.filter((p) => p.id !== id));
  };

  const handleExportPipelineJson = () => {
    const json = JSON.stringify({ name: newPresetName.trim() || 'worktool-pipeline', steps: cleanSteps }, null, 2);
    downloadVirtualFile({
      name: `${(newPresetName.trim() || 'worktool-pipeline').replace(/\s+/g, '_')}.pipeline.json`,
      mimeType: 'application/json',
      bytes: new TextEncoder().encode(json),
    });
  };

  const handleImportPipelineJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { steps?: PipelineStep[] } | PipelineStep[];
      const importedSteps = Array.isArray(parsed) ? parsed : parsed.steps;
      if (!Array.isArray(importedSteps) || importedSteps.length === 0) {
        throw new Error('Format .pipeline.json tidak valid.');
      }
      setSteps(importedSteps.map((s) => makeStep(s.tool, s.params)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = '';
    }
  };

  const updateStepTool = (uid: string, newToolId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.uid === uid
          ? { ...step, tool: newToolId, params: buildDefaultParams(newToolId) }
          : step,
      ),
    );
  };

  const updateStepParam = (uid: string, key: string, value: unknown) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.uid === uid
          ? { ...step, params: { ...step.params, [key]: value } }
          : step,
      ),
    );
  };

  const moveStep = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const item = copy[index];
      copy[index] = copy[target];
      copy[target] = item;
      return copy;
    });
  };

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const execResult = await runPipeline(inputs, cleanSteps, (stepIdx, total, toolId, pct) => {
        setProgressText(`Langkah ${stepIdx + 1}/${total} (${toolId}) • ${pct}%`);
      });
      setResult(execResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setProgressText('');
    }
  };

  const renderParamInput = (
    step: EditableStep,
    key: string,
    prop: ToolParameterProperty,
  ) => {
    const val = step.params[key];

    if (prop.enum && prop.enum.length > 0) {
      return (
        <select
          value={String(val ?? prop.default ?? prop.enum[0])}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = prop.type === 'integer' || prop.type === 'number' ? Number(raw) : raw;
            updateStepParam(step.uid, key, parsed);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
        >
          {prop.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      );
    }

    if (prop.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => updateStepParam(step.uid, key, e.target.checked)}
            className="accent-purple-600"
          />
          <span>Aktif</span>
        </label>
      );
    }

    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <input
          type="number"
          value={val === undefined ? '' : Number(val)}
          min={prop.minimum}
          max={prop.maximum}
          step={prop.type === 'number' ? 'any' : 1}
          placeholder={prop.default !== undefined ? String(prop.default) : ''}
          onChange={(e) => {
            const raw = e.target.value;
            updateStepParam(step.uid, key, raw === '' ? undefined : Number(raw));
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
        />
      );
    }

    if (prop.type === 'array') {
      const strVal = Array.isArray(val) ? val.join(', ') : String(val ?? '');
      return (
        <input
          type="text"
          value={strVal}
          placeholder="Contoh: 2, 1, 3"
          onChange={(e) => {
            const items = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => (prop.items?.type === 'integer' || prop.items?.type === 'number' ? Number(s) : s));
            updateStepParam(step.uid, key, items);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
        />
      );
    }

    if (key === 'markdown' || key === 'data' || prop.type === 'object') {
      const strValue =
        prop.type === 'object' && typeof val === 'object' && val !== null
          ? JSON.stringify(val)
          : String(val ?? '');
      return (
        <textarea
          rows={3}
          value={strValue}
          onChange={(e) => {
            if (prop.type === 'object') {
              try {
                updateStepParam(step.uid, key, JSON.parse(e.target.value));
              } catch {
                updateStepParam(step.uid, key, e.target.value);
              }
            } else {
              updateStepParam(step.uid, key, e.target.value);
            }
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(val ?? '')}
        placeholder={prop.default !== undefined ? String(prop.default) : prop.description}
        onChange={(e) => updateStepParam(step.uid, key, e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
      />
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold uppercase tracking-wider">
          <Bot size={14} /> AI Agent Hub & Multi-Tool Pipeline
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Pipeline Studio & Agent API</h2>
        <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto">
          Kombinasikan berbagai fungsi PDF, Image, dan Utility secara berantai — sekaligus salin perintah CLI & MCP untuk AI Agent (Antigravity, Codex, Claude Code)
        </p>
      </div>

      {/* Presets & Saved Custom Workflows */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Sparkles size={14} className="text-purple-600" />
            <span>Preset Kombinasi Cepat & Resep Tersimpan</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPipelineJson}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
            >
              <Download size={12} /> Export .json
            </button>
            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer">
              <Upload size={12} /> Import .json
              <input type="file" accept=".json" className="hidden" onChange={handleImportPipelineJson} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {WORKFLOW_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-purple-50 hover:border-purple-300 text-left transition-all"
            >
              <div className="text-xs font-bold text-slate-800">{preset.title}</div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">{preset.desc}</div>
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Nama preset baru (misal: Kontrak Klien + QR)"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
            />
            <button
              type="button"
              onClick={handleSaveCustomPreset}
              disabled={!newPresetName.trim() || steps.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold disabled:opacity-40"
            >
              <BookmarkPlus size={14} /> Simpan Preset
            </button>
          </div>

          {savedPresets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="font-bold text-purple-800 hover:underline"
                    title={preset.desc}
                  >
                    {preset.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomPreset(preset.id)}
                    className="text-purple-400 hover:text-rose-600"
                    title="Hapus preset"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Files */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">1. File Input Awal (Opsional jika langkah awal generator)</h3>
          {inputs.length > 0 && (
            <button type="button" onClick={() => setInputs([])} className="text-xs font-semibold text-rose-600 hover:underline">
              Kosongkan Input
            </button>
          )}
        </div>
        <FileDropzone
          onFilesDrop={handleFilesDrop}
          multiple={true}
          accept="*"
          label="Drop file PDF, Gambar, Markdown, atau ZIP sebagai bahan awal pipeline"
          helpText="Output dari setiap langkah otomatis diteruskan ke langkah berikutnya"
        />
        {inputs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {inputs.map((f, idx) => (
              <div key={`${f.name}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <FileText size={14} className="text-purple-600" />
                <span className="font-semibold text-slate-700">{f.name}</span>
                <span className="text-slate-400">({formatByteSize(f.bytes.byteLength)})</span>
                <button
                  type="button"
                  onClick={() => setInputs((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Steps */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Workflow size={18} className="text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">2. Rangkaian Langkah ({steps.length} Langkah)</h3>
          </div>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, makeStep('pdf.watermark')])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
          >
            <Plus size={14} /> Tambah Langkah
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const def = getTool(step.tool);
            const paramEntries = def ? Object.entries(def.parameterSchema.properties) : [];

            return (
              <div key={step.uid} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <select
                      value={step.tool}
                      onChange={(e) => updateStepTool(step.uid, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                    >
                      <optgroup label="PDF Tools">
                        {ALL_TOOLS.filter((t) => t.category === 'pdf').map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id} — {t.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Image Tools">
                        {ALL_TOOLS.filter((t) => t.category === 'image').map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id} — {t.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Utility & Document Tools">
                        {ALL_TOOLS.filter((t) => t.category === 'utility').map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id} — {t.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                      title="Naikkan"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(idx, 1)}
                      disabled={idx === steps.length - 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                      title="Turunkan"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps((prev) => prev.filter((s) => s.uid !== step.uid))}
                      disabled={steps.length <= 1}
                      className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      title="Hapus langkah"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {def && <p className="text-[11px] text-slate-500">{def.description}</p>}

                {paramEntries.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {paramEntries.map(([paramKey, prop]) => (
                      <div key={paramKey} className={paramKey === 'markdown' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1" title={prop.description}>
                          {paramKey}
                        </label>
                        {renderParamInput(step, paramKey, prop)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleRunPipeline}
          disabled={isRunning || steps.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3.5 px-6 rounded-xl font-bold shadow-md disabled:opacity-50"
        >
          <Play size={18} />
          <span>{isRunning ? progressText || 'Menjalankan Pipeline...' : 'Jalankan Seluruh Pipeline'}</span>
        </button>
      </div>

      {/* Pipeline Results */}
      {result && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-emerald-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-emerald-800">
                Pipeline Selesai dalam {result.totalDurationMs} ms
              </h3>
              <p className="text-xs text-slate-600">
                Menghasilkan {result.files.length} file akhir
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadVirtualFiles(result.files, 'pipeline_output.zip')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              <Download size={15} />
              <span>{result.files.length > 1 ? 'Download Semua (ZIP)' : `Download ${result.files[0]?.name}`}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {result.steps.map((st) => (
              <div key={st.stepIndex} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="font-semibold text-slate-800">
                  [{st.stepIndex}] <code className="text-purple-700">{st.tool}</code> — {st.summary}
                </span>
                <span className="text-slate-500 shrink-0 ml-2">{st.durationMs}ms</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {result.files.map((f, idx) => (
              <button
                key={`${f.name}-${idx}`}
                type="button"
                onClick={() => downloadVirtualFile(f)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                <Download size={13} /> {f.name} ({formatByteSize(f.bytes.byteLength)})
              </button>
            ))}
          </div>

          {previewFileUrl && result.files[0]?.mimeType === 'application/pdf' && (
            <iframe
              src={previewFileUrl}
              title="Pipeline PDF Output"
              className="w-full h-[55vh] min-h-[380px] rounded-xl border border-slate-200 bg-white"
            />
          )}

          {previewFileUrl && result.files[0]?.mimeType.startsWith('image/') && (
            <div className="flex justify-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <img src={previewFileUrl} alt="Pipeline Image Output" className="max-h-72 object-contain rounded-lg" />
            </div>
          )}
        </div>
      )}

      {/* AI Agent Direct Integration Guide */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
          <Terminal size={18} />
          <span>Integrasi Langsung untuk AI Agent (Antigravity, Codex, Claude Code, Cursor)</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Seluruh {ALL_TOOLS.length} fungsi di aplikasi ini bersifat headless di <code className="text-emerald-300">src/core/</code> dan dapat dipanggil langsung oleh AI Agent melalui <strong>CLI</strong> maupun <strong>MCP Server (stdio)</strong>:
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Perintah Terminal / CLI untuk Pipeline di Atas:</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(cliCommand);
                setCopiedMode('cli');
                setTimeout(() => setCopiedMode(null), 1800);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {copiedMode === 'cli' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedMode === 'cli' ? 'Tersalin' : 'Salin CLI'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 text-xs overflow-x-auto">{cliCommand}</pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Payload MCP Tool Call (<code>tenggoo_pipeline_run</code>) via <code>npm run mcp</code>:</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(mcpCallPayload);
                setCopiedMode('mcp');
                setTimeout(() => setCopiedMode(null), 1800);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {copiedMode === 'mcp' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedMode === 'mcp' ? 'Tersalin' : 'Salin JSON MCP'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-950 text-sky-300 text-xs overflow-x-auto max-h-56">{mcpCallPayload}</pre>
        </div>
      </div>
    </div>
  );
};
