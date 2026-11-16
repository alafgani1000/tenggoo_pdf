import { useCallback, useEffect, useMemo, useState } from 'react';
import { MergePDF } from './components/MergePDF';
import { SplitPDF } from './components/SplitPDF';
import { CompressPDF } from './components/CompressPDF';
import { ImageToPDF } from './components/ImageToPDF';
import { RotatePDF } from './components/RotatePDF';
import { PDFToImage } from './components/PDFToImage';
import { WatermarkPDF } from './components/WatermarkPDF';
import { PageNumberPDF } from './components/PageNumberPDF';
import { ReorderPDF } from './components/ReorderPDF';
import { UnlockPDF } from './components/UnlockPDF';
import { NewPDFToolsStudio } from './components/NewPDFToolsStudio';
import { ImageToolsStudio } from './components/ImageToolsStudio';
import { UtilityToolsStudio } from './components/UtilityToolsStudio';
import { PipelineStudio } from './components/PipelineStudio';
import { CommandPalette, type CommandPaletteItem } from './components/CommandPalette';
import { FAQSection } from './components/FAQSection';
import type { VirtualFile } from './core/types';
import {
  ArrowLeftRight,
  Binary,
  Bot,
  ClipboardList,
  Crop,
  EyeOff,
  FileImage,
  FileSearch,
  FileText,
  Home,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  Layers,
  LayoutGrid,
  QrCode,
  RotateCw,
  ScanSearch,
  Scissors,
  Search,
  ShieldCheck,
  Stamp,
  Table,
  Tags,
  Zap,
} from 'lucide-react';

type MainCategory = 'pdf' | 'image' | 'utility' | 'pipeline';

type PdfTab =
  | 'merge'
  | 'split'
  | 'reorder'
  | 'rotate'
  | 'compress'
  | 'pdf-to-image'
  | 'image-to-pdf'
  | 'watermark'
  | 'page-numbers'
  | 'unlock'
  | 'extract-text'
  | 'pdf-metadata'
  | 'stamp-image'
  | 'redact-pdf'
  | 'crop-pdf'
  | 'redact-text'
  | 'form-pdf'
  | 'nup-pdf'
  | 'extract-tables';

interface PdfToolItem {
  id: PdfTab;
  hash: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
}

const PDF_TOOLS_UI: PdfToolItem[] = [
  { id: 'merge', hash: 'merge-pdf', name: 'Gabung PDF', icon: Layers, accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'split', hash: 'split-pdf', name: 'Pisah PDF', icon: Scissors, accentColor: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'reorder', hash: 'atur-halaman-pdf', name: 'Atur Halaman', icon: ArrowLeftRight, accentColor: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'rotate', hash: 'putar-pdf', name: 'Putar PDF', icon: RotateCw, accentColor: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'compress', hash: 'kompres-pdf', name: 'Kompres PDF', icon: Zap, accentColor: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'pdf-to-image', hash: 'pdf-ke-gambar', name: 'PDF ke Gambar', icon: FileImage, accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'image-to-pdf', hash: 'gambar-ke-pdf', name: 'Gambar ke PDF', icon: ImageIcon, accentColor: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'watermark', hash: 'watermark-pdf', name: 'Watermark', icon: Stamp, accentColor: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'page-numbers', hash: 'nomor-halaman-pdf', name: 'Nomor Halaman', icon: Binary, accentColor: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'unlock', hash: 'buka-kunci-pdf', name: 'Buka Kunci PDF', icon: KeyRound, accentColor: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'extract-text', hash: 'ekstrak-teks-pdf', name: 'Ekstrak Teks', icon: FileSearch, accentColor: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { id: 'pdf-metadata', hash: 'metadata-pdf', name: 'Metadata PDF', icon: Tags, accentColor: 'text-sky-700 bg-sky-50 border-sky-200' },
  { id: 'stamp-image', hash: 'stempel-pdf', name: 'Tanda Tangan & Stempel', icon: ImagePlus, accentColor: 'text-purple-700 bg-purple-50 border-purple-200' },
  { id: 'redact-pdf', hash: 'sensor-pdf', name: 'Sensor Area', icon: EyeOff, accentColor: 'text-slate-800 bg-slate-100 border-slate-300' },
  { id: 'redact-text', hash: 'sensor-teks-pdf', name: 'Sensor PII/Kata', icon: ScanSearch, accentColor: 'text-rose-700 bg-rose-50 border-rose-200' },
  { id: 'crop-pdf', hash: 'potong-margin-pdf', name: 'Potong Margin', icon: Crop, accentColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { id: 'form-pdf', hash: 'form-pdf', name: 'Form AcroForm', icon: ClipboardList, accentColor: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'nup-pdf', hash: 'cetak-nup-pdf', name: 'Cetak N-up', icon: LayoutGrid, accentColor: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'extract-tables', hash: 'ekstrak-tabel-pdf', name: 'Ekstrak Tabel', icon: Table, accentColor: 'text-teal-700 bg-teal-50 border-teal-200' },
];

const CATEGORY_META: {
  id: MainCategory;
  hash: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeClass: string;
}[] = [
  {
    id: 'pdf',
    hash: 'merge-pdf',
    label: 'PDF Tools',
    subtitle: '19 fitur olah PDF',
    icon: FileText,
    activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-md',
  },
  {
    id: 'image',
    hash: 'image-tools',
    label: 'Image Tools',
    subtitle: '11 fitur olah gambar',
    icon: ImageIcon,
    activeClass: 'bg-teal-600 text-white border-teal-600 shadow-md',
  },
  {
    id: 'utility',
    hash: 'utilities',
    label: 'Doc & Utilities',
    subtitle: 'QR, MD, Tabel, ZIP, Hash',
    icon: QrCode,
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md',
  },
  {
    id: 'pipeline',
    hash: 'pipeline',
    label: 'AI Agent & Pipeline',
    subtitle: 'Gabungkan semua tool + CLI/MCP',
    icon: Bot,
    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-md',
  },
];

const resolveStateFromHash = (): { category: MainCategory; pdfTab: PdfTab } => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'image-tools') return { category: 'image', pdfTab: 'merge' };
  if (hash === 'utilities') return { category: 'utility', pdfTab: 'merge' };
  if (hash === 'pipeline') return { category: 'pipeline', pdfTab: 'merge' };
  const matchedPdf = PDF_TOOLS_UI.find((t) => t.hash === hash);
  return { category: 'pdf', pdfTab: matchedPdf?.id ?? 'merge' };
};

function App() {
  const initial = useMemo(() => resolveStateFromHash(), []);
  const [activeCategory, setActiveCategory] = useState<MainCategory>(initial.category);
  const [activePdfTab, setActivePdfTab] = useState<PdfTab>(initial.pdfTab);
  const [pendingPipelineFiles, setPendingPipelineFiles] = useState<VirtualFile[] | undefined>(
    undefined,
  );
  const [pipelineTransferVersion, setPipelineTransferVersion] = useState(0);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const next = resolveStateFromHash();
      setActiveCategory(next.category);
      if (next.category === 'pdf') {
        setActivePdfTab(next.pdfTab);
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (activeCategory === 'image') {
      document.title = 'Image Tools Studio | Tenggoo Toolkit';
    } else if (activeCategory === 'utility') {
      document.title = 'Doc, QR & ZIP Utilities | Tenggoo Toolkit';
    } else if (activeCategory === 'pipeline') {
      document.title = 'AI Agent & Pipeline Studio | Tenggoo Toolkit';
    } else {
      const tool = PDF_TOOLS_UI.find((item) => item.id === activePdfTab);
      if (tool) document.title = `${tool.name} Gratis Online | Tenggoo PDF`;
    }
  }, [activeCategory, activePdfTab]);

  const selectCategory = (cat: MainCategory) => {
    setActiveCategory(cat);
    if (cat === 'pdf') {
      const currentTool = PDF_TOOLS_UI.find((t) => t.id === activePdfTab) ?? PDF_TOOLS_UI[0];
      window.history.pushState(null, '', `#${currentTool.hash}`);
    } else {
      const meta = CATEGORY_META.find((c) => c.id === cat);
      if (meta) window.history.pushState(null, '', `#${meta.hash}`);
    }
  };

  const selectPdfTool = useCallback((tool: PdfToolItem) => {
    setActiveCategory('pdf');
    setActivePdfTab(tool.id);
    window.history.pushState(null, '', `#${tool.hash}`);
  }, []);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const pdfEntries: CommandPaletteItem[] = PDF_TOOLS_UI.map((tool) => ({
      id: `cmd-pdf-${tool.id}`,
      title: tool.name,
      subtitle: `Buka fitur PDF #${tool.hash}`,
      categoryLabel: 'PDF',
      keywords: `pdf ${tool.name} ${tool.id} ${tool.hash}`,
      onSelect: () => selectPdfTool(tool),
    }));

    const studioEntries: CommandPaletteItem[] = [
      {
        id: 'cmd-image-studio',
        title: 'Image Tools Studio (Kompres, Konversi, Resize, Crop, Scan Enhancer, Grid, Diff)',
        subtitle: '11 fitur pengolahan gambar lokal (PNG, JPG, WebP, ICO, Pas Foto, KTP Grid)',
        categoryLabel: 'Image',
        keywords: 'image gambar foto kompres resize crop pas foto watermark exif ico webp scan grid diff',
        onSelect: () => {
          setActiveCategory('image');
          window.history.pushState(null, '', '#image-tools');
        },
      },
      {
        id: 'cmd-utility-studio',
        title: 'Doc & Utilities (QR Code, Markdown, CSV Table to PDF, ZIP, Hash SHA-256)',
        subtitle: 'Generator QR Code, Markdown/Tabel ke PDF, arsip ZIP, dan checksum integritas',
        categoryLabel: 'Utility',
        keywords: 'qr code markdown csv json table pdf zip archive hash sha256 utility',
        onSelect: () => {
          setActiveCategory('utility');
          window.history.pushState(null, '', '#utilities');
        },
      },
      {
        id: 'cmd-pipeline-studio',
        title: 'AI Agent & Pipeline Studio',
        subtitle: 'Rangkai kombinasi PDF + Image + Utility dan salin perintah CLI / MCP',
        categoryLabel: 'AI Agent',
        keywords: 'ai agent mcp cli pipeline workflow chain combine antigravity codex',
        onSelect: () => {
          setActiveCategory('pipeline');
          window.history.pushState(null, '', '#pipeline');
        },
      },
    ];

    return [...pdfEntries, ...studioEntries];
  }, [selectPdfTool]);

  const handleSendToPipeline = useCallback((files: VirtualFile[]) => {
    setPendingPipelineFiles(files);
    setPipelineTransferVersion((v) => v + 1);
    setActiveCategory('pipeline');
    window.history.pushState(null, '', '#pipeline');
  }, []);

  const privacyNotice = useMemo(() => {
    const browserLanguages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndonesian =
      browserLanguages.some((language) => language.toLowerCase().startsWith('id')) ||
      ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(timeZone);

    return isIndonesian
      ? {
          label: '100% Privat & Agent-Ready:',
          text: 'Semua tool PDF, Image & Utility berjalan lokal di perangkat Anda dan dapat diakses langsung oleh AI Agent via CLI/MCP.',
        }
      : {
          label: '100% Private & Agent-Ready:',
          text: 'All PDF, Image & Utility tools run locally on your device and are directly callable by AI Agents via CLI/MCP.',
        };
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-pink-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="absolute top-[30%] right-[5%] w-[25%] h-[25%] rounded-full bg-amber-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[5%] w-[25%] h-[25%] rounded-full bg-emerald-300/15 blur-3xl mix-blend-multiply pointer-events-none"></div>

      {/* Header */}
      <header className="w-full relative z-20 glass-panel border-b border-slate-200/60 bg-white/85 sticky top-0 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt="Tenggoo Studio"
              width={32}
              height={32}
              className="block rounded-lg shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold text-purple-600 tracking-tight">
                Tenggoo Studio
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                PDF • Image • AI Agent
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-700 bg-slate-100/90 hover:bg-indigo-50 border border-slate-200 px-2.5 py-1.5 rounded-xl transition-colors"
              title="Cari fitur cepat (Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Cari Fitur</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500">
                Ctrl+K
              </kbd>
            </button>
            <a
              href="https://tenggoo.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <Home size={16} />
              <span className="hidden xs:inline">Home</span>
            </a>
            <div className="w-px h-4 bg-slate-200"></div>
            <a
              href="https://github.com/alafgani1000/tenggoo_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 relative z-10 flex flex-col">
        {/* Privacy Notice Banner */}
        <div className="flex items-center justify-center mb-5 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200/80 shadow-sm text-xs sm:text-sm text-center leading-snug">
            <ShieldCheck size={16} className="shrink-0 text-emerald-600 hidden xs:inline-block" />
            <span>
              <strong>{privacyNotice.label}</strong> {privacyNotice.text}
            </span>
          </div>
        </div>

        {/* Top-Level Category Switcher */}
        <div className="w-full max-w-5xl mx-auto mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {CATEGORY_META.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                    isActive
                      ? cat.activeClass
                      : 'bg-white/85 backdrop-blur-md border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate">{cat.label}</div>
                    <div
                      className={`text-[10px] sm:text-[11px] truncate ${
                        isActive ? 'text-white/85' : 'text-slate-500'
                      }`}
                    >
                      {cat.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PDF Tool Sub-Navigation */}
        {activeCategory === 'pdf' && (
          <div className="w-full max-w-5xl mx-auto mb-6 sm:mb-8">
            <div className="bg-white/80 backdrop-blur-md p-2 sm:p-3 rounded-2xl shadow-sm border border-slate-200/80">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2">
                {PDF_TOOLS_UI.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activePdfTab === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => selectPdfTool(tool)}
                      className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                        isActive
                          ? `${tool.accentColor} shadow-sm ring-2 ring-black/5 font-bold scale-[1.01]`
                          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={17} className={`shrink-0 ${isActive ? '' : 'text-slate-400'}`} />
                      <span className="truncate text-center sm:text-left">{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active Studio Content */}
        <div className="flex-1 w-full pb-8 pt-2">
          {activeCategory === 'pdf' && (
            <>
              {activePdfTab === 'merge' && <MergePDF />}
              {activePdfTab === 'split' && <SplitPDF />}
              {activePdfTab === 'reorder' && <ReorderPDF />}
              {activePdfTab === 'rotate' && <RotatePDF />}
              {activePdfTab === 'compress' && <CompressPDF />}
              {activePdfTab === 'pdf-to-image' && <PDFToImage />}
              {activePdfTab === 'image-to-pdf' && <ImageToPDF />}
              {activePdfTab === 'watermark' && <WatermarkPDF />}
              {activePdfTab === 'page-numbers' && <PageNumberPDF />}
              {activePdfTab === 'unlock' && <UnlockPDF />}
              {(activePdfTab === 'extract-text' ||
                activePdfTab === 'pdf-metadata' ||
                activePdfTab === 'stamp-image' ||
                activePdfTab === 'redact-pdf' ||
                activePdfTab === 'crop-pdf' ||
                activePdfTab === 'redact-text' ||
                activePdfTab === 'form-pdf' ||
                activePdfTab === 'nup-pdf' ||
                activePdfTab === 'extract-tables') && (
                <NewPDFToolsStudio
                  mode={activePdfTab}
                  onSendToPipeline={handleSendToPipeline}
                />
              )}
            </>
          )}

          {activeCategory === 'image' && (
            <ImageToolsStudio onSendToPipeline={handleSendToPipeline} />
          )}

          {activeCategory === 'utility' && (
            <UtilityToolsStudio onSendToPipeline={handleSendToPipeline} />
          )}

          {activeCategory === 'pipeline' && (
            <PipelineStudio
              key={pipelineTransferVersion}
              initialInputFiles={pendingPipelineFiles}
            />
          )}
        </div>

        {/* FAQ Keamanan & Privasi Section */}
        <FAQSection />
      </main>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={paletteItems}
      />

      {/* Footer */}
      <footer className="w-full relative z-10 py-5 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>© {new Date().getFullYear()} Tenggoo Studio • Client-Side & Agent-Callable Toolkit</p>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>TypeScript</span>
            <span>•</span>
            <span>PDF-Lib</span>
            <span>•</span>
            <span>PDF.js</span>
            <span>•</span>
            <span>MCP & CLI</span>
            <span>•</span>
            <span>Tauri</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
