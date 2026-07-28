import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { Skin } from '../types/skin';
import { uniqueOptions } from '../utils/filters';

type AnalyticsPageProps = {
  skins: Skin[];
};

type ObtainGroup = '全部' | '免费' | '赛季' | '战令' | '付费';

const qualityColors = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#475569', '#db2777'];
const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const toolbox = { feature: { saveAsImage: { title: '保存' }, dataView: { title: '数据', readOnly: true }, restore: { title: '还原' } } };

function uniqueSkinKey(skin: Skin) {
  return `${skin.heroName}::${skin.skinName}`;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value || '未知'] = (acc[value || '未知'] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getObtainGroup(method: string): Exclude<ObtainGroup, '全部'> {
  if (/免费|登录|签到|活动免费|免单/.test(method)) return '免费';
  if (/赛季/.test(method)) return '赛季';
  if (/战令/.test(method)) return '战令';
  return '付费';
}

function StatCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-bold text-slate-950">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="mt-1 text-xs text-slate-400">{note}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </section>
  );
}

function buildStackedOption(categories: string[], qualities: string[], matrix: Record<string, Record<string, number>>, showLabels: boolean, selectedQualities: string[], legendSelection: Record<string, boolean>, onClickHint = false): EChartsOption {
  const totals = categories.map((category) => sum(selectedQualities.map((quality) => matrix[category]?.[quality] ?? 0)));

  return {
    color: qualityColors,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => `${value} 款`,
    },
    legend: { top: 0, type: 'scroll', selected: legendSelection, selectedMode: true },
    toolbox,
    grid: { left: 42, right: 52, top: 64, bottom: categories.length > 12 ? 72 : 42 },
    dataZoom: categories.length > 12 ? [{ type: 'slider', bottom: 18, height: 20 }, { type: 'inside' }] : undefined,
    xAxis: { type: 'category', data: categories, axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', minInterval: 1, name: '皮肤数' },
    series: [
      ...qualities.map((quality) => ({
        name: quality,
        type: 'bar' as const,
        stack: 'quality',
        barMaxWidth: 42,
        emphasis: { focus: 'series' as const },
        label: { show: showLabels, position: 'inside' as const, formatter: (params: { value?: unknown }) => (Number(params.value ?? 0) > 0 ? String(params.value) : '') },
        data: categories.map((category) => matrix[category]?.[quality] ?? 0),
        cursor: onClickHint ? 'pointer' : 'default',
      })),
      {
        name: '汇总',
        type: 'line' as const,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2, type: 'dashed' },
        itemStyle: { color: '#0f172a' },
        label: { show: true, position: 'top' as const, formatter: (params: { value?: unknown }) => (Number(params.value ?? 0) > 0 ? String(params.value) : '') },
        tooltip: { valueFormatter: (value: unknown) => `${value} 款` },
        data: totals,
        z: 10,
      },
    ],
  };
}

export function AnalyticsPage({ skins }: AnalyticsPageProps) {
  const [qualityFilter, setQualityFilter] = useState('全部');
  const [obtainFilter, setObtainFilter] = useState<ObtainGroup>('全部');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [compareYears, setCompareYears] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [qualityLegendSelection, setQualityLegendSelection] = useState<Record<string, boolean>>({});

  const qualities = useMemo(() => uniqueOptions(skins.map((skin) => skin.quality)), [skins]);
  const years = useMemo(() => uniqueOptions(skins.map((skin) => skin.releaseYear)).sort((a, b) => Number(a) - Number(b)), [skins]);

  const filteredSkins = useMemo(() => {
    return skins.filter((skin) => {
      if (!skin.releaseYear || !skin.releaseMonth) return false;
      if (qualityFilter !== '全部' && skin.quality !== qualityFilter) return false;
      if (obtainFilter !== '全部' && getObtainGroup(skin.obtainMethod) !== obtainFilter) return false;
      return true;
    });
  }, [obtainFilter, qualityFilter, skins]);

  const activeQualities = useMemo(() => uniqueOptions(filteredSkins.map((skin) => skin.quality)), [filteredSkins]);
  const visibleQualities = useMemo(() => activeQualities.filter((quality) => qualityLegendSelection[quality] !== false), [activeQualities, qualityLegendSelection]);
  const visibleSkins = useMemo(() => filteredSkins.filter((skin) => visibleQualities.includes(skin.quality)), [filteredSkins, visibleQualities]);
  const heroes = useMemo(() => new Set(filteredSkins.map((skin) => skin.heroName)).size, [filteredSkins]);

  const qualityPieOption = useMemo<EChartsOption>(() => {
    const qualityCounts = Object.entries(countBy(filteredSkins.map((skin) => skin.quality))).sort((a, b) => b[1] - a[1]);
    return {
      color: qualityColors,
      title: { text: visibleSkins.length.toLocaleString(), subtext: '当前显示汇总', left: '37%', top: '43%', textAlign: 'center', textStyle: { fontSize: 28, fontWeight: 800 }, subtextStyle: { color: '#64748b' } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} 款 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'middle', type: 'scroll', selected: qualityLegendSelection, selectedMode: true },
      toolbox,
      series: [{
        name: '品质分布',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        label: { show: showLabels, formatter: '{b}\n{c}款' },
        labelLine: { show: showLabels },
        data: qualityCounts.map(([name, value]) => ({ name, value })),
      }],
    };
  }, [filteredSkins, qualityLegendSelection, showLabels, visibleSkins.length]);

  const yearStack = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    for (const skin of filteredSkins) {
      const year = String(skin.releaseYear);
      matrix[year] ??= {};
      matrix[year][skin.quality] = (matrix[year][skin.quality] ?? 0) + 1;
    }
    return buildStackedOption(years, activeQualities, matrix, showLabels, visibleQualities, qualityLegendSelection, true);
  }, [activeQualities, filteredSkins, qualityLegendSelection, showLabels, visibleQualities, years]);

  const monthStack = useMemo(() => {
    const year = selectedYear ?? years[years.length - 1] ?? '';
    const matrix: Record<string, Record<string, number>> = {};
    for (const month of months) matrix[month] = {};
    for (const skin of filteredSkins) {
      if (String(skin.releaseYear) !== year) continue;
      const month = skin.releaseMonth?.slice(5, 7);
      if (!month) continue;
      matrix[month][skin.quality] = (matrix[month][skin.quality] ?? 0) + 1;
    }
    return { year, option: buildStackedOption(months.map((month) => `${Number(month)}月`), activeQualities, Object.fromEntries(months.map((month) => [`${Number(month)}月`, matrix[month]])), showLabels, visibleQualities, qualityLegendSelection) };
  }, [activeQualities, filteredSkins, qualityLegendSelection, selectedYear, showLabels, visibleQualities, years]);

  const lineCompareOption = useMemo<EChartsOption>(() => {
    const selected = compareYears.length > 0 ? compareYears : years.slice(-4);
    const series = selected.map((year) => {
      const data = months.map((month) => filteredSkins.filter((skin) => String(skin.releaseYear) === year && skin.releaseMonth?.slice(5, 7) === month).length);
      return {
        name: `${year}（合计 ${sum(data)}）`,
        type: 'line' as const,
        smooth: true,
        symbolSize: 7,
        label: { show: showLabels, formatter: (params: { value?: unknown }) => (Number(params.value ?? 0) > 0 ? String(params.value) : '') },
        data,
      };
    });
    return {
      color: qualityColors,
      tooltip: { trigger: 'axis', valueFormatter: (value) => `${value} 款` },
      legend: { top: 0, type: 'scroll' },
      toolbox,
      grid: { left: 42, right: 28, top: 64, bottom: 42 },
      xAxis: { type: 'category', data: months.map((month) => `${Number(month)}月`) },
      yAxis: { type: 'value', minInterval: 1, name: '皮肤数' },
      series,
    };
  }, [compareYears, filteredSkins, showLabels, years]);

  function toggleCompareYear(year: string) {
    setCompareYears((current) => {
      if (current.includes(year)) return current.filter((item) => item !== year);
      return [...current, year].slice(-4);
    });
  }

  function handleLegendSelection(params: { selected?: Record<string, boolean> }) {
    if (!params.selected) return;
    const nextSelection = Object.fromEntries(activeQualities.map((quality) => [quality, params.selected?.[quality] !== false]));
    setQualityLegendSelection(nextSelection);
  }

  return (
    <div className="space-y-5">
      <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-slate-100/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">📊 数据统计概览</h2>
            <p className="mt-1 text-sm text-slate-500">统计图支持按皮肤品质和获取方式聚合过滤。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" onChange={(event) => { setQualityFilter(event.target.value); setQualityLegendSelection({}); }} value={qualityFilter}>
              <option value="全部">全部品质</option>
              {qualities.map((quality) => <option key={quality}>{quality}</option>)}
            </select>
            <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" onChange={(event) => { setObtainFilter(event.target.value as ObtainGroup); setQualityLegendSelection({}); }} value={obtainFilter}>
              {(['全部', '免费', '赛季', '战令', '付费'] as ObtainGroup[]).map((group) => <option key={group}>{group}</option>)}
            </select>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <input checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} type="checkbox" />
              显示标签值
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="当前显示记录" note="按筛选条件和数据标签计算" value={visibleSkins.length} />
          <StatCard label="英雄数量" note="筛选后覆盖英雄" value={heroes} />
          <StatCard label="皮肤款数" note="当前显示的唯一皮肤（英雄+名称）" value={new Set(visibleSkins.map(uniqueSkinKey)).size} />
          <StatCard label="品质类型" note="当前图例显示品质数" value={visibleQualities.length} />
        </div>
      </section>

      <ChartCard title="品质皮肤分布" subtitle="环形图中心展示当前筛选后的汇总皮肤数；点击图例可临时隐藏某个品质">
        <ReactECharts className="min-w-[720px]" notMerge onEvents={{ legendselectchanged: handleLegendSelection }} option={qualityPieOption} style={{ height: 380 }} />
      </ChartCard>

      <ChartCard title="图1：年度皮肤按品质堆叠图" subtitle="柱内可显示分品质标签值，虚线为年度汇总值；点击图例可隐藏品质，点击某个年度柱展开月度图">
        <ReactECharts
          onEvents={{ click: (params: { name?: string }) => params.name && setSelectedYear(String(params.name)), legendselectchanged: handleLegendSelection }}
          option={yearStack}
          notMerge
          className="min-w-[820px]"
          style={{ height: 460 }}
        />
      </ChartCard>

      <ChartCard title={`图2：${monthStack.year || '年度'} 月度按品质堆叠图`} subtitle="柱内可显示分品质标签值，虚线为月度汇总值；点击图例可隐藏品质">
        <ReactECharts className="min-w-[820px]" notMerge onEvents={{ legendselectchanged: handleLegendSelection }} option={monthStack.option} style={{ height: 420 }} />
      </ChartCard>

      <ChartCard title="图3：月份皮肤总数曲线" subtitle="图例展示每个年份合计；支持选择多个年份对比，最多保留最近选择的 4 个年份">
        <div className="mb-3 flex flex-wrap gap-2">
          {years.map((year) => {
            const active = compareYears.includes(year) || (compareYears.length === 0 && years.slice(-4).includes(year));
            return (
              <button
                className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                key={year}
                onClick={() => toggleCompareYear(year)}
                type="button"
              >
                {year}
              </button>
            );
          })}
        </div>
        <ReactECharts className="min-w-[820px]" notMerge option={lineCompareOption} style={{ height: 430 }} />
      </ChartCard>
    </div>
  );
}
