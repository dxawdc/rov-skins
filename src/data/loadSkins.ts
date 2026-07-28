import type { Hero, QualityTagAsset, Skin, SkinDataset, SyncMeta } from '../types/skin';

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function loadSkinDataset(): Promise<SkinDataset> {
  const [skins, heroes, qualityTags, meta] = await Promise.all([
    fetchJson<Skin[]>('/data/skins.json', []),
    fetchJson<Hero[]>('/data/heroes.json', []),
    fetchJson<QualityTagAsset[]>('/data/quality-tags.json', []),
    fetchJson<SyncMeta | null>('/data/sync-meta.json', null),
  ]);

  return { skins, heroes, qualityTags, meta };
}
