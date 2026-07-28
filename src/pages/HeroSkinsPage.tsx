import { useMemo, useState } from 'react';
import { SkinTable } from '../components/SkinTable';
import type { QualityTagAsset, Skin } from '../types/skin';

type HeroSkinsPageProps = {
  skins: Skin[];
  qualityTags: QualityTagAsset[];
  onSelectSkin: (skin: Skin) => void;
};

type HeroSkinGroup = {
  heroName: string;
  roles: string[];
  skins: Skin[];
  latestDate: string | null;
};

function createHeroGroups(skins: Skin[]): HeroSkinGroup[] {
  const groups = new Map<string, Skin[]>();
  for (const skin of skins) {
    const current = groups.get(skin.heroName) ?? [];
    current.push(skin);
    groups.set(skin.heroName, current);
  }

  return Array.from(groups.entries())
    .map(([heroName, heroSkins]) => {
      const sortedSkins = [...heroSkins].sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
      return {
        heroName,
        roles: Array.from(new Set(heroSkins.flatMap((skin) => skin.heroRoles))).filter(Boolean),
        skins: sortedSkins,
        latestDate: sortedSkins[0]?.releaseDate ?? null,
      };
    })
    .sort((a, b) => b.skins.length - a.skins.length || (b.latestDate ?? '').localeCompare(a.latestDate ?? '') || a.heroName.localeCompare(b.heroName));
}

export function HeroSkinsPage({ skins, qualityTags, onSelectSkin }: HeroSkinsPageProps) {
  const heroGroups = useMemo(() => createHeroGroups(skins), [skins]);
  const [selectedHeroName, setSelectedHeroName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const selectedHero = heroGroups.find((group) => group.heroName === selectedHeroName) ?? heroGroups[0];
  const queryText = query.trim().toLowerCase();
  const visibleHeroes = heroGroups.filter((group) => !queryText || group.heroName.toLowerCase().includes(queryText) || group.roles.join(' ').toLowerCase().includes(queryText));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20 xl:h-[calc(100vh-96px)] xl:self-start xl:overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-xl font-bold text-slate-950">🎭 英雄皮肤</h2>
          <p className="mt-1 text-sm text-slate-500">按英雄皮肤数降序排列</p>
          <input
            className="mt-4 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索英雄 / 职业"
            value={query}
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2 xl:max-h-[calc(100vh-230px)]">
          {visibleHeroes.map((group, index) => (
            <button
              className={`mb-1 grid w-full grid-cols-[38px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition ${group.heroName === selectedHero.heroName ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
              key={group.heroName}
              onClick={() => setSelectedHeroName(group.heroName)}
              type="button"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${group.heroName === selectedHero.heroName ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{group.heroName}</span>
                <span className={`mt-0.5 block truncate text-xs ${group.heroName === selectedHero.heroName ? 'text-white/70' : 'text-slate-400'}`}>{group.roles.join('/') || '未知职业'}</span>
              </span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${group.heroName === selectedHero.heroName ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>{group.skins.length}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-blue-600">当前英雄</div>
              <h2 className="mt-1 text-3xl font-bold text-slate-950">{selectedHero?.heroName ?? '暂无英雄'}</h2>
              <p className="mt-2 text-sm text-slate-500">{selectedHero?.roles.join(' / ') || '未知职业'} · 皮肤按首次上线时间倒序</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 px-5 py-3">
                <div className="text-xs text-slate-400">皮肤数</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{selectedHero?.skins.length ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-5 py-3">
                <div className="text-xs text-slate-400">最新上线</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{selectedHero?.latestDate?.replace(/-/g, '/') ?? '未知'}</div>
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SkinTable onSelectSkin={onSelectSkin} qualityTags={qualityTags} skins={selectedHero?.skins ?? []} />
        </section>
      </section>
    </div>
  );
}
