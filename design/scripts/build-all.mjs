/**
 * Сборка всего контента design/content
 * Запуск: node design/scripts/build-all.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const scripts = [
  '_build-technologies.mjs',
  '_build-units.mjs',
  '_build-buildings.mjs',
  '_build-wonders.mjs',
  '_build-improvements.mjs',
  '_build-governments.mjs',
  '_build-resources.mjs',
  '_build-events.mjs',
  '_build-abilities.mjs',
];

let failed = false;
for (const s of scripts) {
  const r = spawnSync(process.execPath, [join(root, s)], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log('All design catalogs built.');
