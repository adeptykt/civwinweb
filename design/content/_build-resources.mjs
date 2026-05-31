/**
 * Генератор design/content/resources.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'resources.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'resources.data.json'), 'utf8'));

base.resources = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'resources.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} resources`);
