/**
 * Генератор design/content/wonders.json
 * Запуск: node design/content/_build-wonders.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'wonders.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'wonders.data.json'), 'utf8'));

const techUnlocks = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  for (const w of t.unlocks?.wonders ?? []) techUnlocks.add(w);
}

const ids = new Set(data.map((w) => w.id));
const missingFromData = [...techUnlocks].filter((id) => !ids.has(id));
const orphanRequires = data
  .filter((w) => w.requires_tech && !techData.some((t) => t.id === w.requires_tech))
  .map((w) => w.id);
const extraNotInTech = data
  .filter((w) => w.requires_tech && !techUnlocks.has(w.id))
  .map((w) => w.id);

if (missingFromData.length) {
  console.warn('Tech unlocks without wonder definition:', missingFromData.join(', '));
}
if (orphanRequires.length) {
  console.warn('Wonders with unknown requires_tech:', orphanRequires.join(', '));
}
if (extraNotInTech.length) {
  console.log('Wonders defined but not in tech unlocks (requires_tech only):', extraNotInTech.join(', '));
}

base.wonders = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'wonders.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} wonders`);
