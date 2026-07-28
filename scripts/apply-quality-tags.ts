import { readFile, writeFile } from 'node:fs/promises';
import type { Skin } from '../src/types/skin';

const qualityToTag: Record<string, string> = {
  A: 'EVO',
  S: 'Heroic',
  'S+': 'Epic',
  SS: 'Limited',
  'SS+': 'Legend',
  SSS: 'Prestige',
  'SSS+': 'Ultimate',
};

async function main() {
  const skins = JSON.parse(await readFile('public/data/skins.json', 'utf8')) as Skin[];
  let filled = 0;
  for (const skin of skins) {
    const mappedTag = qualityToTag[skin.quality];
    if (!skin.qualityTag && mappedTag) {
      skin.qualityTag = mappedTag;
      filled += 1;
    }
    skin.searchText = [
      skin.heroName,
      skin.skinName,
      ...skin.heroRoles,
      skin.qualityTag,
      skin.quality,
      skin.obtainMethod,
      skin.ipName,
    ]
      .filter(Boolean)
      .join(' ');
  }

  await writeFile('public/data/skins.json', `${JSON.stringify(skins, null, 2)}\n`, 'utf8');
  console.log(`已补齐 ${filled} 条皮肤品质标签`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
