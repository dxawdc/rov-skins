import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const posterSchema = z.object({
  source: z.string().optional(),
  local: z.string().optional(),
  thumbnail: z.string().optional(),
  token: z.string().optional(),
  status: z.enum(['ok', 'missing', 'failed']),
});

const skinSchema = z.object({
  id: z.string().min(1),
  rowNumber: z.number(),
  heroName: z.string().min(1),
  heroRoles: z.array(z.string()),
  skinName: z.string().min(1),
  poster: posterSchema,
  qualityTag: z.string(),
  quality: z.string().min(1),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  releaseYear: z.number().nullable(),
  releaseMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  obtainMethod: z.string().min(1),
  obtainMethodText: z.string().optional(),
  localizationElement: z.string().optional(),
  localizationElementText: z.string().optional(),
  localizationInterpretation: z.string().optional(),
  isHonorOfKingsPort: z.boolean().nullable().optional(),
  hokOriginalSaleMethod: z.string().optional(),
  hasIpCollab: z.boolean().nullable().optional(),
  ipName: z.string().optional(),
  note: z.string().optional(),
  searchText: z.string(),
  raw: z.record(z.string(), z.unknown()),
});

async function main() {
  const content = await readFile('public/data/skins.json', 'utf8');
  const skins = z.array(skinSchema).parse(JSON.parse(content));
  const ids = new Set<string>();
  const duplicates: string[] = [];
  for (const skin of skins) {
    if (ids.has(skin.id)) duplicates.push(skin.id);
    ids.add(skin.id);
  }
  if (duplicates.length > 0) throw new Error(`重复 id：${duplicates.join(', ')}`);
  console.log(`数据校验通过：${skins.length} 条皮肤记录`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
