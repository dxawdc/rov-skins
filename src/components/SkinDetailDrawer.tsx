import { X } from 'lucide-react';
import type { QualityTagAsset, Skin } from '../types/skin';
import { formatDisplayDate } from '../utils/date';

type SkinDetailDrawerProps = {
  skin: Skin | null;
  qualityTags: QualityTagAsset[];
  onClose: () => void;
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-slate-900">{value || '—'}</div>
    </div>
  );
}

export function SkinDetailDrawer({ skin, qualityTags, onClose }: SkinDetailDrawerProps) {
  if (!skin) return null;
  const qualityTagImage = skin.qualityTagImage?.local ?? qualityTags.find((asset) => asset.tag === skin.qualityTag)?.local;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} role="presentation">
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="mb-5 rounded-full border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" onClick={onClose} type="button">
          <X size={20} />
        </button>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {skin.poster.local ? (
            <img alt={`${skin.heroName} ${skin.skinName}`} className="h-80 w-full object-cover" src={skin.poster.local} />
          ) : (
            <div className="flex h-80 flex-col justify-between bg-gradient-to-br from-slate-100 to-slate-200 p-8">
              <div className="text-6xl font-black uppercase text-slate-300/70">{skin.heroName}</div>
              <div>
                <div className="text-sm font-semibold text-slate-500">{skin.poster.token ? '已读取飞书图片 token，待下载本地海报' : 'Poster Missing'}</div>
                <div className="text-4xl font-black text-slate-950">{skin.skinName}</div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{skin.heroName}</p>
            <h2 className="mt-2 text-4xl font-black text-slate-950">{skin.skinName}</h2>
          </div>
          <span className="rounded-full bg-blue-50 px-5 py-2 font-bold text-blue-700">{skin.quality || '未知'}</span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Field label="英雄职业" value={skin.heroRoles.join(' / ')} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">品质标签</div>
            <div className="mt-2">
              {qualityTagImage ? <img alt={skin.qualityTag} className="h-10 max-w-[140px] object-contain" src={qualityTagImage} title={skin.qualityTag} /> : <span className="text-sm text-slate-900">{skin.qualityTag || '—'}</span>}
            </div>
          </div>
          <Field label="首次上线日期" value={formatDisplayDate(skin.releaseDate)} />
          <Field label="获取方式" value={skin.obtainMethod} />
          <Field label="本地化元素" value={skin.localizationElement || skin.localizationElementText} />
          <Field label="本地化元素解读" value={skin.localizationInterpretation} />
          <Field label="小王移植" value={skin.isHonorOfKingsPort === null || skin.isHonorOfKingsPort === undefined ? null : skin.isHonorOfKingsPort ? '是' : '否'} />
          <Field label="小王初始售卖方式" value={skin.hokOriginalSaleMethod} />
          <Field label="IP / 名人联动" value={skin.ipName || (skin.hasIpCollab ? '是' : '')} />
          <Field label="飞书原始行号" value={skin.rowNumber} />
        </div>
      </aside>
    </div>
  );
}
