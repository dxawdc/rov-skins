export type PosterStatus = 'ok' | 'missing' | 'failed';

export type Poster = {
  source?: string;
  local?: string;
  thumbnail?: string;
  token?: string;
  status: PosterStatus;
};

export type Skin = {
  id: string;
  rowNumber: number;
  heroName: string;
  heroRoles: string[];
  skinName: string;
  poster: Poster;
  qualityTag: string;
  quality: string;
  releaseDate: string | null;
  releaseYear: number | null;
  releaseMonth: string | null;
  obtainMethod: string;
  obtainMethodText?: string;
  localizationElement?: string;
  localizationElementText?: string;
  localizationInterpretation?: string;
  isHonorOfKingsPort?: boolean | null;
  hokOriginalSaleMethod?: string;
  hasIpCollab?: boolean | null;
  ipName?: string;
  note?: string;
  searchText: string;
  raw: Record<string, unknown>;
};

export type Hero = {
  heroName: string;
  wikiPath?: string;
  url?: string;
  rovEnglishName?: string;
  rovChineseName?: string;
  hokHero?: string;
  portingNote?: string;
};

export type SyncMeta = {
  syncedAt: string;
  spreadsheetToken: string;
  revision?: number;
  rawRows: number;
  validRows: number;
  warnings: string[];
};

export type QualityTagAsset = {
  quality: string;
  tag: string;
  token: string;
  local: string;
};

export type SkinDataset = {
  skins: Skin[];
  heroes: Hero[];
  qualityTags: QualityTagAsset[];
  meta: SyncMeta | null;
};
