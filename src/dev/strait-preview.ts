import { OceanTerrain } from '../terrain/OceanTerrain.js';
import { ConnectionMask, type ConnectionPattern } from '../types/terrain.js';

/** Water flow through the strait (not land layout). */
export type StraitFlow = 'horizontal' | 'vertical';

export interface StraitPreviewCase {
  id: string;
  flow: StraitFlow;
  lnw: boolean;
  lne: boolean;
  lsw: boolean;
  lse: boolean;
}

export function enumerateStraitPreviewCases(): StraitPreviewCase[] {
  const cases: StraitPreviewCase[] = [];
  for (let i = 0; i < 16; i++) {
    const lnw = (i & 8) !== 0;
    const lne = (i & 4) !== 0;
    const lsw = (i & 2) !== 0;
    const lse = (i & 1) !== 0;
    const bits = `${lnw ? 1 : 0}${lne ? 1 : 0}${lsw ? 1 : 0}${lse ? 1 : 0}`;
    // Land N+S → water flows horizontally (W↔E)
    cases.push({ id: `flowH-${bits}`, flow: 'horizontal', lnw, lne, lsw, lse });
    // Land E+W → water flows vertically (N↔S)
    cases.push({ id: `flowV-${bits}`, flow: 'vertical', lnw, lne, lsw, lse });
  }
  return cases;
}

function landDiagLabel(lnw: boolean, lne: boolean, lsw: boolean, lse: boolean): string {
  const c = (land: boolean) => (land ? 'L' : 'o');
  return `NW${c(lnw)} NE${c(lne)} SW${c(lsw)} SE${c(lse)}`;
}

function buildStraitConnectionMask(
  flow: StraitFlow,
  lnw: boolean,
  lne: boolean,
  lsw: boolean,
  lse: boolean
): ConnectionPattern {
  // horizontal flow: land N+S, ocean E+W
  const ln = flow === 'horizontal';
  const ls = flow === 'horizontal';
  const le = flow === 'vertical';
  const lw = flow === 'vertical';

  let mask: ConnectionPattern = ConnectionMask.NONE;
  if (!ln) mask |= ConnectionMask.NORTH;
  if (!lne) mask |= ConnectionMask.NORTHEAST;
  if (!le) mask |= ConnectionMask.EAST;
  if (!lse) mask |= ConnectionMask.SOUTHEAST;
  if (!ls) mask |= ConnectionMask.SOUTH;
  if (!lsw) mask |= ConnectionMask.SOUTHWEST;
  if (!lw) mask |= ConnectionMask.WEST;
  if (!lnw) mask |= ConnectionMask.NORTHWEST;
  return mask;
}

function connectionMaskHex(mask: ConnectionPattern): string {
  return `0x${mask.toString(16).padStart(2, '0')}`;
}

function waitForOceanSprites(ocean: OceanTerrain): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (ocean.isImagesLoaded()) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

function renderGrid(
  container: HTMLElement,
  ocean: OceanTerrain,
  flow: StraitFlow,
  tileSize: number
): void {
  container.replaceChildren();
  const cases = enumerateStraitPreviewCases().filter((c) => c.flow === flow);

  for (const c of cases) {
    const mask = buildStraitConnectionMask(flow, c.lnw, c.lne, c.lsw, c.lse);
    const sprite = ocean.createConnectedSprite(tileSize, mask);
    const meta = ocean.getStraitPreviewMeta(flow, c.lnw, c.lne, c.lsw, c.lse);

    const cell = document.createElement('article');
    cell.className = 'cell';

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    canvas.title = c.id;
    canvas.getContext('2d')!.drawImage(sprite, 0, 0);

    const maskEl = document.createElement('div');
    maskEl.className = 'mask';
    maskEl.textContent = connectionMaskHex(mask);

    const diagEl = document.createElement('div');
    diagEl.className = 'diag';
    diagEl.textContent = landDiagLabel(c.lnw, c.lne, c.lsw, c.lse);

    const suffixEl = document.createElement('div');
    suffixEl.className = 'suffix';
    suffixEl.textContent =
      flow === 'vertical'
        ? `map: ${meta.mapSuffix} → art: ${meta.artSuffix}`
        : `suffix: ${meta.mapSuffix}`;
    suffixEl.title = meta.asset;

    const assetEl = document.createElement('div');
    assetEl.className = 'diag';
    assetEl.textContent = meta.asset;

    cell.append(canvas, maskEl, diagEl, suffixEl, assetEl);
    container.appendChild(cell);
  }
}

async function main(): Promise<void> {
  const status = document.getElementById('status')!;
  const tileSizeInput = document.getElementById('tile-size') as HTMLInputElement;
  const gridHorizontal = document.getElementById('grid-horizontal')!;
  const gridVertical = document.getElementById('grid-vertical')!;

  const ocean = new OceanTerrain();
  await waitForOceanSprites(ocean);
  status.textContent = 'Sprites loaded — 16×2 variants';

  const renderAll = () => {
    const tileSize = Math.max(32, Math.min(128, Number(tileSizeInput.value) || 48));
    tileSizeInput.value = String(tileSize);
    OceanTerrain.clearSpriteCache();
    renderGrid(gridHorizontal, ocean, 'horizontal', tileSize);
    renderGrid(gridVertical, ocean, 'vertical', tileSize);
  };

  tileSizeInput.addEventListener('change', renderAll);
  renderAll();
}

void main();
