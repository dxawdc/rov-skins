import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cleanDataset } from './clean-skins';

type RowObject = Record<string, unknown> & { __rowNumber?: number };

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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function parseAnnotatedCsv(csv: string): RowObject[] {
  const lines = csv.split(/\n(?=\[row=\d+\] )/).filter(Boolean);
  const headerLine = lines.shift();
  if (!headerLine) return [];
  const headerMatch = headerLine.match(/^\[row=(\d+)\] (.*)$/s);
  if (!headerMatch) return [];
  const headers = parseCsvLine(headerMatch[2]).map((header) => header.trim());
  const dedupedHeaders = headers.map((header, index) => {
    if (!header) return `__empty_${index}`;
    const count = headers.slice(0, index).filter((item) => item === header).length;
    return count > 0 ? `${header}.${count}` : header;
  });

  return lines.flatMap<RowObject>((line) => {
    const match = line.match(/^\[row=(\d+)\] (.*)$/s);
    if (!match) return [];
    const values = parseCsvLine(match[2]);
    const row: RowObject = { __rowNumber: Number(match[1]) };
    dedupedHeaders.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return [row];
  });
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('请传入 lark 工具结果 JSON 文件路径');

  const persisted = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown;
  const toolText = extractToolText(persisted);
  const toolJsonMatch = toolText.match(/\{[\s\S]*\}/);
  if (!toolJsonMatch) throw new Error('工具结果中没有找到 JSON');
  const toolJson = JSON.parse(toolJsonMatch[0]) as { stdout?: string };
  const stdout = JSON.parse(toolJson.stdout ?? '{}') as { data?: { annotated_csv?: string; revision?: number; row_count?: number } };
  const annotatedCsv = stdout.data?.annotated_csv;
  if (!annotatedCsv) throw new Error('工具结果中没有 annotated_csv');

  const skinRows = parseAnnotatedCsv(annotatedCsv);
  const result = cleanDataset({ skinRows, heroRows: [], qualityRows: [] });
  const heroes = Array.from(new Set(result.skins.map((skin) => skin.heroName))).sort().map((heroName) => ({ heroName }));

  await writeJson(path.resolve('public/data/skins.json'), result.skins);
  await writeJson(path.resolve('public/data/heroes.json'), heroes);
  await writeJson(path.resolve('public/data/quality-map.json'), []);
  await writeJson(path.resolve('public/data/sync-meta.json'), {
    syncedAt: new Date().toISOString(),
    spreadsheetToken: 'VSFrsnjtyhMJq0tYsW9c5tVPnMg',
    revision: stdout.data?.revision,
    rawRows: skinRows.length,
    validRows: result.skins.length,
    warnings: result.warnings,
  });

  console.log(`导入完成：${result.skins.length}/${skinRows.length} 条真实皮肤记录`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
