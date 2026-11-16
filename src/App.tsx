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
import { AllToolsHub } from './components/AllToolsHub';
import {
  CATEGORY_LABELS,
  NAV_TOOLS,
  findNavToolByHash,
  findNavToolById,
  type NavCategoryId,
  type NavToolEntry,
} from './components/navigationCatalog';
import { FAQSection } from './components/FAQSection';
import type { VirtualFile } from './core/types';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Workflow,
  X,
} from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'tenggoo_favorite_tools_v1';
const RECENTS_STORAGE_KEY = 'tenggoo_recent_tools_v1';

type ActiveView = { kind: 'hub' } | { kind: 'tool'; toolId: string };

function readStoredIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function resolveViewFromHash(): ActiveView {
  const hash = window.location.hash.replace('#', '').trim();
  if (!hash || hash === 'semua-fitur') {
    return { kind: 'hub' };
  }
  const matched = findNavToolByHash(hash);
  if (matched) {
    return { kind: 'tool', toolId: matched.id };
  }
  return { kind: 'hub' };
}

function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() => resolveViewFromHash());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readStoredIds(FAVORITES_STORAGE_KEY),
  );
  const [recentIds, setRecentIds] = useState<string[]>(() => readStoredIds(RECENTS_STORAGE_KEY));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<NavCategoryId, boolean>>({
    pdf: true,
    image: true,
    utility: true,
    pipeline: true,
  });

  const [pendingPipelineFiles, setPendingPipelineFiles] = useState<VirtualFile[] | undefined>(
    undefined,
  );
  const [pipelineTransferVersion, setPipelineTransferVersion] = useState(0);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const activeTool: NavToolEntry | undefined = useMemo(() => {
    if (activeView.kind !== 'tool') return undefined;
    return findNavToolById(activeView.toolId);
  }, [activeView]);

  useEffect(() => {
    const onHashChange = () => {
      setActiveView(resolveViewFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    if (!activeTool) {
      document.title = 'Tenggoo Studio — PDF, Image, Utilities & AI Agent';
      return;
    }
    document.title = `${activeTool.name} | Tenggoo Studio`;
  }, [activeTool]);

  const openHub = useCallback(() => {
    setActiveView({ kind: 'hub' });
    setMobileDrawerOpen(false);
    window.history.pushState(null, '', '#semua-fitur');
  }, []);

  const recordRecentTool = useCallback((toolId: string) => {
    setRecentIds((prev) => {
      const next = [toolId, ...prev.filter((id) => id !== toolId)].slice(0, 6);
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const selectTool = useCallback(
    (tool: NavToolEntry) => {
      setActiveView({ kind: 'tool', toolId: tool.id });
      setMobileDrawerOpen(false);
      recordRecentTool(tool.id);
      window.history.pushState(null, '', `#${tool.hash}`);
    },
    [recordRecentTool],
  );

  const toggleFavorite = useCallback((toolId: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [toolId, ...prev];
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const handleSendToPipeline = useCallback(
    (files: VirtualFile[]) => {
      const pipelineTool = findNavToolById('pipeline:studio');
      setPendingPipelineFiles(files);
      setPipelineTransferVersion((v) => v + 1);
      if (pipelineTool) {
        setActiveView({ kind: 'tool', toolId: pipelineTool.id });
        recordRecentTool(pipelineTool.id);
        window.history.pushState(null, '', `#${pipelineTool.hash}`);
      }
    },
    [recordRecentTool],
  );

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const hubEntry: CommandPaletteItem = {
      id: 'cmd-hub-all',
      title: 'Semua Fitur (Katalog Bento Hub)',
      subtitle: 'Lihat seluruh 37 tool PDF, Image, Utility & Pipeline dalam satu halaman',
      categoryLabel: 'Navigasi',
      keywords: 'home hub semua fitur katalog all tools',
      onSelect: openHub,
    };

    const toolEntries: CommandPaletteItem[] = NAV_TOOLS.map((tool) => ({
      id: `cmd-${tool.id}`,
      title: tool.name,
      subtitle: `${tool.subGroup} — ${tool.shortDesc}`,
      categoryLabel: CATEGORY_LABELS[tool.category],
      keywords: `${tool.name} ${tool.shortDesc} ${tool.subGroup} ${tool.category} ${tool.hash}`,
      onSelect: () => selectTool(tool),
    }));

    return [hubEntry, ...toolEntries];
  }, [openHub, selectTool]);

  const sidebarFilteredTools = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return NAV_TOOLS;
    return NAV_TOOLS.filter((t) =>
      `${t.name} ${t.shortDesc} ${t.subGroup} ${CATEGORY_LABELS[t.category]}`
        .toLowerCase()
        .includes(q),
    );
  }, [sidebarSearch]);

  const favoriteToolList = useMemo(
    () =>
      favoriteIds
        .map((id) => findNavToolById(id))
        .filter((t): t is NavToolEntry => Boolean(t)),
    [favoriteIds],
  );

  const sidebarCategorySections = useMemo(() => {
    const defs: {
      id: Exclude<NavCategoryId, 'pipeline'>;
      label: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      accentText: string;
    }[] = [
      { id: 'pdf', label: 'PDF Tools', icon: FileText, accentText: 'text-indigo-600' },
      { id: 'image', label: 'Image Tools', icon: ImageIcon, accentText: 'text-teal-600' },
      { id: 'utility', label: 'Doc & Utilities', icon: QrCode, accentText: 'text-amber-600' },
    ];

    return defs.map((sec) => {
      const items = sidebarFilteredTools.filter((t) => t.category === sec.id);
      const subGroups: { name: string; items: NavToolEntry[] }[] = [];
      for (const item of items) {
        let group = subGroups.find((g) => g.name === item.subGroup);
        if (!group) {
          group = { name: item.subGroup, items: [] };
          subGroups.push(group);
        }
        group.items.push(item);
      }
      return { ...sec, count: items.length, subGroups };
    });
  }, [sidebarFilteredTools]);

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
          text: 'Semua tool PDF, Image & Utility berjalan lokal di perangkat Anda dan siap diakses AI Agent via CLI/MCP.',
        }
      : {
          label: '100% Private & Agent-Ready:',
          text: 'All PDF, Image & Utility tools run locally on your device and are directly callable by AI Agents via CLI/MCP.',
        };
  }, []);

  const renderSidebarInner = (isCompactRail: boolean) => {
    const pipelineTool = findNavToolById('pipeline:studio');
    const isHubActive = activeView.kind === 'hub';

    if (isCompactRail) {
      return (
        <div className="flex flex-col items-center py-3 gap-2">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Perluas Sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
          <button
            type="button"
            onClick={openHub}
            className={`p-2.5 rounded-xl transition-colors ${
              isHubActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Semua Fitur (Hub)"
          >
            <LayoutGrid size={18} />
          </button>
          {pipelineTool && (
            <button
              type="button"
              onClick={() => selectTool(pipelineTool)}
              className={`p-2.5 rounded-xl transition-colors ${
                activeTool?.id === pipelineTool.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-purple-600 hover:bg-purple-50'
              }`}
              title={pipelineTool.name}
            >
              <Bot size={18} />
            </button>
          )}
          <div className="w-8 h-px bg-slate-200 my-1" />
          {favoriteToolList.slice(0, 6).map((fav) => {
            const Icon = fav.icon;
            const isActive = activeTool?.id === fav.id;
            return (
              <button
                key={`rail-fav-${fav.id}`}
                type="button"
                onClick={() => selectTool(fav)}
                className={`p-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
                title={fav.name}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Top Controls + Search */}
        <div className="p-3 border-b border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Navigasi Studio
            </span>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Ciutkan Sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Tutup Menu"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Filter menu..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Menu List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {/* Primary Launchers */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={openHub}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                isHubActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid size={16} />
              <span>Semua Fitur (Hub)</span>
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                  isHubActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {NAV_TOOLS.length}
              </span>
            </button>

            {pipelineTool && (
              <button
                type="button"
                onClick={() => selectTool(pipelineTool)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTool?.id === pipelineTool.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-700 bg-purple-50/70 hover:bg-purple-100/80'
                }`}
              >
                <Bot size={16} />
                <span>AI Agent & Pipeline</span>
              </button>
            )}
          </div>

          {/* Favorites */}
          {!sidebarSearch.trim() && favoriteToolList.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                <Star size={11} fill="currentColor" />
                <span>Favorit ({favoriteToolList.length})</span>
              </div>
              {favoriteToolList.map((tool) => {
                const Icon = tool.icon;
                const active = activeTool?.id === tool.id;
                return (
                  <button
                    key={`side-fav-${tool.id}`}
                    type="button"
                    onClick={() => selectTool(tool)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{tool.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Categorized Accordions */}
          {sidebarCategorySections.map((section) => {
            if (section.count === 0) return null;
            const SectionIcon = section.icon;
            const isExpanded = Boolean(sidebarSearch.trim()) || expandedCategories[section.id];

            return (
              <div key={section.id} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCategories((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <SectionIcon size={14} className={section.accentText} />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                      {section.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">({section.count})</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-2.5 pl-1">
                    {section.subGroups.map((sub) => (
                      <div key={sub.name} className="space-y-0.5">
                        <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {sub.name}
                        </div>
                        {sub.items.map((tool) => {
                          const Icon = tool.icon;
                          const isActive = activeTool?.id === tool.id;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => selectTool(tool)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                  : 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <Icon
                                size={14}
                                className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                              />
                              <span className="truncate">{tool.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActiveWorkspaceTool = () => {
    if (!activeTool) {
      return (
        <AllToolsHub
          tools={NAV_TOOLS}
          favoriteIds={favoriteIds}
          recentIds={recentIds}
          onSelectTool={selectTool}
          onToggleFavorite={toggleFavorite}
        />
      );
    }

    if (activeTool.category === 'pdf' && activeTool.pdfTab) {
      const tab = activeTool.pdfTab;
      if (tab === 'merge') return <MergePDF />;
      if (tab === 'split') return <SplitPDF />;
      if (tab === 'reorder') return <ReorderPDF />;
      if (tab === 'rotate') return <RotatePDF />;
      if (tab === 'compress') return <CompressPDF />;
      if (tab === 'pdf-to-image') return <PDFToImage />;
      if (tab === 'image-to-pdf') return <ImageToPDF />;
      if (tab === 'watermark') return <WatermarkPDF />;
      if (tab === 'page-numbers') return <PageNumberPDF />;
      if (tab === 'unlock') return <UnlockPDF />;
      return <NewPDFToolsStudio key={tab} mode={tab} onSendToPipeline={handleSendToPipeline} />;
    }

    if (activeTool.category === 'image' && activeTool.imageTool) {
      return (
        <ImageToolsStudio
          activeToolId={activeTool.imageTool}
          onSelectToolId={(id) => {
            const match = findNavToolById(`image:${id}`);
            if (match) selectTool(match);
          }}
          onSendToPipeline={handleSendToPipeline}
        />
      );
    }

    if (activeTool.category === 'utility' && activeTool.utilityTool) {
      return (
        <UtilityToolsStudio
          activeToolId={activeTool.utilityTool}
          onSelectToolId={(id) => {
            const match = findNavToolById(`utility:${id}`);
            if (match) selectTool(match);
          }}
          onSendToPipeline={handleSendToPipeline}
        />
      );
    }

    return (
      <PipelineStudio
        key={pipelineTransferVersion}
        initialInputFiles={pendingPipelineFiles}
      />
    );
  };

  const isCurrentToolFavorited = activeTool ? favoriteIds.includes(activeTool.id) : false;

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Ambient Background Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-pink-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>
      <div className="fixed top-[30%] right-[5%] w-[25%] h-[25%] rounded-full bg-amber-300/20 blur-3xl mix-blend-multiply pointer-events-none"></div>

      {/* Header */}
      <header className="w-full relative z-30 border-b border-slate-200/70 bg-white/85 sticky top-0 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              aria-label="Buka Menu"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={openHub}
              className="flex items-center gap-2.5 text-left"
            >
              <img
                src="/icon.png"
                alt="Tenggoo Studio"
                width={30}
                height={30}
                className="block rounded-lg shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold text-purple-600 tracking-tight">
                  Tenggoo Studio
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  38 Tools • CLI & MCP
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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
              className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <Home size={15} />
              <span>Home</span>
            </a>

            <a
              href="https://github.com/alafgani1000/tenggoo_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden xs:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <aside
            className="relative z-50 w-72 max-w-[85vw] h-full bg-white shadow-2xl border-r border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarInner(false)}
          </aside>
        </div>
      )}

      {/* App Shell: Left Sidebar + Main Workspace */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex relative z-10">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden lg:block shrink-0 border-r border-slate-200/80 bg-white/75 backdrop-blur-md sticky top-[57px] h-[calc(100vh-57px)] transition-all duration-200 ${
            sidebarCollapsed ? 'w-16' : 'w-72'
          }`}
        >
          {renderSidebarInner(sidebarCollapsed)}
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col">
          {/* Privacy Notice Banner */}
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200/80 shadow-sm text-xs text-center leading-snug">
              <ShieldCheck size={15} className="shrink-0 text-emerald-600 hidden xs:inline-block" />
              <span>
                <strong>{privacyNotice.label}</strong> {privacyNotice.text}
              </span>
            </div>
          </div>

          {/* Breadcrumb & Tool Quick Actions Bar */}
          {activeTool && (
            <div className="w-full max-w-5xl mx-auto mb-5 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-sm text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={openHub}
                  className="font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <LayoutGrid size={13} /> Semua Fitur
                </button>
                <span>/</span>
                <span className="font-medium text-slate-600">
                  {CATEGORY_LABELS[activeTool.category]}
                </span>
                <span>/</span>
                <span className="hidden sm:inline text-slate-500">{activeTool.subGroup}</span>
                <span className="hidden sm:inline">/</span>
                <span className="font-bold text-slate-800">{activeTool.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(activeTool.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                    isCurrentToolFavorited
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Star size={13} fill={isCurrentToolFavorited ? 'currentColor' : 'none'} />
                  <span>{isCurrentToolFavorited ? 'Difavoritkan' : 'Favorit'}</span>
                </button>

                {activeTool.id !== 'pipeline:studio' && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = findNavToolById('pipeline:studio');
                      if (p) selectTool(p);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold"
                  >
                    <Workflow size={13} /> Pipeline Studio
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active Tool or Bento Hub */}
          <div className="flex-1 w-full pb-8">{renderActiveWorkspaceTool()}</div>

          {/* FAQ Keamanan & Privasi Section */}
          <FAQSection />
        </main>
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={paletteItems}
      />

      {/* Footer */}
      <footer className="w-full relative z-10 py-5 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
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
