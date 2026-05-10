/**
 * One-off helper: extract name/description from TechnologyDefinitions.ts and WonderDefinitions.ts
 * into stdout as JSON fragments. Run: node scripts/gen-en-game.mjs
 */
import fs from 'fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const read = (p) => fs.readFileSync(root + '/' + p, 'utf8');

const tech = read('src/game/TechnologyDefinitions.ts');
const technologies = {};
const techRe = /\[TechnologyType\.([A-Z0-9_]+)\]:\s*\{[^]*?name:\s*'([^']*)'[^]*?description:\s*'([^']*)'/g;
let m;
while ((m = techRe.exec(tech))) {
  const id = tech[tech.indexOf(m[0])]; // wrong
}
// Simpler line-based: find TechnologyType.XXX blocks
const techBlock = /\[TechnologyType\.([A-Z0-9_]+)\]:\s*\{([\s\S]*?)\n\s*\},/g;
while ((m = techBlock.exec(tech))) {
  const idMatch = m[2].match(/type:\s*TechnologyType\.[A-Z0-9_]+/);
  const typeLine = m[2].match(/type:\s*(TechnologyType\.\w+),\s*\n/);
  const idLine = m[2].match(/\bid:\s*(TechnologyType\.\w+)/);
  const nameM = m[2].match(/name:\s*'((?:\\'|[^'])*)'/);
  const descM = m[2].match(/description:\s*'((?:\\'|[^'])*)'/);
  if (!nameM || !descM) continue;
  const idSub = m[2].match(/\bid:\s*TechnologyType\.(\w+)/);
  if (!idSub) continue;
  const key = m[2].match(/\bid:\s*TechnologyType\.(\w+)/)[1]
    .replace(/_/g, '_')
    .toLowerCase();
  const idStr = m[2].match(/\bid:\s*(TechnologyType\.\w+)/)[0].replace('id: TechnologyType.', '').toLowerCase();
  const realId = m[2].match(/\bid:\s*TechnologyType\.(\w+)/)[1];
  const snake = realId
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase();
  // TechnologyType enum value is snake_case in file like POTTERY: 'pottery'
  const enumVal = m[2].match(/\bid:\s*TechnologyType\.(\w+)/);
  const techConst = read('src/game/TechnologyDefinitions.ts').match(
    new RegExp(`${enumVal[1]}:\\s*'([^']+)'`)
  );
  const jsonKey = techConst ? techConst[1] : snake;
  technologies[jsonKey] = {
    name: nameM[1].replace(/\\'/g, "'"),
    description: descM[1].replace(/\\'/g, "'"),
  };
}

console.log(JSON.stringify({ technologies }, null, 0).slice(0, 500));
