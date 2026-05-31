import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'src/game/CivilizationDefinitions.ts');
let s = fs.readFileSync(p, 'utf8');

if (!s.includes("from '../i18n/I18nService.js'")) {
  s = "import { t } from '../i18n/I18nService.js';\n\n" + s;
}

s = s.replace(
  'export const CIVILIZATION_DEFINITIONS:',
  'export const CIVILIZATION_DEFINITIONS_BASE:'
);

s = s.replace(
  /^\s*name:\s*'(?:\\'|[^'])*',\s*\n/gm,
  ''
);
s = s.replace(
  /^\s*adjective:\s*'(?:\\'|[^'])*',\s*\n/gm,
  ''
);
s = s.replace(
  /^\s*peoples:\s*'(?:\\'|[^'])*',\s*\n/gm,
  ''
);
s = s.replace(
  /^\s*description:\s*'(?:\\'|[^'])*',\s*\n/gm,
  ''
);

const oldGet = `export function getCivilization(civilizationType: CivilizationType): Civilization {
    return CIVILIZATION_DEFINITIONS_BASE[civilizationType];
}`;

const newGet = `export function getCivilization(civilizationType: CivilizationType): Civilization {
    const d = CIVILIZATION_DEFINITIONS_BASE[civilizationType];
    return {
        ...d,
        name: t(\`civilizations.\${civilizationType}.name\`),
        adjective: t(\`civilizations.\${civilizationType}.adjective\`),
        peoples: t(\`civilizations.\${civilizationType}.peoples\`),
        description: t(\`civilizations.\${civilizationType}.description\`)
    };
}`;

// Original file used CIVILIZATION_DEFINITIONS in getCivilization — after rename, body is wrong; fix if still old form
const legacyGet = `export function getCivilization(civilizationType: CivilizationType): Civilization {
    return CIVILIZATION_DEFINITIONS[civilizationType];
}`;

if (s.includes(legacyGet)) {
  s = s.replace(legacyGet, newGet);
} else if (s.includes(oldGet)) {
  s = s.replace(oldGet, newGet);
} else {
  console.error('getCivilization pattern not found');
  process.exit(1);
}

s = s.replace(
  'export function getCivilizationByName(name: string): Civilization | undefined {\n    return Object.values(CIVILIZATION_DEFINITIONS_BASE).find(',
  'export function getCivilizationByName(name: string): Civilization | undefined {\n    return Object.values(CIVILIZATION_DEFINITIONS_BASE).map(c => getCivilization(c.id)).find('
);
// If first replace missed (still DEFINITIONS in find):
s = s.replace(
  'return Object.values(CIVILIZATION_DEFINITIONS).find(',
  'return Object.values(CIVILIZATION_DEFINITIONS_BASE).map(c => getCivilization(c.id)).find('
);

s = s.replace(
  `export function getRandomCivilization(): Civilization {
    const civilizations = Object.values(CIVILIZATION_DEFINITIONS);
    const randomIndex = Math.floor(Math.random() * civilizations.length);
    return civilizations[randomIndex];
}`,
  `export function getRandomCivilization(): Civilization {
    const ids = Object.keys(CIVILIZATION_DEFINITIONS_BASE) as CivilizationType[];
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    return getCivilization(randomId);
}`
);

s = s.replace(
  `export function getAllCivilizations(): Civilization[] {
    // Exclude the special barbarian faction from the normal civilization pool.
    return Object.values(CIVILIZATION_DEFINITIONS).filter(c => c.id !== CivilizationType.BARBARIANS);
}`,
  `export function getAllCivilizations(): Civilization[] {
    return Object.values(CIVILIZATION_DEFINITIONS_BASE)
        .filter(c => c.id !== CivilizationType.BARBARIANS)
        .map(c => getCivilization(c.id));
}`
);

s = s.replace(
  'Object.entries(CIVILIZATION_DEFINITIONS).forEach(([key, civ]) => {',
  'Object.entries(CIVILIZATION_DEFINITIONS_BASE).forEach(([key, civ]) => {'
);

fs.writeFileSync(p, s);
console.log('Patched CivilizationDefinitions.ts');
