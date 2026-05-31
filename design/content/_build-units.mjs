/**
 * Генератор design/content/units.json
 * Запуск: node design/content/_build-units.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'units.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'units.data.json'), 'utf8'));

const techUnlocks = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  for (const u of t.unlocks?.units ?? []) techUnlocks.add(u);
}

const ids = new Set(data.map((u) => u.id));
const missingFromData = [...techUnlocks].filter((id) => !ids.has(id));
const orphanRequires = data
  .filter((u) => u.requires_tech && !techData.some((t) => t.id === u.requires_tech))
  .map((u) => u.id);

if (missingFromData.length) {
  console.warn('Tech unlocks without unit definition:', missingFromData.join(', '));
}
if (orphanRequires.length) {
  console.warn('Units with unknown requires_tech:', orphanRequires.join(', '));
}

base.units = data;
base.meta.actual_count = data.length;

writeFileSync(join(dir, 'units.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} units`);
