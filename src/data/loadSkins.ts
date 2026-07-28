import type { Hero, QualityTagAsset, Skin, SkinDataset, SyncMeta } from '../types/skin';

function withBase(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
}

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(withBase(path), { cache: 'no-store' });
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

  for (const skin of skins) {
    if (skin.poster.local) skin.poster.local = withBase(skin.poster.local);
    if (skin.poster.thumbnail) skin.poster.thumbnail = withBase(skin.poster.thumbnail);
  }
  for (const tag of qualityTags) {
    if (tag.local) tag.local = withBase(tag.local);
  }

  return { skins, heroes, qualityTags, meta };
}
