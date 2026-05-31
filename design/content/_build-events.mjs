/**
 * Генератор design/content/events.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(dir, 'events.data.json'), 'utf8'));

const techEvents = new Set();
const techData = JSON.parse(readFileSync(join(dir, 'technologies.data.json'), 'utf8'));
for (const t of techData) {
  const id = t.research?.event_unlock;
  if (id) techEvents.add(id);
}

const ids = new Set(data.map((e) => e.id));
const missing = [...techEvents].filter((id) => !ids.has(id));
if (missing.length) {
  console.warn('Tech event_unlock without event definition:', missing.join(', '));
}

base.events = data;
base.meta.actual_count = data.length;
base.meta.count_target = data.length;

writeFileSync(join(dir, 'events.json'), JSON.stringify(base, null, 2) + '\n', 'utf8');
console.log(`Written ${data.length} events`);
