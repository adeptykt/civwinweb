/**
 * Генератор design/content/technologies.json
 * Запуск: node design/content/_build-technologies.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'technologies.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));

const expected = base.meta?.count_target ?? data.length;
if (data.length !== expected) {
  console.warn(`Expected ${expected} technologies, got ${data.length}`);
}

base.technologies = data;
base.meta.actual_count = data.length;

writeFileSync(join(dir, 'technologies.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} technologies`);
