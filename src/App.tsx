import { useState } from 'react';
import { MergePDF } from './components/MergePDF';
import { SplitPDF } from './components/SplitPDF';
import { CompressPDF } from './components/CompressPDF';
import { Layers, Scissors, Zap, ShieldCheck } from 'lucide-react';

type Tab = 'merge' | 'split' | 'compress';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('merge');

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-50">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pink-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-amber-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>

      {/* Header */}
      <header className="w-full relative z-10 glass-panel border-b-0 border-t-0 rounded-none bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">

            <img
              src="/icon.png"
              alt="Tenggoo PDF"
              width={32}
              height={32}
              className="block"
            />

            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 tracking-tight">
              Tenggoo PDF
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500">
            Client-Side Tools
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 relative z-10 flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-200/50 flex gap-1">
            <button
              onClick={() => setActiveTab('merge')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'merge'
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
            >
              <Layers size={18} />
              Merge
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'split'
                ? 'bg-pink-50 text-pink-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
            >
              <Scissors size={18} />
              Split
            </button>
            <button
              onClick={() => setActiveTab('compress')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'compress'
                ? 'bg-amber-50 text-amber-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
            >
              <Zap size={18} />
              Compress
            </button>
          </div>
        </div>

        {/* Privacy & Open Source Notice */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 text-sm">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm">
            <ShieldCheck size={16} className="shrink-0" />
            <span><strong>100% Privat & Aman:</strong> File tidak diunggah ke server, diproses langsung di perangkat Anda.</span>
          </div>
          <a
            href="https://github.com/alafgani1000/tenggo_pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" /></svg>
            <span>Open Source</span>
          </a>
        </div>

        {/* Tab Content */}
        <div className="flex-1 w-full">
          {activeTab === 'merge' && <MergePDF />}
          {activeTab === 'split' && <SplitPDF />}
          {activeTab === 'compress' && <CompressPDF />}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full relative z-10 py-6 text-center text-sm text-slate-500">
        <p>Built with TypeScript & pdf-lib. All processing runs entirely in your browser.</p>
      </footer>
    </div>
  );
}

export default App;
