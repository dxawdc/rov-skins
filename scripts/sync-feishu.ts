import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanDataset } from './clean-skins';
import { downloadImages } from './download-images';

type TenantTokenResponse = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

type SheetValuesResponse = {
  code: number;
  msg: string;
  data?: {
    revision?: number;
    valueRange?: {
      range?: string;
      values?: unknown[][];
    };
  };
};

type RowObject = Record<string, unknown> & { __rowNumber?: number };

const config = {
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  spreadsheetToken: process.env.FEISHU_SPREADSHEET_TOKEN ?? 'VSFrsnjtyhMJq0tYsW9c5tVPnMg',
  skinSheetId: process.env.FEISHU_SKIN_SHEET_ID ?? '0LLtTx',
  heroSheetId: process.env.FEISHU_HERO_SHEET_ID ?? '1FVXHq',
  heroDetailSheetId: process.env.FEISHU_HERO_DETAIL_SHEET_ID ?? '2OUOPQ',
  roleTranslationSheetId: process.env.FEISHU_ROLE_TRANSLATION_SHEET_ID ?? '3nioka',
  qualitySheetId: process.env.FEISHU_QUALITY_SHEET_ID ?? 'XIg8ge',
  obtainSheetId: process.env.FEISHU_OBTAIN_SHEET_ID ?? 'ZBF8aL',
};

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = (await response.json()) as T;
  if (!response.ok) throw new Error(`请求失败 ${response.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

async function getTenantToken() {
  if (!config.appId || !config.appSecret) {
    throw new Error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET。请复制 .env.example 并配置 GitHub Secrets。');
  }

  const json = await requestJson<TenantTokenResponse>('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
  });
  if (json.code !== 0 || !json.tenant_access_token) throw new Error(`获取 tenant token 失败：${json.msg}`);
  return json.tenant_access_token;
}

async function readSheet(token: string, sheetId: string, range: string): Promise<{ rows: RowObject[]; revision?: number; rawRows: number }> {
  const encodedRange = encodeURIComponent(`${sheetId}!${range}`);
  const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values/${encodedRange}`;
  const json = await requestJson<SheetValuesResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  if (json.code !== 0) throw new Error(`读取 sheet ${sheetId} 失败：${json.msg}`);

  const values = json.data?.valueRange?.values ?? [];
  const [headers = [], ...dataRows] = values;
  const normalizedHeaders = headers.map((header) => String(header ?? '').trim());
  const dedupedHeaders = normalizedHeaders.map((header, index) => {
    if (!header) return `__empty_${index}`;
    const count = normalizedHeaders.slice(0, index).filter((item) => item === header).length;
    return count > 0 ? `${header}.${count}` : header;
  });

  const rows = dataRows.map<RowObject>((valuesRow, rowIndex) => {
    const row: RowObject = { __rowNumber: rowIndex + 2 };
    dedupedHeaders.forEach((header, index) => {
      row[header] = valuesRow[index] ?? '';
    });
    return row;
  });

  return { rows, revision: json.data?.revision, rawRows: dataRows.length };
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const skipImages = process.argv.includes('--skip-images');
  const token = await getTenantToken();
  const [skinSheet, heroSheet, qualitySheet, heroDetailSheet, roleTranslationSheet] = await Promise.all([
    readSheet(token, config.skinSheetId, 'A1:X1113'),
    readSheet(token, config.heroSheetId, 'A1:G129'),
    readSheet(token, config.qualitySheetId, 'A1:P20'),
    readSheet(token, config.heroDetailSheetId, 'B1:F200'),
    readSheet(token, config.roleTranslationSheetId, 'A1:C20'),
  ]);

  const result = cleanDataset({
    skinRows: skinSheet.rows,
    heroRows: heroSheet.rows,
    qualityRows: qualitySheet.rows,
    heroDetailRows: heroDetailSheet.rows,
    roleTranslationRows: roleTranslationSheet.rows,
  });
  if (!skipImages) {
    const imageWarnings = await downloadImages(result.skins, { token, force: process.argv.includes('--force-images') });
    result.warnings.push(...imageWarnings);
  }

  await writeJson(path.resolve('public/data/skins.json'), result.skins);
  await writeJson(path.resolve('public/data/heroes.json'), result.heroes);
  await writeJson(path.resolve('public/data/quality-map.json'), result.qualityMap);
  await writeJson(path.resolve('public/data/sync-meta.json'), {
    syncedAt: new Date().toISOString(),
    spreadsheetToken: config.spreadsheetToken,
    revision: skinSheet.revision,
    rawRows: skinSheet.rawRows,
    validRows: result.skins.length,
    warnings: result.warnings,
  });

  console.log(`同步完成：${result.skins.length}/${skinSheet.rawRows} 条有效皮肤记录，warnings=${result.warnings.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
