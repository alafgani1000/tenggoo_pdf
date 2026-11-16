import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Clock,
  FileText,
  Image as ImageIcon,
  Layers,
  QrCode,
  Search,
  Star,
} from 'lucide-react';
import { CATEGORY_LABELS, type NavCategoryId, type NavToolEntry } from './navigationCatalog.ts';

interface AllToolsHubProps {
  tools: NavToolEntry[];
  favoriteIds: string[];
  recentIds: string[];
  onSelectTool: (tool: NavToolEntry) => void;
  onToggleFavorite: (toolId: string) => void;
}

export const AllToolsHub: React.FC<AllToolsHubProps> = ({
  tools,
  favoriteIds,
  recentIds,
  onSelectTool,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NavCategoryId>('all');

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
        .filter((t): t is NavToolEntry => Boolean(t)),
    [recentIds, tools],
  );

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
      if (!q) return true;
      return `${tool.name} ${tool.shortDesc} ${tool.subGroup} ${CATEGORY_LABELS[tool.category]}`
        .toLowerCase()
        .includes(q);
    });
  }, [tools, query, categoryFilter]);

  const groupedByCategory = useMemo(() => {
    const categories: NavCategoryId[] = ['pdf', 'image', 'utility', 'pipeline'];
    return categories
      .map((cat) => {
        const catTools = filteredTools.filter((t) => t.category === cat);
        const subGroups: { name: string; items: NavToolEntry[] }[] = [];
        for (const item of catTools) {
          let group = subGroups.find((g) => g.name === item.subGroup);
          if (!group) {
            group = { name: item.subGroup, items: [] };
            subGroups.push(group);
          }
          group.items.push(item);
        }
        return { category: cat, label: CATEGORY_LABELS[cat], count: catTools.length, subGroups };
      })
      .filter((section) => section.count > 0);
  }, [filteredTools]);

  const counts = useMemo(
    () => ({
      all: tools.length,
      pdf: tools.filter((t) => t.category === 'pdf').length,
      image: tools.filter((t) => t.category === 'image').length,
      utility: tools.filter((t) => t.category === 'utility').length,
      pipeline: tools.filter((t) => t.category === 'pipeline').length,
    }),
    [tools],
  );

  const renderToolCard = (tool: NavToolEntry) => {
    const Icon = tool.icon;
    const isFav = favoriteIds.includes(tool.id);

    return (
      <div
        key={tool.id}
        className="group relative bg-white/85 backdrop-blur-sm rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between p-4"
      >
        <button
          type="button"
          onClick={() => onToggleFavorite(tool.id)}
          title={isFav ? 'Hapus dari Favorit' : 'Sematkan ke Favorit'}
          aria-label={isFav ? 'Hapus dari Favorit' : 'Sematkan ke Favorit'}
          className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${
            isFav
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100 opacity-80 group-hover:opacity-100'
          }`}
        >
          <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          onClick={() => onSelectTool(tool)}
          className="text-left flex flex-col gap-2.5 pr-6"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${tool.badgeColor}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 truncate">
                {tool.name}
              </h4>
              <span className="text-[10px] font-semibold text-slate-400">
                {tool.subGroup}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {tool.shortDesc}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectTool(tool)}
          className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-600 group-hover:text-indigo-700"
        >
          <span>Buka Tool</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      {/* Hero + Search */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              Katalog Semua Fitur Tenggoo Studio
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Pilih fitur di bawah atau klik bintang (★) untuk menyematkan tool favorit ke sidebar.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter fitur (misal: sensor, qr, tabel)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `Semua (${counts.all})`, icon: Layers },
            { id: 'pdf', label: `PDF Tools (${counts.pdf})`, icon: FileText },
            { id: 'image', label: `Image Tools (${counts.image})`, icon: ImageIcon },
            { id: 'utility', label: `Doc & Utilities (${counts.utility})`, icon: QrCode },
            { id: 'pipeline', label: `AI & Pipeline (${counts.pipeline})`, icon: Bot },
          ].map((pill) => {
            const Icon = pill.icon;
            const active = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategoryFilter(pill.id as typeof categoryFilter)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} />
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorites Section */}
      {!query.trim() && categoryFilter === 'all' && favoriteTools.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700">
            <Star size={14} fill="currentColor" />
            <span>Favorit Saya ({favoriteTools.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteTools.map(renderToolCard)}
          </div>
        </section>
      )}

      {/* Recent Tools Section */}
      {!query.trim() && categoryFilter === 'all' && recentTools.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <Clock size={14} />
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-xs font-semibold text-slate-700 shadow-sm transition-all"
                >
                  <Icon size={14} className="text-indigo-600" />
                  <span>{tool.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Categorized Bento Catalog */}
      {groupedByCategory.length === 0 ? (
        <div className="bg-white/80 rounded-2xl p-10 text-center border border-slate-200 text-sm text-slate-500">
          Tidak ada fitur yang cocok dengan pencarian &ldquo;{query}&rdquo;.
        </div>
      ) : (
        groupedByCategory.map((section) => (
          <section key={section.category} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h2 className="text-lg font-extrabold text-slate-800">{section.label}</h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {section.count} Tool
              </span>
            </div>

            {section.subGroups.map((sub) => (
              <div key={sub.name} className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {sub.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sub.items.map(renderToolCard)}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
};
