import { readFile, writeFile } from 'node:fs/promises';
import type { Skin } from '../src/types/skin';

type CellRange = {
  row_indices?: number[];
  cells?: Array<Array<{ rich_text?: Array<{ image_token?: string; type?: string }> }>>;
};

type ToolPayload = {
  stdout?: string;
};

function extractToolText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(extractToolText).join('\n');
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    return Object.values(record).map(extractToolText).join('\n');
  }
  return '';
}

async function readRanges(filePath: string): Promise<CellRange[]> {
  const persisted = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  const toolText = extractToolText(persisted);
  const toolJsonMatch = toolText.match(/\{[\s\S]*\}/);
  if (!toolJsonMatch) throw new Error(`工具结果中没有找到 JSON：${filePath}`);
  const toolJson = JSON.parse(toolJsonMatch[0]) as ToolPayload;
  const stdout = JSON.parse(toolJson.stdout ?? '{}') as { data?: { ranges?: CellRange[] } };
  return stdout.data?.ranges ?? [];
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error('请传入 cells-get 工具结果 JSON 文件路径');

  const rowToToken = new Map<number, string>();
  for (const file of files) {
    const ranges = await readRanges(file);
    for (const range of ranges) {
      range.cells?.forEach((rowCells, rowIndex) => {
        const rowNumber = range.row_indices?.[rowIndex];
        const token = rowCells[0]?.rich_text?.find((item) => item.type === 'embed-image' && item.image_token)?.image_token;
        if (rowNumber && token) rowToToken.set(rowNumber, token);
      });
    }
  }

  const skins = JSON.parse(await readFile('public/data/skins.json', 'utf8')) as Skin[];
  let merged = 0;
  for (const skin of skins) {
    const token = rowToToken.get(skin.rowNumber);
    if (!token) continue;
    skin.poster = {
      ...skin.poster,
      token,
      source: `feishu-image:${token}`,
      status: skin.poster.local ? 'ok' : 'failed',
    };
    merged += 1;
  }

  await writeFile('public/data/skins.json', `${JSON.stringify(skins, null, 2)}\n`, 'utf8');
  console.log(`已合并 ${merged}/${skins.length} 个皮肤海报 image_token`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
