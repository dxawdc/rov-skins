import { useEffect, useMemo, useState } from 'react';
import { loadSkinDataset } from './data/loadSkins';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { HeroSkinsPage } from './pages/HeroSkinsPage';
import { SkinDetailsPage } from './pages/SkinDetailsPage';
import { SkinDetailDrawer } from './components/SkinDetailDrawer';
import type { Skin, SkinDataset } from './types/skin';

type Tab = 'details' | 'heroSkins' | 'analytics';

const navItems: Array<{ key: Tab; label: string }> = [
  { key: 'details', label: '📋 皮肤明细' },
  { key: 'heroSkins', label: '🎭 英雄皮肤' },
  { key: 'analytics', label: '📊 统计分析' },
];

const dataSourceUrl = 'https://moonton.feishu.cn/wiki/O7GZw2GOzi3FAskd36ocojvhnac?sheet=0LLtTx';

export default function App() {
  const [dataset, setDataset] = useState<SkinDataset>({ skins: [], heroes: [], qualityTags: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('details');
  const [showDataSourceConfirm, setShowDataSourceConfirm] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<Skin | null>(null);

  useEffect(() => {
    loadSkinDataset().then((data) => {
      setDataset(data);
      setLoading(false);
    });
  }, []);

  const uniqueSkins = useMemo(() => new Set(dataset.skins.map((skin) => `${skin.heroName}::${skin.skinName}`)).size, [dataset.skins]);
  const heroCount = useMemo(() => new Set(dataset.skins.map((skin) => skin.heroName)).size, [dataset.skins]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <button className="text-left" onClick={() => setTab('details')} type="button">
            <div className="text-lg font-bold leading-none">ROV 皮肤数据库</div>
            <div className="mt-1 text-xs tracking-[0.24em] text-slate-400">ARENA OF VALOR · SKIN DATABASE</div>
          </button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 md:gap-5">
            <span className="rounded-full bg-slate-100 px-3 py-1">{dataset.skins.length.toLocaleString()} 条记录</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{heroCount.toLocaleString()} 位英雄</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{uniqueSkins.toLocaleString()} 款皮肤</span>
            <button className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50" onClick={() => window.location.reload()} type="button">🔄 刷新</button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">导航</div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${item.key === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                key={item.label}
                onClick={() => setTab(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
            <button
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => setShowDataSourceConfirm(true)}
              type="button"
            >
              🔗 数据源
            </button>
          </nav>

          <div className="mt-8 rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">数据概览</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>记录</span><strong>{dataset.skins.length.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span>英雄</span><strong>{heroCount.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span>皮肤</span><strong>{uniqueSkins.toLocaleString()}</strong></div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">正在加载皮肤数据…</div>
          ) : tab === 'details' ? (
            <SkinDetailsPage onSelectSkin={setSelectedSkin} qualityTags={dataset.qualityTags} skins={dataset.skins} />
          ) : tab === 'heroSkins' ? (
            <HeroSkinsPage onSelectSkin={setSelectedSkin} qualityTags={dataset.qualityTags} skins={dataset.skins} />
          ) : (
            <AnalyticsPage skins={dataset.skins} />
          )}
        </main>
      </div>

      <SkinDetailDrawer onClose={() => setSelectedSkin(null)} qualityTags={dataset.qualityTags} skin={selectedSkin} />
      {showDataSourceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setShowDataSourceConfirm(false)} role="presentation">
          <section aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2 className="text-lg font-bold text-slate-950">跳转到飞书数据源？</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">即将打开 ROV 皮肤数据源表格。你需要拥有该飞书文档的访问权限。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setShowDataSourceConfirm(false)} type="button">取消</button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { window.open(dataSourceUrl, '_blank', 'noopener,noreferrer'); setShowDataSourceConfirm(false); }} type="button">确认跳转</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
