/**
 * Генератор design/content/improvements.json
 * Запуск: node design/content/_build-improvements.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'improvements.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'improvements.data.json'), 'utf8'));

const techUnlocks = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  for (const id of t.unlocks?.improvements ?? []) techUnlocks.add(id);
}

const ids = new Set(data.map((i) => i.id));
const missingFromData = [...techUnlocks].filter((id) => !ids.has(id));
const orphanRequires = data
  .filter((i) => i.requires_tech && !techData.some((t) => t.id === i.requires_tech))
  .map((i) => i.id);

if (missingFromData.length) {
  console.warn('Tech unlocks without improvement definition:', missingFromData.join(', '));
}
if (orphanRequires.length) {
  console.warn('Improvements with unknown requires_tech:', orphanRequires.join(', '));
}

base.improvements = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'improvements.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} improvements`);
