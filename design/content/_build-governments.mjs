/**
 * Генератор design/content/governments.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'governments.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'governments.data.json'), 'utf8'));

const techUnlocks = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  for (const id of t.unlocks?.governments ?? []) techUnlocks.add(id);
}

const ids = new Set(data.map((g) => g.id));
const missingFromData = [...techUnlocks].filter((id) => !ids.has(id));
if (missingFromData.length) {
  console.warn('Tech unlocks without government definition:', missingFromData.join(', '));
}

base.governments = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'governments.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} governments`);
