import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import type { Skin } from '../src/types/skin';

function runLarkDownload(token: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cli = process.env.LARK_CLI_PATH || 'lark-cli';
    const child = spawn(cli, ['api', 'GET', `/open-apis/drive/v1/medias/${token}/download`, '--as', 'user', '--output', output], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `lark-cli exited ${code}`));
    });
  });
}

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
  const skins = JSON.parse(await readFile('public/data/skins.json', 'utf8')) as Skin[];
  const tmpRelativeDir = '.tmpfiles/feishu-posters';
  const tmpDir = path.resolve(tmpRelativeDir);
  const outputDir = path.resolve('public/images/skins');
  await mkdir(tmpDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  let attempted = 0;
  let downloaded = 0;
  const warnings: string[] = [];
  for (const skin of skins) {
    if (attempted >= limit) break;
    if (!skin.poster.token || skin.poster.local) continue;
    attempted += 1;

    const tmpRelativeFile = `${tmpRelativeDir}/${skin.id}.bin`;
    const tmpFile = path.resolve(tmpRelativeFile);
    const webpFile = path.join(outputDir, `${skin.id}.webp`);
    try {
      await runLarkDownload(skin.poster.token, tmpRelativeFile);
      await sharp(tmpFile).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 82 }).toFile(webpFile);
      skin.poster.local = `/images/skins/${skin.id}.webp`;
      skin.poster.thumbnail = skin.poster.local;
      skin.poster.status = 'ok';
      downloaded += 1;
      if (downloaded % 25 === 0) console.log(`已下载 ${downloaded} 张`);
    } catch (error) {
      skin.poster.status = 'failed';
      warnings.push(`${skin.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeFile('public/data/skins.json', `${JSON.stringify(skins, null, 2)}\n`, 'utf8');
  console.log(`图片下载完成：${downloaded} 张，失败 ${warnings.length} 张`);
  if (warnings.length) console.log(warnings.slice(0, 20).join('\n'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
