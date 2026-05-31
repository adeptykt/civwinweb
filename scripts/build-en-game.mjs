/**
 * Generates src/locales/en.game.json from TS definition files (English source strings).
 * Run: node scripts/build-en-game.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

function extractTechnologyMap(text) {
  const start = text.indexOf('export const TechnologyType = {');
  const end = text.indexOf('} as const;', start);
  const block = text.slice(start, end);
  const map = {};
  const re = /(\w+):\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    map[m[1]] = m[2];
  }
  return map;
}

function extractTechnologies(text, typeMap) {
  const out = {};
  const defStart = text.indexOf('export const TECHNOLOGY_DEFINITIONS');
  const slice = text.slice(defStart);
  const re = /\[TechnologyType\.(\w+)\]:\s*\{([\s\S]*?)\n  \}(?:,|\n\};)/g;
  let m;
  while ((m = re.exec(slice))) {
    const constName = m[1];
    const body = m[2];
    const id = typeMap[constName];
    if (!id) continue;
    const nameM = body.match(/name:\s*'((?:\\'|[^'])*)'/);
    const descM = body.match(/description:\s*'((?:\\'|[^'])*)'/);
    if (!nameM || !descM) continue;
    out[id] = {
      name: nameM[1].replace(/\\'/g, "'"),
      description: descM[1].replace(/\\'/g, "'")
    };
  }
  return { technologies: out };
}

function extractBuildings(text) {
  const out = {};
  const re = /\[BuildingType\.(\w+)\]:\s*\{([\s\S]*?)\n  \},/g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[2];
    const idM = body.match(/spritePath:[^]*?tinybuildings\/(\w+)\.png/);
    const nameM = body.match(/name:\s*'((?:\\'|[^'])*)'/);
    const descM = body.match(/description:\s*'((?:\\'|[^'])*)'/);
    if (!nameM || !descM) continue;
    const idLine = body.match(/\n    \/\/|requiredBuilding/);
    const keyM = body.match(/BuildingType\.(\w+)/);
    let key = null;
    const bt = read('src/types/game.ts');
    const enumMatch = bt.match(new RegExp(`${m[1]}:\\s*'([^']+)'`));
    if (enumMatch) key = enumMatch[1];
    if (!key) continue;
    out[key] = {
      name: nameM[1].replace(/\\'/g, "'"),
      description: descM[1].replace(/\\'/g, "'")
    };
  }
  return { buildings: out };
}

function extractWonders(text) {
  const out = {};
  const re = /\[WonderType\.(\w+)\]:\s*\{([\s\S]*?)\n  \},/g;
  let m;
  const wt = read('src/types/game.ts');
  while ((m = re.exec(text))) {
    const body = m[2];
    const nameM = body.match(/name:\s*'((?:\\'|[^'])*)'|name:\s*"((?:\\"|[^"])*)"/);
    const descM = body.match(/description:\s*'((?:\\'|[^'])*)'/);
    const effM = body.match(/effects:\s*\[([\s\S]*?)\]/);
    if (!nameM || !descM) continue;
    const name = (nameM[1] || nameM[2] || '').replace(/\\'/g, "'").replace(/\\"/g, '"');
    const wonderConst = m[1];
    const keyMatch = wt.match(new RegExp(`${wonderConst}:\\s*'([^']+)'`));
    const key = keyMatch ? keyMatch[1] : wonderConst.toLowerCase();
    const effects = [];
    if (effM) {
      const inner = effM[1];
      const strs = inner.matchAll(/'((?:\\'|[^'])*)'/g);
      for (const s of strs) {
        effects.push(s[1].replace(/\\'/g, "'"));
      }
    }
    out[key] = {
      name,
      description: descM[1].replace(/\\'/g, "'"),
      effects
    };
  }
  return { wonders: out };
}

function extractCivilizations(text) {
  const out = {};
  const re = /\[CivilizationType\.(\w+)\]:\s*\{([\s\S]*?)\n    \},/g;
  let m;
  const ct = read('src/types/game.ts');
  while ((m = re.exec(text))) {
    const body = m[2];
    const civConst = m[1];
    const keyMatch = ct.match(new RegExp(`${civConst}:\\s*'([^']+)'`));
    const key = keyMatch ? keyMatch[1] : civConst.toLowerCase();
    const nameM = body.match(/name:\s*'((?:\\'|[^'])*)'/);
    const adjM = body.match(/adjective:\s*'((?:\\'|[^'])*)'/);
    const peoplesM = body.match(/peoples:\s*'((?:\\'|[^'])*)'/);
    const descM = body.match(/description:\s*'((?:\\'|[^'])*)'/);
    if (!nameM || !adjM || !peoplesM || !descM) continue;
    out[key] = {
      name: nameM[1].replace(/\\'/g, "'"),
      adjective: adjM[1].replace(/\\'/g, "'"),
      peoples: peoplesM[1].replace(/\\'/g, "'"),
      description: descM[1].replace(/\\'/g, "'")
    };
  }
  return { civilizations: out };
}

function unitKeys() {
  const bt = read('src/types/game.ts');
  const start = bt.indexOf('export const UnitType = {');
  const end = bt.indexOf('};', start);
  const block = bt.slice(start, end);
  const map = {};
  const re = /(\w+):\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    map[m[2]] = m[2];
  }
  return Object.keys(map);
}

function displayNamesFromFile() {
  const dn = read('src/utils/DisplayNames.ts');
  const special = {};
  const re = /'([\w_]+)':\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(dn))) {
    if (m[1].includes(' ')) continue;
    special[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return special;
}

function titleCase(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildUnits() {
  const special = displayNamesFromFile();
  const keys = unitKeys();
  const units = {};
  for (const k of keys) {
    units[k] = { name: special[k] || titleCase(k) };
  }
  return { units };
}

function extractHistoricalFacts(text) {
  const facts = {};
  const re = /\{\s*year:\s*(-?\d+),\s*title:\s*"((?:\\"|[^"])*)",\s*description:\s*"((?:\\"|[^"])*)"\s*\}/g;
  let m;
  while ((m = re.exec(text))) {
    const y = m[1];
    facts[y] = {
      title: m[2].replace(/\\"/g, '"'),
      description: m[3].replace(/\\"/g, '"')
    };
  }
  return { historicalFacts: facts };
}

function terrainPlaceholders() {
  const types = [
    'grassland',
    'plains',
    'desert',
    'forest',
    'hills',
    'mountains',
    'ocean',
    'river',
    'jungle',
    'swamp',
    'arctic',
    'tundra'
  ];
  const terrain = {};
  for (const t of types) {
    terrain[t] = { description: `terrain.${t}.description` };
  }
  return { terrain };
}

const techText = read('src/game/TechnologyDefinitions.ts');
const typeMap = extractTechnologyMap(techText);
const techJson = extractTechnologies(techText, typeMap);

const buildingText = read('src/game/BuildingDefinitions.ts');
const buildingsJson = extractBuildings(buildingText);

const wonderText = read('src/game/WonderDefinitions.ts');
const wondersJson = extractWonders(wonderText);

const civText = read('src/game/CivilizationDefinitions.ts');
const civJson = extractCivilizations(civText);

const histText = read('src/game/HistoricalFacts.ts');
const histJson = extractHistoricalFacts(histText);

const unitsJson = buildUnits();

// Real terrain descriptions — read one file pattern
function extractTerrainDescriptions() {
  const dir = path.join(root, 'src/terrain');
  const terrain = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('Terrain.ts')) continue;
    const text = read(path.join('src/terrain', f));
    const cls = text.match(/export class (\w+)/);
    if (!cls) continue;
    const typeMatch = text.match(/TerrainType\.(\w+)/);
    if (!typeMatch) continue;
    const keyMatch = read('src/types/game.ts').match(new RegExp(`${typeMatch[1]}:\\s*'([^']+)'`));
    const key = keyMatch ? keyMatch[1] : null;
    if (!key) continue;
    const getDesc = text.match(/getDescription\(\)[^{]*\{[^]*?return\s+([\s\S]*?);\s*\}/);
    if (!getDesc) continue;
    let raw = getDesc[1].trim();
    raw = raw.replace(/^["']|["']$/g, '');
    raw = raw.replace(/\s*\+\s*["']\s*/g, '');
    raw = raw.replace(/["']\s*\+\s*/g, '');
    raw = raw.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim();
    const strMatch = text.match(/return\s+"([^"]+)"\s*\+\s*"([^"]*)"/);
    if (strMatch) {
      terrain[key] = { description: strMatch[1] + strMatch[2] };
      continue;
    }
    const oneStr = text.match(/return\s+"([^"]*)";/);
    if (oneStr) {
      terrain[key] = { description: oneStr[1] };
      continue;
    }
    const concat = text.match(/return\s+"([^"]*)"\s*\+\s*\n\s*"([^"]*)"/);
    if (concat) {
      terrain[key] = { description: concat[1] + concat[2] };
    }
  }
  return { terrain };
}

let terrainJson;
try {
  terrainJson = extractTerrainDescriptions();
} catch {
  terrainJson = terrainPlaceholders();
}

const merged = {
  ...techJson,
  ...buildingsJson,
  ...wondersJson,
  ...civJson,
  ...unitsJson,
  ...histJson,
  ...terrainJson
};

const outPath = path.join(root, 'src/locales/en.game.json');
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
console.log('Wrote', outPath, 'keys:', Object.keys(merged).join(', '));
