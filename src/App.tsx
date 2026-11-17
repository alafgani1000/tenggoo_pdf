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
  CATEGORY_FILE_HINTS,
  CATEGORY_LABELS,
  NAV_TOOLS,
  findNavToolByHash,
  findNavToolById,
  getToolsByCategory,
  type NavCategoryId,
  type NavToolEntry,
} from './components/navigationCatalog';
import { FAQSection, PrivacyPolicyView } from './components/FAQSection';
import type { VirtualFile } from './core/types';
import {
  Archive,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Star,
  Workflow,
  X,
} from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'tenggoo_favorite_tools_v1';
const RECENTS_STORAGE_KEY = 'tenggoo_recent_tools_v1';

type ActiveView =
  | { kind: 'hub' }
  | { kind: 'privacy' }
  | { kind: 'faq' }
  | { kind: 'tool'; toolId: string };

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
  if (hash === 'privacy-policy' || hash === 'privasi' || hash === 'keamanan') {
    return { kind: 'privacy' };
  }
  if (hash === 'faq') {
    return { kind: 'faq' };
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
  const [hubCategory, setHubCategory] = useState<'all' | NavCategoryId>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<NavCategoryId, boolean>>({
    pdf: true,
    image: false,
    data: false,
    utility: false,
    pipeline: false,
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
    if (activeView.kind === 'privacy') {
      document.title = 'Privacy & Policy | Work Tool Super App';
      return;
    }
    if (activeView.kind === 'faq') {
      document.title = 'FAQ Keamanan | Work Tool Super App';
      return;
    }
    if (!activeTool) {
      document.title = 'Work Tool Super App — PDF, Image, Utilities & AI Agent';
      return;
    }
    document.title = `${activeTool.name} | Work Tool Super App`;
  }, [activeTool, activeView.kind]);

  const openHub = useCallback(() => {
    setHubCategory('all');
    setActiveView({ kind: 'hub' });
    setMobileDrawerOpen(false);
    window.history.pushState(null, '', '#semua-fitur');
  }, []);

  const openCategoryHub = useCallback((cat: 'all' | NavCategoryId) => {
    setHubCategory(cat);
    setActiveView({ kind: 'hub' });
    setMobileDrawerOpen(false);
    if (cat !== 'all') {
      setExpandedCategories({
        pdf: cat === 'pdf',
        image: cat === 'image',
        data: cat === 'data',
        utility: cat === 'utility',
        pipeline: cat === 'pipeline',
      });
    }
    window.history.pushState(null, '', '#semua-fitur');
  }, []);

  const openPrivacy = useCallback(() => {
    setActiveView({ kind: 'privacy' });
    setMobileDrawerOpen(false);
    window.history.pushState(null, '', '#privacy-policy');
  }, []);

  const openFaq = useCallback(() => {
    setActiveView({ kind: 'faq' });
    setMobileDrawerOpen(false);
    window.history.pushState(null, '', '#faq');
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
      setExpandedCategories({
        pdf: tool.category === 'pdf',
        image: tool.category === 'image',
        data: tool.category === 'data',
        utility: tool.category === 'utility',
        pipeline: tool.category === 'pipeline',
      });
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
      subtitle: `Lihat seluruh ${NAV_TOOLS.length} fitur PDF, Image, Utility & Pipeline dalam satu halaman`,
      categoryLabel: 'Navigasi',
      keywords: 'home hub semua fitur katalog all tools',
      onSelect: openHub,
    };

    const privacyEntry: CommandPaletteItem = {
      id: 'cmd-privacy-policy',
      title: 'Privacy & Policy (Kebijakan Privasi)',
      subtitle: 'Penjelasan arsitektur 100% client-side, komitmen data, dan verifikasi offline',
      categoryLabel: 'Privacy & Policy',
      keywords: 'privacy policy privasi kebijakan keamanan security offline client-side',
      onSelect: openPrivacy,
    };

    const faqEntry: CommandPaletteItem = {
      id: 'cmd-faq-security',
      title: 'FAQ (Pertanyaan Umum seputar Keamanan)',
      subtitle: 'Daftar tanya jawab mengenai keamanan dokumen, kata sandi, redaksi & teknologi lokal',
      categoryLabel: 'Privacy & Policy',
      keywords: 'faq pertanyaan umum keamanan bocor password client-side wasm',
      onSelect: openFaq,
    };

    const toolEntries: CommandPaletteItem[] = NAV_TOOLS.map((tool) => ({
      id: `cmd-${tool.id}`,
      title: tool.name,
      subtitle: `${tool.subGroup} (${tool.handledFiles}) — ${tool.shortDesc}`,
      categoryLabel: CATEGORY_LABELS[tool.category],
      keywords: `${tool.name} ${tool.shortDesc} ${tool.handledFiles} ${tool.subGroup} ${tool.category} ${tool.hash}`,
      onSelect: () => selectTool(tool),
    }));

    return [hubEntry, privacyEntry, faqEntry, ...toolEntries];
  }, [openHub, openPrivacy, openFaq, selectTool]);

  const favoriteToolList = useMemo(
    () =>
      favoriteIds
        .map((id) => findNavToolById(id))
        .filter((t): t is NavToolEntry => Boolean(t)),
    [favoriteIds],
  );

  const sidebarCategorySections = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    const defs: {
      id: Exclude<NavCategoryId, 'pipeline'>;
      label: string;
      fileHint: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      accentText: string;
    }[] = [
      {
        id: 'pdf',
        label: CATEGORY_LABELS.pdf,
        fileHint: CATEGORY_FILE_HINTS.pdf,
        icon: FileText,
        accentText: 'text-indigo-600',
      },
      {
        id: 'image',
        label: CATEGORY_LABELS.image,
        fileHint: CATEGORY_FILE_HINTS.image,
        icon: ImageIcon,
        accentText: 'text-teal-600',
      },
      {
        id: 'data',
        label: CATEGORY_LABELS.data,
        fileHint: CATEGORY_FILE_HINTS.data,
        icon: FileSpreadsheet,
        accentText: 'text-amber-600',
      },
      {
        id: 'utility',
        label: CATEGORY_LABELS.utility,
        fileHint: CATEGORY_FILE_HINTS.utility,
        icon: Archive,
        accentText: 'text-orange-600',
      },
    ];

    return defs.map((sec) => {
      const items = getToolsByCategory(sec.id).filter((t) => {
        if (!q) return true;
        return `${t.name} ${t.shortDesc} ${t.handledFiles} ${t.subGroup} ${CATEGORY_LABELS[sec.id]} ${sec.fileHint}`
          .toLowerCase()
          .includes(q);
      });
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
  }, [sidebarSearch]);

  const renderSidebarInner = (isCompactRail: boolean) => {
    const pipelineTool = findNavToolById('pipeline:studio');
    const isHubActive = activeView.kind === 'hub';
    const isPrivacyActive = activeView.kind === 'privacy';
    const isFaqActive = activeView.kind === 'faq';

    if (isCompactRail) {
      return (
        <div className="flex flex-col items-center justify-between h-full py-3">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Perluas Sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
            <button
              type="button"
              onClick={openHub}
              className={`p-2.5 rounded-xl transition-colors ${
                isHubActive && hubCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Semua Fitur"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              onClick={() => openCategoryHub('pdf')}
              className={`p-2.5 rounded-xl transition-colors ${
                (isHubActive && hubCategory === 'pdf') || activeTool?.category === 'pdf'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
              title={`${CATEGORY_LABELS.pdf} (${CATEGORY_FILE_HINTS.pdf})`}
            >
              <FileText size={18} />
            </button>
            <button
              type="button"
              onClick={() => openCategoryHub('image')}
              className={`p-2.5 rounded-xl transition-colors ${
                (isHubActive && hubCategory === 'image') || activeTool?.category === 'image'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-teal-600 hover:bg-teal-50'
              }`}
              title={`${CATEGORY_LABELS.image} (${CATEGORY_FILE_HINTS.image})`}
            >
              <ImageIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => openCategoryHub('data')}
              className={`p-2.5 rounded-xl transition-colors ${
                (isHubActive && hubCategory === 'data') || activeTool?.category === 'data'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
              title={`${CATEGORY_LABELS.data} (${CATEGORY_FILE_HINTS.data})`}
            >
              <FileSpreadsheet size={18} />
            </button>
            <button
              type="button"
              onClick={() => openCategoryHub('utility')}
              className={`p-2.5 rounded-xl transition-colors ${
                (isHubActive && hubCategory === 'utility') || activeTool?.category === 'utility'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-orange-600 hover:bg-orange-50'
              }`}
              title={`${CATEGORY_LABELS.utility} (${CATEGORY_FILE_HINTS.utility})`}
            >
              <Archive size={18} />
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
            <div className="w-7 h-px bg-slate-200 my-1" />
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title={fav.name}
                >
                  <Icon size={17} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={openPrivacy}
              className={`p-2.5 rounded-xl transition-colors ${
                isPrivacyActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
              title="Privacy & Policy"
            >
              <ShieldCheck size={18} />
            </button>
            <button
              type="button"
              onClick={openFaq}
              className={`p-2.5 rounded-xl transition-colors ${
                isFaqActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="FAQ Keamanan"
            >
              <CircleQuestionMark size={18} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Top Controls + Search */}
        <div className="p-3 border-b border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Menu Berdasarkan File
            </span>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 focus:bg-white text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isHubActive && hubCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid size={15} />
              <span>Semua Fitur</span>
              <span
                className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isHubActive && hubCategory === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {NAV_TOOLS.length}
              </span>
            </button>

            {pipelineTool && (
              <button
                type="button"
                onClick={() => selectTool(pipelineTool)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool?.id === pipelineTool.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80'
                }`}
              >
                <Bot size={15} />
                <span>AI Agent &amp; Pipeline</span>
              </button>
            )}
          </div>

          {/* Favorites */}
          {!sidebarSearch.trim() && favoriteToolList.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
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
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
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
            const isSectionSelected = isHubActive && hubCategory === section.id;

            return (
              <div key={section.id} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const shouldCollapse =
                      isExpanded && activeView.kind === 'hub' && hubCategory === section.id;
                    setExpandedCategories({
                      pdf: section.id === 'pdf' ? !shouldCollapse : false,
                      image: section.id === 'image' ? !shouldCollapse : false,
                      data: section.id === 'data' ? !shouldCollapse : false,
                      utility: section.id === 'utility' ? !shouldCollapse : false,
                      pipeline: false,
                    });
                    if (!shouldCollapse) {
                      openCategoryHub(section.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isSectionSelected ? 'bg-slate-100' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <SectionIcon size={14} className={`${section.accentText} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate">
                          {section.label}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({section.count})
                        </span>
                      </div>
                      <span className="block text-[10px] font-medium text-slate-400 truncate">
                        {section.fileHint}
                      </span>
                    </div>
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
                      <div key={`${section.id}-${sub.name}`} className="space-y-0.5">
                        <div className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          {sub.name}
                        </div>
                        {sub.items.map((tool) => {
                          const Icon = tool.icon;
                          const isActive = activeTool?.id === tool.id;
                          return (
                            <button
                              key={`${section.id}-${tool.id}`}
                              type="button"
                              onClick={() => selectTool(tool)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
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

        {/* Sticky Sidebar Footer: Grup Menu Privacy & Policy */}
        <div className="p-2.5 border-t border-slate-200/80 bg-white space-y-1">
          <div className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Privacy &amp; Policy
          </div>
          <button
            type="button"
            onClick={openPrivacy}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isPrivacyActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-900 bg-emerald-50/70 hover:bg-emerald-100/80'
            }`}
          >
            <ShieldCheck
              size={14}
              className={`shrink-0 ${isPrivacyActive ? 'text-white' : 'text-emerald-600'}`}
            />
            <span className="truncate">Privacy &amp; Policy</span>
          </button>
          <button
            type="button"
            onClick={openFaq}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isFaqActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CircleQuestionMark
              size={14}
              className={`shrink-0 ${isFaqActive ? 'text-white' : 'text-indigo-600'}`}
            />
            <span className="truncate">FAQ Keamanan</span>
          </button>
        </div>
      </div>
    );
  };

  const renderActiveWorkspaceTool = () => {
    if (activeView.kind === 'privacy') {
      return <PrivacyPolicyView onOpenFaq={openFaq} />;
    }

    if (activeView.kind === 'faq') {
      return <FAQSection onOpenPrivacy={openPrivacy} />;
    }

    if (!activeTool) {
      return (
        <AllToolsHub
          tools={NAV_TOOLS}
          favoriteIds={favoriteIds}
          recentIds={recentIds}
          activeCategory={hubCategory}
          onCategoryChange={openCategoryHub}
          onSelectTool={selectTool}
          onToggleFavorite={toggleFavorite}
        />
      );
    }

    if (activeTool.pdfTab) {
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

    if (activeTool.imageTool) {
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

    if (activeTool.utilityTool) {
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
  const isPrivacyActive = activeView.kind === 'privacy';
  const isFaqActive = activeView.kind === 'faq';
  const showBreadcrumb = Boolean(activeTool) || isPrivacyActive || isFaqActive;
  const sameCategoryTools = useMemo(
    () => (activeTool ? getToolsByCategory(activeTool.category) : []),
    [activeTool],
  );
  const pipelineTool = useMemo(() => findNavToolById('pipeline:studio'), []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Studio Top Header */}
      <header className="w-full sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
                alt="Work Tool Super App"
                width={28}
                height={28}
                className="block rounded-lg shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Work Tool Super App
                </span>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  v2.0 Local
                </span>
              </div>
            </button>
          </div>

          {/* Primary Domain Menu Tabs */}
          <nav
            aria-label="Kategori File"
            className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70"
          >
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'pdf', label: 'File PDF' },
                { id: 'image', label: 'File Gambar' },
                { id: 'data', label: 'Teks & Data' },
                { id: 'utility', label: 'Arsip & File' },
              ] as const
            ).map((item) => {
              const isSelected =
                (activeView.kind === 'hub' && hubCategory === item.id) ||
                (item.id !== 'all' && activeTool?.category === item.id);
              return (
                <button
                  key={`header-cat-${item.id}`}
                  type="button"
                  onClick={() => openCategoryHub(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            {pipelineTool && (
              <button
                type="button"
                onClick={() => selectTool(pipelineTool)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool?.id === pipelineTool.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-700 hover:bg-white/80'
                }`}
              >
                Pipeline
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 px-2.5 py-1.5 rounded-lg transition-colors"
              title="Cari fitur cepat (Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Cari Fitur</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={openPrivacy}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                isPrivacyActive
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
              }`}
              title="Privacy & Policy"
            >
              <ShieldCheck size={14} className={isPrivacyActive ? 'text-white' : 'text-emerald-600'} />
              <span className="hidden md:inline">Privacy &amp; Policy</span>
            </button>

            <button
              type="button"
              onClick={openFaq}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                isFaqActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
              }`}
              title="Menu Khusus FAQ"
            >
              <CircleQuestionMark size={14} className={isFaqActive ? 'text-white' : 'text-indigo-600'} />
              <span className="hidden xs:inline">FAQ</span>
            </button>

            <a
              href="https://github.com/alafgani1000/tenggoo_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
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
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden lg:block shrink-0 border-r border-slate-200/80 bg-white sticky top-14 h-[calc(100vh-56px)] transition-all duration-200 ${
            sidebarCollapsed ? 'w-16' : 'w-72'
          }`}
        >
          {renderSidebarInner(sidebarCollapsed)}
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col">
          {/* Thin Workspace Breadcrumb & Quick Actions */}
          {showBreadcrumb && (
            <div className="w-full max-w-5xl mx-auto mb-5 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 shadow-sm text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={openHub}
                  className="font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <LayoutGrid size={13} /> Semua Fitur
                </button>
                <span>/</span>
                {isPrivacyActive ? (
                  <span className="font-bold text-slate-900">Privacy &amp; Policy</span>
                ) : isFaqActive ? (
                  <>
                    <button
                      type="button"
                      onClick={openPrivacy}
                      className="font-medium text-slate-600 hover:text-indigo-600 hover:underline"
                    >
                      Privacy &amp; Policy
                    </button>
                    <span>/</span>
                    <span className="font-bold text-slate-900">FAQ</span>
                  </>
                ) : (
                  activeTool && (
                    <>
                      <button
                        type="button"
                        onClick={() => openCategoryHub(activeTool.category)}
                        className="font-medium text-slate-600 hover:text-indigo-600 hover:underline"
                      >
                        {CATEGORY_LABELS[activeTool.category]}
                      </button>
                      <span>/</span>
                      <span className="hidden sm:inline text-slate-500">{activeTool.subGroup}</span>
                      <span className="hidden sm:inline">/</span>
                      <span className="font-bold text-slate-900">{activeTool.name}</span>
                    </>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeTool && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(activeTool.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                      isCurrentToolFavorited
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Star size={12} fill={isCurrentToolFavorited ? 'currentColor' : 'none'} />
                    <span>{isCurrentToolFavorited ? 'Difavoritkan' : 'Favorit'}</span>
                  </button>
                )}

                {activeTool?.id !== 'pipeline:studio' && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = findNavToolById('pipeline:studio');
                      if (p) selectTool(p);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 font-semibold transition-colors"
                  >
                    <Workflow size={12} /> Pipeline Studio
                  </button>
                )}
              </div>
            </div>
          )}

          {/* In-Tool Quick Switcher Bar: Fitur Sejenis */}
          {activeTool && sameCategoryTools.length > 1 && (
            <div className="w-full max-w-5xl mx-auto mb-5 px-3 py-2 rounded-xl bg-white/90 border border-slate-200/70 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">
                {CATEGORY_LABELS[activeTool.category]}:
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {sameCategoryTools.map((sibling) => {
                  const Icon = sibling.icon;
                  const active = sibling.id === activeTool.id;
                  return (
                    <button
                      key={`sibling-${sibling.id}`}
                      type="button"
                      onClick={() => selectTool(sibling)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-slate-900 text-white font-semibold shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                      }`}
                    >
                      <Icon size={12} className={active ? 'text-white' : 'text-slate-400'} />
                      <span>{sibling.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Tool, Privacy Page, or Bento Hub */}
          <div className="flex-1 w-full pb-6">{renderActiveWorkspaceTool()}</div>
        </main>
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={paletteItems}
      />

      {/* Minimal 1-Line Studio Footer */}
      <footer className="w-full py-3.5 px-4 text-xs text-slate-500 border-t border-slate-200/80 bg-white">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} Work Tool Super App &bull; 100% Client-Side Local Workspace</p>
          <div className="flex items-center gap-4 font-medium">
            <button
              type="button"
              onClick={openHub}
              className="hover:text-slate-900 transition-colors"
            >
              Katalog Fitur
            </button>
            <button
              type="button"
              onClick={openPrivacy}
              className="hover:text-emerald-700 transition-colors"
            >
              Privacy &amp; Policy
            </button>
            <button
              type="button"
              onClick={openFaq}
              className="hover:text-indigo-700 transition-colors"
            >
              FAQ
            </button>
            <a
              href="https://github.com/alafgani1000/tenggoo_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
