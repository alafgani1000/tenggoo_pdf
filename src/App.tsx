import { useEffect, useMemo, useState } from 'react';
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
import { 
  Layers, 
  Scissors, 
  Zap, 
  ShieldCheck, 
  Image as ImageIcon, 
  RotateCw, 
  Home,
  FileImage,
  Stamp,
  Binary,
  ArrowLeftRight,
  KeyRound
} from 'lucide-react';

type Tab = 
  | 'merge' 
  | 'split' 
  | 'reorder'
  | 'rotate' 
  | 'compress' 
  | 'pdf-to-image' 
  | 'image-to-pdf' 
  | 'watermark'
  | 'page-numbers'
  | 'unlock';

interface ToolItem {
  id: Tab;
  hash: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
}

const TOOLS: ToolItem[] = [
  // Row 1 (Desktop) / Items 1-5
  { id: 'merge', hash: 'merge-pdf', name: 'Gabung PDF', icon: Layers, accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'split', hash: 'split-pdf', name: 'Pisah PDF', icon: Scissors, accentColor: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'reorder', hash: 'atur-halaman-pdf', name: 'Atur Halaman', icon: ArrowLeftRight, accentColor: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'rotate', hash: 'putar-pdf', name: 'Putar PDF', icon: RotateCw, accentColor: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'compress', hash: 'kompres-pdf', name: 'Kompres PDF', icon: Zap, accentColor: 'text-orange-600 bg-orange-50 border-orange-200' },
  // Row 2 (Desktop) / Items 6-10
  { id: 'pdf-to-image', hash: 'pdf-ke-gambar', name: 'PDF ke Gambar', icon: FileImage, accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'image-to-pdf', hash: 'gambar-ke-pdf', name: 'Gambar ke PDF', icon: ImageIcon, accentColor: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'watermark', hash: 'watermark-pdf', name: 'Watermark', icon: Stamp, accentColor: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'page-numbers', hash: 'nomor-halaman-pdf', name: 'Nomor Halaman', icon: Binary, accentColor: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'unlock', hash: 'buka-kunci-pdf', name: 'Buka Kunci PDF', icon: KeyRound, accentColor: 'text-rose-600 bg-rose-50 border-rose-200' },
];

const getTabFromHash = (): Tab => {
  const hash = window.location.hash.replace('#', '');
  return TOOLS.find((tool) => tool.hash === hash)?.id ?? 'merge';
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash);

  useEffect(() => {
    const updateTabFromHash = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', updateTabFromHash);
    return () => window.removeEventListener('hashchange', updateTabFromHash);
  }, []);

  useEffect(() => {
    const tool = TOOLS.find((item) => item.id === activeTab);
    if (tool) document.title = `${tool.name} Gratis Online | Tenggoo PDF`;
  }, [activeTab]);

  const selectTool = (tool: ToolItem) => {
    setActiveTab(tool.id);
    window.history.pushState(null, '', `#${tool.hash}`);
  };

  const privacyNotice = useMemo(() => {
    const browserLanguages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndonesian =
      browserLanguages.some((language) =>
        language.toLowerCase().startsWith('id'),
      ) ||
      ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(timeZone);

    return isIndonesian
      ? {
        label: '100% Privat & Offline:',
        text: 'File tidak diunggah ke server, seluruh proses dijalankan langsung di perangkat Anda.',
      }
      : {
        label: '100% Private & Offline:',
        text: 'Files are never uploaded to a server and are processed directly on your device.',
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
              alt="Tenggoo PDF"
              width={32}
              height={32}
              className="block rounded-lg shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-lg sm:text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 tracking-tight">
              Tenggoo PDF
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
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

        {/* Symmetric Responsive Tool Grid (5x2 on Desktop/Tablet, 2x5 on Mobile) */}
        <div className="w-full max-w-5xl mx-auto mb-6 sm:mb-8">
          <div className="bg-white/80 backdrop-blur-md p-2 sm:p-3 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 sm:gap-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTab === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => selectTool(tool)}
                    className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
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

        {/* Tab Content Section */}
        <div className="flex-1 w-full pb-8">
          {activeTab === 'merge' && <MergePDF />}
          {activeTab === 'split' && <SplitPDF />}
          {activeTab === 'reorder' && <ReorderPDF />}
          {activeTab === 'rotate' && <RotatePDF />}
          {activeTab === 'compress' && <CompressPDF />}
          {activeTab === 'pdf-to-image' && <PDFToImage />}
          {activeTab === 'image-to-pdf' && <ImageToPDF />}
          {activeTab === 'watermark' && <WatermarkPDF />}
          {activeTab === 'page-numbers' && <PageNumberPDF />}
          {activeTab === 'unlock' && <UnlockPDF />}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full relative z-10 py-5 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>© {new Date().getFullYear()} Tenggoo PDF • Client-Side Processing</p>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>TypeScript</span>
            <span>•</span>
            <span>PDF-Lib</span>
            <span>•</span>
            <span>PDF.js</span>
            <span>•</span>
            <span>Tauri</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
