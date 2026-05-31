/**
 * Генератор design/content/buildings.json
 * Запуск: node design/content/_build-buildings.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'buildings.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'buildings.data.json'), 'utf8'));

const techUnlocks = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  for (const b of t.unlocks?.buildings ?? []) techUnlocks.add(b);
}

const ids = new Set(data.map((b) => b.id));
const missingFromData = [...techUnlocks].filter((id) => !ids.has(id));
const orphanRequires = data
  .filter((b) => b.requires_tech && !techData.some((t) => t.id === b.requires_tech))
  .map((b) => b.id);
const extraNotInTech = data
  .filter((b) => b.requires_tech && !techUnlocks.has(b.id))
  .map((b) => b.id);

if (missingFromData.length) {
  console.warn('Tech unlocks without building definition:', missingFromData.join(', '));
}
if (orphanRequires.length) {
  console.warn('Buildings with unknown requires_tech:', orphanRequires.join(', '));
}
if (extraNotInTech.length) {
  console.log('Buildings defined but not in tech unlocks (requires_tech only):', extraNotInTech.join(', '));
}

base.buildings = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'buildings.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} buildings`);
