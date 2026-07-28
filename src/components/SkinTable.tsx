import type { QualityTagAsset, Skin } from '../types/skin';
import { formatDisplayDate } from '../utils/date';

type SkinTableProps = {
  skins: Skin[];
  qualityTags: QualityTagAsset[];
  onSelectSkin: (skin: Skin) => void;
  emptyText?: string;
};

function isPermanentSkin(skin: Skin) {
  return /直售|商城|碎片/.test(skin.obtainMethod) && !/限时|抽奖|祈愿|夺宝|战令/.test(skin.obtainMethod);
}

function inferLaunchType(skin: Skin) {
  return skin.releaseDate ? '首发' : '未知';
}

export function SkinTable({ skins, qualityTags, onSelectSkin, emptyText = '暂无皮肤记录' }: SkinTableProps) {
  const tagImageByName = new Map(qualityTags.map((asset) => [asset.tag, asset.local]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1254px] table-fixed border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-20 px-3 py-3">海报</th>
            <th className="w-28 px-3 py-3">日期</th>
            <th className="w-[180px] px-3 py-3">皮肤名称</th>
            <th className="w-20 px-3 py-3">品质</th>
            <th className="w-28 px-3 py-3">皮肤标签</th>
            <th className="w-[120px] px-3 py-3">归属英雄</th>
            <th className="w-[110px] px-3 py-3">职业</th>
            <th className="w-[220px] px-3 py-3">获取方式</th>
            <th className="w-20 px-3 py-3">类型</th>
            <th className="w-20 px-3 py-3">常驻</th>
            <th className="w-20 px-3 py-3">详情</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {skins.map((skin) => (
            <tr className="hover:bg-blue-50/60" key={skin.id}>
              <td className="px-3 py-3">
                <button className="flex h-14 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-[10px] text-slate-500" onClick={() => onSelectSkin(skin)} type="button">
                  {skin.poster.local ? <img alt={skin.skinName} className="h-full w-full object-cover" src={skin.poster.local} /> : skin.poster.token ? '有图' : '无图'}
                </button>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDisplayDate(skin.releaseDate)}</td>
              <td className="break-words px-3 py-3 font-medium text-slate-900">{skin.skinName}</td>
              <td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{skin.quality}</span></td>
              <td className="px-3 py-3 text-slate-600">
                {tagImageByName.get(skin.qualityTag) ? (
                  <img alt={skin.qualityTag} className="h-7 max-w-[96px] object-contain" src={tagImageByName.get(skin.qualityTag)} title={skin.qualityTag} />
                ) : (
                  skin.qualityTag || '-'
                )}
              </td>
              <td className="px-3 py-3 text-slate-900">{skin.heroName}</td>
              <td className="px-3 py-3 text-slate-600">{skin.heroRoles.join('/') || '-'}</td>
              <td className="break-words px-3 py-3 text-slate-600">{skin.obtainMethod}</td>
              <td className="px-3 py-3 text-slate-600">{inferLaunchType(skin)}</td>
              <td className="px-3 py-3 text-slate-600">{isPermanentSkin(skin) ? '是' : '否'}</td>
              <td className="px-3 py-3"><button className="text-blue-600 hover:underline" onClick={() => onSelectSkin(skin)} type="button">查看</button></td>
            </tr>
          ))}
          {skins.length === 0 && (
            <tr>
              <td className="px-4 py-10 text-center text-slate-500" colSpan={11}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
