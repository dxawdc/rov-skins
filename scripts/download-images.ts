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

/**
 * 上次同步时每个皮肤实际下载的图片 token。飞书替换图片后 token 会变，
 * 但本地文件名（基于皮肤 id）不变，只靠"文件已存在"判断会永远跳过下载。
 */
async function loadPreviousTokens(dataPath: string) {
  const posters = new Map<string, string>();
  try {
    const skins = JSON.parse(await readFile(dataPath, 'utf8')) as Skin[];
    for (const skin of skins) posters.set(skin.id, skin.poster?.token ?? '');
  } catch {
    // 首次同步或文件缺失时没有历史记录，全部按新图处理
  }
  return posters;
}

/** 让图片 URL 随 token 变化，避免浏览器/CDN 继续用同名旧图。 */
function withVersion(urlPath: string, token?: string) {
  return token ? `${urlPath}?v=${token.slice(0, 10)}` : urlPath;
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

async function downloadFeishuImage(token: string, absoluteTarget: string, options: { token?: string; width: number; quality: number }) {
  const response = await fetch(`https://open.feishu.cn/open-apis/drive/v1/medias/${token}/download`, options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const sharp = (await import('sharp')).default;
  const buffer = await sharp(Buffer.from(arrayBuffer)).resize({ width: options.width, withoutEnlargement: true }).webp({ quality: options.quality }).toBuffer();
  await writeFile(absoluteTarget, buffer);
}

export async function downloadImages(skins: Skin[], options: { token?: string; outputDir?: string; qualityTagOutputDir?: string; previousDataPath?: string; force?: boolean } = {}) {
  const outputDir = options.outputDir ?? path.resolve('public/images/skins');
  const qualityTagOutputDir = options.qualityTagOutputDir ?? path.resolve('public/images/quality-tags');
  await mkdir(outputDir, { recursive: true });
  await mkdir(qualityTagOutputDir, { recursive: true });
  const previousPosterTokens = await loadPreviousTokens(options.previousDataPath ?? path.resolve('public/data/skins.json'));

  const warnings: string[] = [];
  let refreshed = 0;
  for (const skin of skins) {
    const target = `/images/skins/${skin.id}.webp`;
    const absoluteTarget = path.join(outputDir, `${skin.id}.webp`);
    const download = resolveDownloadUrl(skin);
    const tokenChanged = previousPosterTokens.has(skin.id) && previousPosterTokens.get(skin.id) !== (skin.poster.token ?? '');
    const needsDownload = options.force || tokenChanged || !(await exists(absoluteTarget));

    if (!download) {
      // 飞书已清空该皮肤海报：不要因为旧文件还在就当作同步成功
      skin.poster.status = skin.poster.token || skin.poster.source ? 'failed' : 'missing';
    } else if (!needsDownload) {
      skin.poster.local = withVersion(target, skin.poster.token);
      skin.poster.thumbnail = skin.poster.local;
      skin.poster.status = 'ok';
    } else {
      try {
        const response = await fetch(download.url, download.needsAuth && options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const sharp = (await import('sharp')).default;
        const buffer = await sharp(Buffer.from(arrayBuffer)).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        await writeFile(absoluteTarget, buffer);
        if (tokenChanged) refreshed += 1;
        skin.poster.local = withVersion(target, skin.poster.token);
        skin.poster.thumbnail = skin.poster.local;
        skin.poster.status = 'ok';
      } catch (error) {
        skin.poster.status = 'failed';
        warnings.push(`${skin.id} 海报下载失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (skin.qualityTagImage.token) {
      const tagTarget = `/images/quality-tags/${skin.qualityTagImage.token}.webp`;
      const absoluteTagTarget = path.join(qualityTagOutputDir, `${skin.qualityTagImage.token}.webp`);
      if (!options.force && (await exists(absoluteTagTarget))) {
        skin.qualityTagImage.local = tagTarget;
        skin.qualityTagImage.status = 'ok';
      } else {
        try {
          await downloadFeishuImage(skin.qualityTagImage.token, absoluteTagTarget, { token: options.token, width: 160, quality: 90 });
          skin.qualityTagImage.local = tagTarget;
          skin.qualityTagImage.status = 'ok';
        } catch (error) {
          skin.qualityTagImage.status = 'failed';
          warnings.push(`${skin.id} 品质标签图片下载失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  if (refreshed > 0) console.log(`检测到 ${refreshed} 张海报在飞书被替换，已重新下载覆盖。`);
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
  const force = process.argv.includes('--force');
  const warnings = await downloadImages(skins, { token, force });
  await writeFile(dataPath, `${JSON.stringify(skins, null, 2)}\n`, 'utf8');
  const ok = skins.filter((skin) => skin.poster.status === 'ok').length;
  const qualityOk = skins.filter((skin) => skin.qualityTagImage.status === 'ok').length;
  console.log(`补图完成：${ok}/${skins.length} 张海报可用，${qualityOk}/${skins.length} 张品质标签图可用，warnings=${warnings.length}`);
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
