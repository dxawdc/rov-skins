import { useMemo, useState } from 'react';
import { SkinTable } from '../components/SkinTable';
import type { QualityTagAsset, Skin } from '../types/skin';
import { uniqueOptions } from '../utils/filters';

type SkinDetailsPageProps = {
  skins: Skin[];
  qualityTags: QualityTagAsset[];
  onSelectSkin: (skin: Skin) => void;
};

type DetailFilters = {
  query: string;
  hero: string;
  quality: string;
  qualityTag: string;
  obtainMethod: string;
  year: string;
};

const pageSize = 50;

const initialFilters: DetailFilters = {
  query: '',
  hero: 'all',
  quality: 'all',
  qualityTag: 'all',
  obtainMethod: 'all',
  year: 'all',
};

export function SkinDetailsPage({ skins, qualityTags, onSelectSkin }: SkinDetailsPageProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);

  const options = useMemo(
    () => ({
      heroes: uniqueOptions(skins.map((skin) => skin.heroName)),
      qualities: uniqueOptions(skins.map((skin) => skin.quality)),
      qualityTags: uniqueOptions(skins.map((skin) => skin.qualityTag)),
      obtainMethods: uniqueOptions(skins.map((skin) => skin.obtainMethod)),
      years: uniqueOptions(skins.map((skin) => skin.releaseYear)).sort((a, b) => Number(b) - Number(a)),
    }),
    [skins],
  );

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return skins
      .filter((skin) => {
        if (query && !skin.searchText.toLowerCase().includes(query)) return false;
        if (filters.hero !== 'all' && skin.heroName !== filters.hero) return false;
        if (filters.quality !== 'all' && skin.quality !== filters.quality) return false;
        if (filters.qualityTag !== 'all' && skin.qualityTag !== filters.qualityTag) return false;
        if (filters.obtainMethod !== 'all' && skin.obtainMethod !== filters.obtainMethod) return false;
        if (filters.year !== 'all' && String(skin.releaseYear ?? '') !== filters.year) return false;
        return true;
      })
      .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  }, [filters, skins]);

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateFilters(next: Partial<DetailFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <input
            className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder="🔍 搜索英雄、皮肤、品质、获取方式"
            value={filters.query}
          />
          <select className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => updateFilters({ hero: event.target.value })} value={filters.hero}>
            <option value="all">全部英雄</option>
            {options.heroes.map((hero) => <option key={hero}>{hero}</option>)}
          </select>
          <select className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => updateFilters({ quality: event.target.value })} value={filters.quality}>
            <option value="all">全部品质</option>
            {options.qualities.map((quality) => <option key={quality}>{quality}</option>)}
          </select>
          <select className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => updateFilters({ qualityTag: event.target.value })} value={filters.qualityTag}>
            <option value="all">全部皮肤标签</option>
            {options.qualityTags.map((tag) => <option key={tag}>{tag}</option>)}
          </select>
          <select className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => updateFilters({ obtainMethod: event.target.value })} value={filters.obtainMethod}>
            <option value="all">全部获取方式</option>
            {options.obtainMethods.map((method) => <option key={method}>{method}</option>)}
          </select>
          <select className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm" onChange={(event) => updateFilters({ year: event.target.value })} value={filters.year}>
            <option value="all">全部年份</option>
            {options.years.map((year) => <option key={year}>{year}</option>)}
          </select>
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50" onClick={() => updateFilters(initialFilters)} type="button">
            ✕ 清除
          </button>
        </div>
        <div className="mt-3 text-sm text-slate-500">当前筛选 {filtered.length} 款 · 第 {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} 条</div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SkinTable onSelectSkin={onSelectSkin} qualityTags={qualityTags} skins={pageRows} />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>共 {filtered.length} 条 · 第 {currentPage}/{pageCount} 页</span>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(value - 1, 1))} type="button">‹</button>
            <button className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(value + 1, pageCount))} type="button">›</button>
          </div>
        </div>
      </section>
    </div>
  );
}
