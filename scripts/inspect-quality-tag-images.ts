import { readFile } from 'node:fs/promises';

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

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('请传入 cells-get 工具结果 JSON 文件路径');
  const persisted = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  const toolText = extractToolText(persisted);
  const toolJsonMatch = toolText.match(/\{[\s\S]*\}/);
  if (!toolJsonMatch) throw new Error('工具结果中没有找到 JSON');
  const toolJson = JSON.parse(toolJsonMatch[0]) as { stdout?: string };
  const stdout = JSON.parse(toolJson.stdout ?? '{}') as { data?: { ranges?: Array<{ cells?: unknown[][]; row_indices?: number[]; col_indices?: string[] }> } };
  const range = stdout.data?.ranges?.[0];
  if (!range?.cells) throw new Error('没有 cells');
  const headers = range.cells[0].map((cell) => (cell as { value?: string }).value ?? '');
  const results: unknown[] = [];
  range.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const record = cell as { value?: string; rich_text?: Array<{ type?: string; image_token?: string; image_width?: number; image_height?: number }> };
      const image = record.rich_text?.find((item) => item.type === 'embed-image' && item.image_token);
      if (!image) return;
      results.push({
        row: range.row_indices?.[rowIndex],
        col: range.col_indices?.[colIndex],
        header: headers[colIndex],
        rowLabel: row[0] && (row[0] as { value?: string }).value,
        value: record.value,
        imageToken: image.image_token,
        width: image.image_width,
        height: image.image_height,
      });
    });
  });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
