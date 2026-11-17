import React, { useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  Clock,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Search,
  Star,
  X,
} from 'lucide-react';
import {
  CATEGORY_FILE_HINTS,
  CATEGORY_LABELS,
  getToolsByCategory,
  type NavCategoryId,
  type NavToolEntry,
} from './navigationCatalog.ts';

interface AllToolsHubProps {
  tools: NavToolEntry[];
  favoriteIds: string[];
  recentIds: string[];
  activeCategory?: 'all' | NavCategoryId;
  onCategoryChange?: (cat: 'all' | NavCategoryId) => void;
  onSelectTool: (tool: NavToolEntry) => void;
  onToggleFavorite: (toolId: string) => void;
}

const DOMAIN_TABS: {
  id: 'all' | NavCategoryId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
}[] = [
  {
    id: 'all',
    label: 'Semua Fitur',
    desc: 'Seluruh jenis file & otomasi',
    icon: Layers,
    accent: 'text-slate-700 bg-slate-100',
  },
  {
    id: 'pdf',
    label: CATEGORY_LABELS.pdf,
    desc: CATEGORY_FILE_HINTS.pdf,
    icon: FileText,
    accent: 'text-indigo-700 bg-indigo-50',
  },
  {
    id: 'image',
    label: CATEGORY_LABELS.image,
    desc: CATEGORY_FILE_HINTS.image,
    icon: ImageIcon,
    accent: 'text-teal-700 bg-teal-50',
  },
  {
    id: 'data',
    label: CATEGORY_LABELS.data,
    desc: CATEGORY_FILE_HINTS.data,
    icon: FileSpreadsheet,
    accent: 'text-amber-700 bg-amber-50',
  },
  {
    id: 'utility',
    label: CATEGORY_LABELS.utility,
    desc: CATEGORY_FILE_HINTS.utility,
    icon: Archive,
    accent: 'text-orange-700 bg-orange-50',
  },
  {
    id: 'pipeline',
    label: CATEGORY_LABELS.pipeline,
    desc: CATEGORY_FILE_HINTS.pipeline,
    icon: Bot,
    accent: 'text-purple-700 bg-purple-50',
  },
];

export const AllToolsHub: React.FC<AllToolsHubProps> = ({
  tools,
  favoriteIds,
  recentIds,
  activeCategory,
  onCategoryChange,
  onSelectTool,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');
  const [internalCategory, setInternalCategory] = useState<'all' | NavCategoryId>('all');

  const categoryFilter = activeCategory ?? internalCategory;
  const handleCategorySelect = (cat: 'all' | NavCategoryId) => {
    setInternalCategory(cat);
    onCategoryChange?.(cat);
  };

  const favoriteTools = useMemo(
    () =>
      favoriteIds
        .map((id) => tools.find((t) => t.id === id))
        .filter((t): t is NavToolEntry => Boolean(t)),
    [favoriteIds, tools],
  );

  const recentTools = useMemo(
    () =>
      recentIds
        .map((id) => tools.find((t) => t.id === id))
        .filter((t): t is NavToolEntry => Boolean(t))
        .slice(0, 4),
    [recentIds, tools],
  );

  const counts = useMemo(
    () => ({
      all: tools.length,
      pdf: getToolsByCategory('pdf').length,
      image: getToolsByCategory('image').length,
      data: getToolsByCategory('data').length,
      utility: getToolsByCategory('utility').length,
      pipeline: getToolsByCategory('pipeline').length,
    }),
    [tools],
  );

  const groupedByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categories: NavCategoryId[] =
      categoryFilter === 'all' ? ['pdf', 'image', 'data', 'utility', 'pipeline'] : [categoryFilter];

    return categories
      .map((cat) => {
        const catTools = getToolsByCategory(cat).filter((tool) => {
          if (!q) return true;
          return `${tool.name} ${tool.shortDesc} ${tool.handledFiles} ${tool.subGroup} ${CATEGORY_LABELS[cat]} ${CATEGORY_FILE_HINTS[cat]}`
            .toLowerCase()
            .includes(q);
        });

        const subGroups: { name: string; items: NavToolEntry[] }[] = [];
        for (const item of catTools) {
          let group = subGroups.find((g) => g.name === item.subGroup);
          if (!group) {
            group = { name: item.subGroup, items: [] };
            subGroups.push(group);
          }
          group.items.push(item);
        }
        return {
          category: cat,
          label: CATEGORY_LABELS[cat],
          fileHint: CATEGORY_FILE_HINTS[cat],
          count: catTools.length,
          subGroups,
        };
      })
      .filter((section) => section.count > 0);
  }, [categoryFilter, query]);

  const renderToolCard = (tool: NavToolEntry, keyPrefix: string) => {
    const Icon = tool.icon;
    const isFav = favoriteIds.includes(tool.id);

    return (
      <div
        key={`${keyPrefix}${tool.id}`}
        className="group relative bg-white rounded-xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-sm transition-all overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onSelectTool(tool)}
          className="w-full h-full text-left p-4 pr-10 flex flex-col gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border shrink-0 ${tool.badgeColor}`}>
              <Icon size={17} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 truncate transition-colors">
                {tool.name}
              </h4>
              <span className="block text-[11px] font-medium text-slate-400 truncate">
                {tool.subGroup}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.shortDesc}</p>
          <div className="mt-auto pt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
              {tool.handledFiles}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(tool.id)}
          title={isFav ? 'Hapus dari Favorit' : 'Sematkan ke Favorit'}
          aria-label={isFav ? 'Hapus dari Favorit' : 'Sematkan ke Favorit'}
          className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${
            isFav
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100 opacity-70 group-hover:opacity-100'
          }`}
        >
          <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      {/* Compact Studio Hub Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {categoryFilter === 'all'
                  ? 'Katalog Fitur Kerja'
                  : `Semua ${CATEGORY_LABELS[categoryFilter]}`}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {counts[categoryFilter]} fitur &bull; 100% Lokal
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Dikelompokkan berdasarkan jenis file yang ditangani (.pdf, gambar JPG/PNG/WebP, dokumen
              MD/CSV/JSON, dan arsip ZIP).
            </p>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter fitur (misal: sensor, qr, pas foto)..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Domain Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          {DOMAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleCategorySelect(tab.id)}
                className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50/60 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    active ? 'bg-white/15 text-white' : tab.accent
                  }`}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{tab.label}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                      }`}
                    >
                      {counts[tab.id]}
                    </span>
                  </div>
                  <p
                    className={`text-[10px] mt-0.5 line-clamp-1 ${
                      active ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {tab.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorites Section */}
      {!query.trim() && categoryFilter === 'all' && favoriteTools.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 px-0.5">
            <Star size={13} fill="currentColor" />
            <span>Favorit ({favoriteTools.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteTools.map((tool) => renderToolCard(tool, 'fav-'))}
          </div>
        </section>
      )}

      {/* Recent Tools Section */}
      {!query.trim() && categoryFilter === 'all' && recentTools.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-0.5">
            <Clock size={13} />
            <span>Terakhir Dipakai</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={`recent-${tool.id}`}
                  type="button"
                  onClick={() => onSelectTool(tool)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 text-xs font-semibold text-slate-700 shadow-sm transition-colors"
                >
                  <Icon size={13} className="text-slate-400" />
                  <span>{tool.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Categorized Bento Catalog */}
      {groupedByCategory.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-sm text-slate-500">
          Tidak ada fitur yang cocok dengan pencarian &ldquo;{query}&rdquo;.
        </div>
      ) : (
        groupedByCategory.map((section) => (
          <section key={section.category} className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{section.label}</h2>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                  {section.fileHint}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {section.count} fitur
              </span>
            </div>

            {section.subGroups.map((sub) => (
              <div key={`${section.category}-${sub.name}`} className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {sub.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sub.items.map((tool) => renderToolCard(tool, `${section.category}-`))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
};
