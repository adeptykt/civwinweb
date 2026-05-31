/**
 * Валидация согласованности design/content
 * Запуск: node design/scripts/validate-content.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const content = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

function load(name) {
  return JSON.parse(readFileSync(join(content, name), 'utf8'));
}

const techs = load('technologies.data.json');
const units = load('units.data.json').map((u) => u.id);
const buildings = load('buildings.data.json').map((b) => b.id);
const wonders = load('wonders.data.json').map((w) => w.id);
const improvements = load('improvements.data.json').map((i) => i.id);
const governments = load('governments.data.json').map((g) => g.id);
const events = load('events.data.json').map((e) => e.id);

const sets = {
  units: new Set(units),
  buildings: new Set(buildings),
  wonders: new Set(wonders),
  improvements: new Set(improvements),
  governments: new Set(governments),
};

const techIds = new Set(techs.map((t) => t.id));
const errors = [];

function checkUnlock(type, id, techId) {
  if (!sets[type].has(id)) {
    errors.push(`[${techId}] unlocks.${type}: missing definition "${id}"`);
  }
}

for (const t of techs) {
  for (const u of t.unlocks?.units ?? []) checkUnlock('units', u, t.id);
  for (const b of t.unlocks?.buildings ?? []) checkUnlock('buildings', b, t.id);
  for (const w of t.unlocks?.wonders ?? []) checkUnlock('wonders', w, t.id);
  for (const i of t.unlocks?.improvements ?? []) checkUnlock('improvements', i, t.id);
  for (const g of t.unlocks?.governments ?? []) checkUnlock('governments', g, t.id);
  const ev = t.research?.event_unlock;
  if (ev && !events.includes(ev)) {
    errors.push(`[${t.id}] research.event_unlock: missing event "${ev}"`);
  }
  for (const prereq of t.prerequisites?.all ?? []) {
    if (!techIds.has(prereq)) errors.push(`[${t.id}] unknown prerequisite "${prereq}"`);
  }
  for (const prereq of t.prerequisites?.any ?? []) {
    if (!techIds.has(prereq)) errors.push(`[${t.id}] unknown prerequisite (any) "${prereq}"`);
  }
}

for (const u of load('units.data.json')) {
  if (u.requires_tech && !techIds.has(u.requires_tech)) {
    errors.push(`[unit ${u.id}] unknown requires_tech "${u.requires_tech}"`);
  }
}

for (const catalog of ['buildings', 'wonders', 'improvements', 'governments']) {
  const data = load(`${catalog}.data.json`);
  for (const item of data) {
    if (item.requires_tech && !techIds.has(item.requires_tech)) {
      errors.push(`[${catalog} ${item.id}] unknown requires_tech "${item.requires_tech}"`);
    }
  }
}

// prerequisite cycle check (DFS)
const graph = new Map();
for (const t of techs) {
  graph.set(t.id, t.prerequisites?.all ?? []);
}
const visiting = new Set();
const visited = new Set();
function dfs(id, stack) {
  if (visited.has(id)) return;
  if (visiting.has(id)) {
    errors.push(`Cycle in prerequisites: ${[...stack, id].join(' -> ')}`);
    return;
  }
  visiting.add(id);
  for (const p of graph.get(id) ?? []) dfs(p, [...stack, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const id of techIds) dfs(id, []);

if (errors.length) {
  console.error(`Validation failed (${errors.length} issues):`);
  for (const e of errors) console.error('  ', e);
  process.exit(1);
}

console.log('Validation OK:', {
  technologies: techs.length,
  units: units.length,
  buildings: buildings.length,
  wonders: wonders.length,
  improvements: improvements.length,
  governments: governments.length,
  events: events.length,
});
