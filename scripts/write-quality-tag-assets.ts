import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

type QualityTagAsset = {
  quality: string;
  tag: string;
  token: string;
  local: string;
};

const assets: QualityTagAsset[] = [
  { quality: 'A', tag: 'EVO', token: 'YLYQbIRpao0eH5xw7sfcjXb9ntd', local: '/images/quality-tags/evo.webp' },
  { quality: 'S', tag: 'Heroic', token: 'Nxp9bRthHo394nxYE7wcPOo5nod', local: '/images/quality-tags/heroic.webp' },
  { quality: 'S+', tag: 'Epic', token: 'AHxFb4tTOoKQ30x5DqEcbQ5onLb', local: '/images/quality-tags/epic.webp' },
  { quality: 'SS', tag: 'Limited', token: 'GmmUbtwgMoKrUTx214VckPsSnKc', local: '/images/quality-tags/limited.webp' },
  { quality: 'SS+', tag: 'Legend', token: 'CkQ7bVSr2oE860xFabLcQULxnzb', local: '/images/quality-tags/legend.webp' },
  { quality: 'SSS', tag: 'Prestige', token: 'HxpqbAPFvoyaNKxn24jceLJWnUe', local: '/images/quality-tags/prestige.webp' },
  { quality: 'SSS+', tag: 'Ultimate', token: 'WAZqbPBiuoLGqZx06GycFqHanOe', local: '/images/quality-tags/ultimate.webp' },
];

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
  const tmpDir = '.tmpfiles/quality-tags';
  const outputDir = path.resolve('public/images/quality-tags');
  await mkdir(tmpDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const warnings: string[] = [];
  for (const asset of assets) {
    const tmpFile = `${tmpDir}/${asset.tag}.bin`;
    const webpFile = path.resolve(`public${asset.local}`);
    try {
      await runLarkDownload(asset.token, tmpFile);
      await sharp(path.resolve(tmpFile)).resize({ width: 160, withoutEnlargement: true }).webp({ quality: 90 }).toFile(webpFile);
    } catch (error) {
      warnings.push(`${asset.tag}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeFile('public/data/quality-tags.json', `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
  console.log(`品质标签图片完成：${assets.length - warnings.length}/${assets.length}`);
  if (warnings.length) console.log(warnings.join('\n'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
