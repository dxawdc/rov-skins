import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Skin } from '../src/types/skin';

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveDownloadUrl(skin: Skin): { url: string; needsAuth: boolean } | null {
  if (skin.poster.token) {
    return { url: `https://open.feishu.cn/open-apis/drive/v1/medias/${skin.poster.token}/download`, needsAuth: true };
  }
  if (skin.poster.source && /^https?:\/\//i.test(skin.poster.source)) {
    return { url: skin.poster.source, needsAuth: false };
  }
  return null;
}

export async function downloadImages(skins: Skin[], options: { token?: string; outputDir?: string } = {}) {
  const outputDir = options.outputDir ?? path.resolve('public/images/skins');
  await mkdir(outputDir, { recursive: true });

  const warnings: string[] = [];
  for (const skin of skins) {
    const target = `/images/skins/${skin.id}.webp`;
    const absoluteTarget = path.join(outputDir, `${skin.id}.webp`);
    if (await exists(absoluteTarget)) {
      skin.poster.local = target;
      skin.poster.thumbnail = target;
      skin.poster.status = 'ok';
      continue;
    }

    const download = resolveDownloadUrl(skin);
    if (!download) {
      skin.poster.status = skin.poster.token || skin.poster.source ? 'failed' : 'missing';
      continue;
    }

    try {
      const response = await fetch(download.url, download.needsAuth && options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const sharp = (await import('sharp')).default;
      const buffer = await sharp(Buffer.from(arrayBuffer)).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      await writeFile(absoluteTarget, buffer);
      skin.poster.local = target;
      skin.poster.thumbnail = target;
      skin.poster.status = 'ok';
    } catch (error) {
      skin.poster.status = 'failed';
      warnings.push(`${skin.id} 海报下载失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return warnings;
}

async function getTenantToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量。');

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const json = (await response.json()) as { code: number; msg: string; tenant_access_token?: string };
  if (json.code !== 0 || !json.tenant_access_token) throw new Error(`获取 tenant token 失败：${json.msg}`);
  return json.tenant_access_token;
}

async function main() {
  const dataPath = path.resolve('public/data/skins.json');
  const skins = JSON.parse(await readFile(dataPath, 'utf8')) as Skin[];
  const token = await getTenantToken();
  const warnings = await downloadImages(skins, { token });
  await writeFile(dataPath, `${JSON.stringify(skins, null, 2)}\n`, 'utf8');
  const ok = skins.filter((skin) => skin.poster.status === 'ok').length;
  console.log(`补图完成：${ok}/${skins.length} 张海报可用，warnings=${warnings.length}`);
  if (warnings.length) console.log(warnings.slice(0, 20).join('\n'));
}

const isDirectRun = (() => {
  try {
    return path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
