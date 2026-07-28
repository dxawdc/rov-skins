import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { Hero, Skin } from '../src/types/skin';

dayjs.extend(customParseFormat);

type RowObject = Record<string, unknown> & { __rowNumber?: number };

export type CleanResult = {
  skins: Skin[];
  heroes: Hero[];
  qualityMap: Array<Record<string, unknown>>;
  warnings: string[];
};

const criticalHeaders = ['hero_name', '皮肤名称'];

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().replace(/​/g, '');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return text(record.text ?? record.value ?? record.name ?? record.link ?? record.url ?? '');
  }
  return '';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'skin';
}

function parseRoles(value: string): string[] {
  return value
    .split(/[\/、,，]+/)
    .map((role) => role.trim().replace(/​/g, ''))
    .filter(Boolean);
}

function isUnresolvedFormula(value: string): boolean {
  return /^=?\s*[A-Z]+\(/i.test(value.trim());
}

function buildHeroRoleMap(heroDetailRows: RowObject[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of heroDetailRows) {
    const heroName = text(row['英雄名称']);
    if (!heroName) continue;
    map.set(heroName, parseRoles(text(row['主职业'])));
  }
  return map;
}

function parseBoolean(value: string): boolean | null {
  if (!value) return null;
  if (/^(是|yes|true|1|y)$/i.test(value)) return true;
  if (/^(否|no|false|0|n|-)$|无/i.test(value)) return false;
  return null;
}

function parseDate(value: unknown): { date: string | null; year: number | null; month: string | null } {
  if (typeof value === 'number' && value > 20000) {
    const base = dayjs('1899-12-30').add(value, 'day');
    const date = base.format('YYYY-MM-DD');
    return { date, year: base.year(), month: base.format('YYYY-MM') };
  }

  const raw = text(value);
  if (!raw) return { date: null, year: null, month: null };
  const normalized = raw.replace(/[年月.]/g, '/').replace('日', '').trim();
  const formats = ['YYYY/M/D', 'YYYY/MM/DD', 'YYYY-M-D', 'YYYY-MM-DD', 'D MMM YYYY', 'DD MMM YYYY'];
  const parsed = formats.map((format) => dayjs(normalized, format, true)).find((item) => item.isValid()) ?? dayjs(raw);
  if (!parsed.isValid()) return { date: null, year: null, month: null };
  const date = parsed.format('YYYY-MM-DD');
  return { date, year: parsed.year(), month: parsed.format('YYYY-MM') };
}

function normalizeQuality(value: string): string {
  return value || '未知';
}

const qualityToTag: Record<string, string> = {
  A: 'EVO',
  S: 'Heroic',
  'S+': 'Epic',
  SS: 'Limited',
  'SS+': 'Legend',
  SSS: 'Prestige',
  'SSS+': 'Ultimate',
};

function resolveQualityTag(quality: string, rawTag: string): string {
  return rawTag || qualityToTag[quality] || '';
}

function extractImageToken(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractImageToken(item);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.fileToken === 'string' && record.fileToken) return record.fileToken;
  if (typeof record.file_token === 'string' && record.file_token) return record.file_token;
  if (typeof record.image_token === 'string' && record.image_token) return record.image_token;
  if (typeof record.image_id === 'string' && record.image_id) return record.image_id;
  for (const nested of Object.values(record)) {
    const found = extractImageToken(nested);
    if (found) return found;
  }
  return undefined;
}

function extractImageUrl(value: unknown): string | undefined {
  const raw = text(value);
  return /^https?:\/\//i.test(raw) ? raw : undefined;
}

function normalizeObtainMethod(value: string): string {
  return value || '未知';
}

function buildSearchText(parts: Array<string | string[] | undefined | null>): string {
  return parts.flatMap((part) => (Array.isArray(part) ? part : [part])).filter(Boolean).join(' ');
}

function assertHeaders(rows: RowObject[], warnings: string[]) {
  const first = rows[0] ?? {};
  for (const header of criticalHeaders) {
    if (!(header in first)) warnings.push(`关键字段缺失：${header}`);
  }
}

export function cleanDataset(input: { skinRows: RowObject[]; heroRows: RowObject[]; qualityRows: RowObject[]; heroDetailRows?: RowObject[] }): CleanResult {
  const warnings: string[] = [];
  assertHeaders(input.skinRows, warnings);
  const usedIds = new Set<string>();
  const heroRoleMap = buildHeroRoleMap(input.heroDetailRows ?? []);

  const skins = input.skinRows.flatMap<Skin>((row) => {
    const heroName = text(row.hero_name);
    const skinName = text(row['皮肤名称']);
    const rowNumber = Number(row.__rowNumber ?? 0);
    if (!heroName || !skinName) return [];

    const release = parseDate(row['首次上线日期']);
    if (!release.date && text(row['首次上线日期'])) warnings.push(`第 ${rowNumber} 行日期无法解析：${text(row['首次上线日期'])}`);

    let id = slugify(`${heroName}-${skinName}`);
    if (usedIds.has(id)) id = `${id}-${rowNumber}`;
    usedIds.add(id);

    const rawRoleText = text(row['英雄职业']);
    let heroRoles: string[];
    if (isUnresolvedFormula(rawRoleText)) {
      const lookedUp = heroRoleMap.get(heroName);
      if (lookedUp) {
        heroRoles = lookedUp;
      } else {
        heroRoles = [];
        warnings.push(`第 ${rowNumber} 行英雄职业公式未能解析，且英雄详情表中找不到「${heroName}」`);
      }
    } else {
      heroRoles = parseRoles(rawRoleText);
    }
    const quality = normalizeQuality(text(row['品质']));
    const qualityTag = resolveQualityTag(quality, text(row['皮肤品质标签']));
    const obtainMethod = normalizeObtainMethod(text(row['获取方式']));
    const obtainMethodText = text(row['获取途径（转文本）']) || obtainMethod;
    const localizationElement = text(row['本地化元素']);
    const localizationElementText = text(row['本地化元素（转文本）']);
    const ipName = text(row['IP/名人名称']);

    const posterRaw = row['皮肤海报'];
    const posterToken = extractImageToken(posterRaw);
    const posterUrl = extractImageUrl(posterRaw);

    return [{
      id,
      rowNumber,
      heroName,
      heroRoles,
      skinName,
      poster: {
        token: posterToken,
        source: posterUrl,
        status: posterToken || posterUrl ? 'failed' : 'missing',
      },
      qualityTag,
      quality,
      releaseDate: release.date,
      releaseYear: release.year,
      releaseMonth: release.month,
      obtainMethod,
      obtainMethodText,
      localizationElement,
      localizationElementText,
      localizationInterpretation: text(row['本地化元素解读']),
      isHonorOfKingsPort: parseBoolean(text(row['小王移植'])),
      hokOriginalSaleMethod: text(row['小王一开始怎么卖的']),
      hasIpCollab: parseBoolean(text(row['IP/名人联动'])),
      ipName,
      note: [text(row['备注']), text(row['备注.1']), text(row['备注.2'])].filter(Boolean).join(' / '),
      searchText: buildSearchText([heroName, skinName, heroRoles, qualityTag, quality, obtainMethod, ipName]),
      raw: row,
    } satisfies Skin];
  });

  const heroes = input.heroRows.flatMap<Hero>((row) => {
    const heroName = text(row.hero_name);
    if (!heroName) return [];
    return [{
      heroName,
      wikiPath: text(row.wiki_path),
      url: text(row.URL),
      rovEnglishName: text(row['RoV英文名']),
      rovChineseName: text(row['RoV中文名（台服译名/常见叫法）']),
      hokHero: text(row['王者荣耀对应英雄']),
      portingNote: text(row['移植情况说明']),
    }];
  });

  return { skins, heroes, qualityMap: input.qualityRows, warnings };
}
