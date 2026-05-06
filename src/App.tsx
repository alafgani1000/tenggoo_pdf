import { useState } from 'react';
import { MergePDF } from './components/MergePDF';
import { SplitPDF } from './components/SplitPDF';
import { CompressPDF } from './components/CompressPDF';
import { Layers, Scissors, Zap, FileJson } from 'lucide-react';

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
      <header className="w-full relative z-10 glass-panel border-b-0 border-t-0 rounded-none bg-white/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl text-white shadow-md">
              <FileJson size={24} />
            </div>
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
        <div className="flex justify-center mb-12">
          <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-200/50 flex gap-1">
            <button
              onClick={() => setActiveTab('merge')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'merge' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Layers size={18} />
              Merge
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'split' 
                  ? 'bg-pink-50 text-pink-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Scissors size={18} />
              Split
            </button>
            <button
              onClick={() => setActiveTab('compress')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'compress' 
                  ? 'bg-amber-50 text-amber-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Zap size={18} />
              Compress
            </button>
          </div>
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
