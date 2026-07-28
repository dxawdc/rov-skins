import type { Skin } from '../types/skin';

export type Filters = {
  query: string;
  role: string;
  quality: string;
  qualityTag: string;
  obtainMethod: string;
  year: string;
  sort: 'newest' | 'oldest' | 'hero' | 'quality';
};

export const defaultFilters: Filters = {
  query: '',
  role: 'all',
  quality: 'all',
  qualityTag: 'all',
  obtainMethod: 'all',
  year: 'all',
  sort: 'newest',
};

export function uniqueOptions(values: Array<string | number | null | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean).map(String))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

export function applyFilters(skins: Skin[], filters: Filters): Skin[] {
  const query = filters.query.trim().toLowerCase();

  return skins
    .filter((skin) => {
      if (query && !skin.searchText.toLowerCase().includes(query)) return false;
      if (filters.role !== 'all' && !skin.heroRoles.includes(filters.role)) return false;
      if (filters.quality !== 'all' && skin.quality !== filters.quality) return false;
      if (filters.qualityTag !== 'all' && skin.qualityTag !== filters.qualityTag) return false;
      if (filters.obtainMethod !== 'all' && skin.obtainMethod !== filters.obtainMethod) return false;
      if (filters.year !== 'all' && String(skin.releaseYear ?? '') !== filters.year) return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'oldest') return (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '');
      if (filters.sort === 'hero') return a.heroName.localeCompare(b.heroName);
      if (filters.sort === 'quality') return b.quality.localeCompare(a.quality);
      return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
    });
}
