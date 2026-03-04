/**
 * LeaderSprites.ts
 * Sprite-sheet helpers for leaders.png (970×1020 pixels).
 *
 * Layout:  3 civ columns × 5 rows of blocks.
 * Exact pixel measurements from the sprite sheet:
 *
 *   Column starts (x): 0, 325, 650
 *   Row starts    (y): 0, 205, 410, 615, 820
 *
 * Each block is separated by 1-px magenta gutters.
 * Content inside each block (magenta-separated):
 *   - Face cell grid: 3 cols × 4 rows (x = 1..179, within-block offset)
 *     Each face cell: 59 px wide × 49 px tall, separated by 1-px magenta gaps
 *     Face cells start at within-block x = 1, 61, 121, 181  (cols 0-3)
 *                                        y = 1, 51, 101, 151 (rows 0-3)
 *   - Large portrait: within-block x = 181 to 324 (width 144), y = 1..204
 *     (portrait overlaps with face col 3 in the top half of the block)
 *
 * Civ order in the sheet (left→right, top→bottom):
 *   Row 0: English  · Egyptian  · Indian
 *   Row 1: Zulu     · American  · Mongol
 *   Row 2: Chinese  · Babylonian· Russian
 *   Row 3: Aztec    · Roman     · French
 *   Row 4: Greek    · (empty)   · German (Frederick)
 */

import type { CivilizationType } from '../game/CivilizationDefinitions.js';
import { AIMood } from '../game/DiplomacyManager.js';
import type { GovernmentType } from '../types/game.js';

// ── Leaders sheet constants (EXACT pixel values from sprite sheet) ──────────

const SHEET_W = 970;
const SHEET_H = 1020;

/** Exact column start X positions in the sprite sheet (separated by 1-px magenta gutters). */
const COL_X = [0, 325, 650] as const;
/** Exact row start Y positions in the sprite sheet (separated by 1-px magenta gutters). */
const ROW_Y = [0, 205, 410, 615, 820] as const;

/** Width of each civ block (content area within magenta border). */
const BLOCK_W = 324; // col 0 & 1: x=1..324 (324px); col 2: x=1..319 (319px) – use 324 uniformly
/** Height of each civ block (content area within magenta border). */
const BLOCK_H = 204; // y=1..204

/** X-offset from block origin (COL_X[col]) where the large portrait begins. */
const PORTRAIT_X = 181; // absolute within-block offset
/** Natural dimensions of the large portrait area. */
export const PORTRAIT_W = 144; // pixels (portrait spans x=181..324 = 144px wide)
export const PORTRAIT_H = 204; // pixels (full block height)

/** Each mood face cell: exact size (within-block, separated by 1-px magenta gaps). */
export const FACE_W = 59; // each face cell is 59 px wide
export const FACE_H = 49; // each face cell is 49 px tall

/** Within-block x offsets where each face column starts (0-indexed, 1-px magenta gap before each). */
const FACE_COL_X = [1, 61, 121, 181] as const; // 4 face cols
/** Within-block y offsets where each face row starts (0-indexed, 1-px magenta gap before each). */
const FACE_ROW_Y = [1, 51, 101, 151] as const; // 4 face rows

// ── Civ → block position ────────────────────────────────────────────────────

const CIV_BLOCK: Partial<Record<string, { col: number; row: number }>> = {
  english:    { col: 0, row: 0 },
  egyptian:   { col: 1, row: 0 },
  indian:     { col: 2, row: 0 },
  zulu:       { col: 0, row: 1 },
  american:   { col: 1, row: 1 },
  german:     { col: 2, row: 4 },
  chinese:    { col: 0, row: 2 },
  babylonian: { col: 1, row: 2 },
  russian:    { col: 2, row: 2 },
  aztecs:     { col: 0, row: 3 },
  romans:     { col: 1, row: 3 },
  french:     { col: 2, row: 3 },
  greeks:     { col: 0, row: 4 },
  mongol:     { col: 2, row: 1 },
};

/**
 * Mood → face position (col, row) in the 4×4 expression grid.
 *
 * Layout assumption (rows 0→3 = pleased→furious):
 *   Row 0: bright positive expressions   (amiable … neutral)
 *   Row 1: reserved / slightly concerned (unused in default mapping)
 *   Row 2: displeased / demanding
 *   Row 3: hostile / fearful
 */
const MOOD_FACE: Record<AIMood, { col: number; row: number }> = {
  [AIMood.AMIABLE]:    { col: 0, row: 0 },
  [AIMood.CORDIAL]:    { col: 1, row: 0 },
  [AIMood.CAUTIOUS]:   { col: 2, row: 0 },
  [AIMood.NEUTRAL]:    { col: 3, row: 0 },
  [AIMood.HOSTILE]:    { col: 0, row: 2 },
  [AIMood.DEMANDING]:  { col: 1, row: 2 },
  [AIMood.AGGRESSIVE]: { col: 0, row: 3 },
  [AIMood.FEARFUL]:    { col: 3, row: 3 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function blockOrigin(civType: CivilizationType): { bx: number; by: number } | null {
  const pos = CIV_BLOCK[civType as string];
  if (!pos) return null;
  const bx = COL_X[pos.col as 0 | 1 | 2];
  const by = ROW_Y[pos.row as 0 | 1 | 2 | 3 | 4];
  return { bx, by };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface SpriteStyle {
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundPosition: string;
  backgroundSize: string;
  width: string;
  height: string;
  imageRendering: string;
}

const SPRITE_URL = new URL('../assets/leaders.png', import.meta.url).href;
const OFFICIALS_URL = new URL('../assets/officials.png', import.meta.url).href;

let activeLeadersUrl = SPRITE_URL;
let activeOfficialsUrl = OFFICIALS_URL;

let spriteInitPromise: Promise<void> | null = null;

export async function initializeSprites(): Promise<void> {
  if (spriteInitPromise) return spriteInitPromise;
  
  spriteInitPromise = Promise.all([
    createKeyedSprite(SPRITE_URL, [
      [255, 67, 255],   // magenta bounding boxes
    ], true),
    createKeyedSprite(OFFICIALS_URL, [
      [0, 187, 255],    // cyan bg
      [0, 63, 191],     // medium blue bg
      [0, 127, 243],    // light blue bg
      [123, 67, 255],   // purple bg
      [255, 67, 255],   // magenta bounding boxes
    ], false)
  ]).then(([leaders, officials]) => {
    activeLeadersUrl = leaders;
    activeOfficialsUrl = officials;
  }).catch(e => {
    console.error("Failed to key sprite colors", e);
  });
  
  return spriteInitPromise;
}

function createKeyedSprite(url: string, keyColors: number[][], useFloodFill: boolean = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // No crossOrigin needed since it's local assets
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(url);
      
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      // We will create a boolean array to track which pixels to clear
      const toClear = new Uint8Array(width * height);
      
      const isKeyColor = (r: number, g: number, b: number) => {
        for (const [kr, kg, kb] of keyColors) {
          if (r === kr && g === kg && b === kb) {
            return true;
          }
        }
        return false;
      };

      if (useFloodFill) {
        // Flood fill algorithm that automatically identifies the background color
        // by looking at the corners within each civ block.
        // It will ONLY clear pixels that exactly match the boundary color it started from.
        const isMagenta = (r: number, g: number, b: number) => r === 255 && g === 67 && b === 255;

        // Exact block column/row starts (matching COL_X / ROW_Y constants)
        const colStarts = [0, 325, 650];
        const rowStarts = [0, 205, 410, 615, 820];
        // Portrait within-block x offset and width
        const portOffsetX = 181;
        const portW       = 144;
        const portH       = 204; // same as block height

        const tryFloodFill = (startX: number, startY: number) => {
          if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
          const startIdx = (startY * width + startX) * 4;
          const r0 = data[startIdx];
          const g0 = data[startIdx + 1];
          const b0 = data[startIdx + 2];
          
          if (isMagenta(r0, g0, b0) || toClear[startY * width + startX] === 1) return;

          const queue: number[] = [startX, startY];
          toClear[startY * width + startX] = 1;
          
          let qIdx = 0;
          while (qIdx < queue.length) {
            const x = queue[qIdx++];
            const y = queue[qIdx++];
            
            const neighbors = [
              [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
            ];
            
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const checkIdx = ny * width + nx;
                if (toClear[checkIdx] === 0) {
                  const dataIdx = checkIdx * 4;
                  const nr = data[dataIdx];
                  const ng = data[dataIdx + 1];
                  const nb = data[dataIdx + 2];
                  
                  // Only continue if the adjacent pixel exactly matches the seed color
                  if (nr === r0 && ng === g0 && nb === b0) {
                    toClear[checkIdx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }
          }
        };

        // For each of the 3x5 blocks, seed the flood fill from every pixel on
        // the perimeter of the portrait area that matches the background colour.
        // This handles:
        //   - Col 2 portraits that extend to the image edge (right seeds out of bounds)
        //   - Leaders whose head/hat splits the top into disconnected bg regions
        //
        // Background colour is detected from the top-left corner of each portrait.
        for (let row = 0; row < 5; row++) {
          const numCols = (row === 4) ? 2 : 3; // last row only has 2 civs
          for (let col = 0; col < numCols; col++) {
            const bx = colStarts[col];
            const by = rowStarts[row];

            const px   = bx + portOffsetX + 1;       // portrait left x (+1 skips magenta border)
            const py   = by + 1;                      // portrait top  y (+1 skips magenta border)
            const rx   = Math.min(px + portW - 1, width  - 1); // right x, clamped to image
            const boty = Math.min(py + portH - 1, height - 1); // bottom y, clamped to image

            // Detect background colour from top-left corner of portrait.
            const bgIdx = (py * width + px) * 4;
            const bgR = data[bgIdx], bgG = data[bgIdx + 1], bgB = data[bgIdx + 2];
            if (isMagenta(bgR, bgG, bgB)) continue; // safety: skip if somehow magenta

            const seedIfBg = (sx: number, sy: number) => {
              if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;
              const di = (sy * width + sx) * 4;
              if (data[di] === bgR && data[di + 1] === bgG && data[di + 2] === bgB) {
                tryFloodFill(sx, sy);
              }
            };

            // Seed every pixel along all 4 edges of the portrait rectangle.
            // Already-cleared pixels are skipped instantly by tryFloodFill.
            for (let sx = px; sx <= rx; sx++) {
              seedIfBg(sx, py);    // top edge
              seedIfBg(sx, boty);  // bottom edge
            }
            for (let sy = py + 1; sy < boty; sy++) {
              seedIfBg(px, sy);    // left edge
              seedIfBg(rx, sy);    // right edge
            }
          }
        }
        
        // Globally remove magenta bounding-box pixels
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (isMagenta(data[idx], data[idx + 1], data[idx + 2]) || isKeyColor(data[idx], data[idx + 1], data[idx + 2])) {
              toClear[y * width + x] = 1;
            }
          }
        }

      } else {
        // Global replace (original behavior)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (isKeyColor(data[idx], data[idx + 1], data[idx + 2])) {
              toClear[y * width + x] = 1;
            }
          }
        }
      }
      
      // Apply the transparency
      for (let i = 0; i < width * height; i++) {
        if (toClear[i]) {
          data[i * 4 + 3] = 0; // alpha = 0
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(URL.createObjectURL(blob));
        else resolve(url);
      });
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/**
 * Returns inline CSS properties to display the mood-specific face for
 * a given civilization, scaled up by `scale` (default ×3).
 *
 * The element should be sized exactly to `FACE_W * scale` × `FACE_H * scale`.
 */
export function getMoodFaceStyle(
  civType: CivilizationType,
  mood: AIMood,
  scale = 3,
): SpriteStyle {
  const origin = blockOrigin(civType);
  const facePos = MOOD_FACE[mood];
  const w = FACE_W * scale;
  const h = FACE_H * scale;

  if (!origin || !facePos) {
    return {
      backgroundImage: `url('${activeLeadersUrl}')`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
      width: `${w}px`,
      height: `${h}px`,
      imageRendering: 'pixelated',
    };
  }

  // Exact within-block offsets for face cells
  const fx = origin.bx + FACE_COL_X[facePos.col];
  const fy = origin.by + FACE_ROW_Y[facePos.row];

  return {
    backgroundImage: `url('${activeLeadersUrl}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${fx * scale}px -${fy * scale}px`,
    backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
    width: `${w}px`,
    height: `${h}px`,
    imageRendering: 'pixelated',
  };
}

/**
 * Returns inline CSS properties to display the large neutral portrait
 * for a given civilization at the given display scale (default ×1).
 */
export function getPortraitStyle(
  civType: CivilizationType,
  scale = 1,
): SpriteStyle {
  const origin = blockOrigin(civType);
  const w = PORTRAIT_W * scale;
  const h = PORTRAIT_H * scale;

  if (!origin) {
    return {
      backgroundImage: `url('${activeLeadersUrl}')`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
      width: `${w}px`,
      height: `${h}px`,
      imageRendering: 'pixelated',
    };
  }

  // Portrait starts at the exact within-block x offset (181px) from the block origin
  const px = origin.bx + PORTRAIT_X;
  const py = origin.by + 1; // +1 to skip the 1-px magenta top border

  return {
    backgroundImage: `url('${activeLeadersUrl}')`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${px * scale}px -${py * scale}px`,
    backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
    width: `${w}px`,
    height: `${h}px`,
    imageRendering: 'pixelated',
  };
}

/** Apply a SpriteStyle object to an HTMLElement's inline styles. */
export function applySpriteStyle(el: HTMLElement, style: SpriteStyle): void {
  el.style.backgroundImage    = style.backgroundImage;
  el.style.backgroundRepeat   = style.backgroundRepeat;
  el.style.backgroundPosition = style.backgroundPosition;
  el.style.backgroundSize     = style.backgroundSize;
  el.style.width              = style.width;
  el.style.height             = style.height;
  (el.style as any).imageRendering = style.imageRendering;
}

// ═══════════════════════════════════════════════════════════════════════════
// Officials sheet  (officials.png  970×610)
// 3 cols × 3 rows, each block ~323×203 px.
//
// Layout per block (as per user clarification):
//   It's a 4-column × 2-row grid inside each block.
//   The bottom 4 boxes are the ones used for the diplomacy screen officials.
//
// Government → block mapping:
//   Row 0: Despotism  (col 0)  ·  Communism   (col 1)  ·  unused (col 2)
//   Row 1: Monarchy   (col 0)  ·  Republic    (col 1)  ·  Democracy (col 2)
//   Row 2: Anarchy    (col 0)  ·  (unused)
// ═══════════════════════════════════════════════════════════════════════════

const OFFICIALS_SHEET_W = 970;
const OFFICIALS_SHEET_H = 610;
const OFFICIAL_BLOCK_W  = Math.floor(OFFICIALS_SHEET_W / 3); // 323
const OFFICIAL_BLOCK_H  = Math.floor(OFFICIALS_SHEET_H / 3); // 203

// Each official box is 1/4 the block width, 1/2 the block height
export const OFFICIAL_FIGURE_W = Math.floor(OFFICIAL_BLOCK_W / 4); // ≈ 80
export const OFFICIAL_FIGURE_H = Math.floor(OFFICIAL_BLOCK_H / 2); // ≈ 101

const GOV_BLOCK: Partial<Record<string, { col: number; row: number }>> = {
  despotism:  { col: 0, row: 0 },
  anarchy:    { col: 0, row: 2 },
  communism:  { col: 1, row: 0 },
  monarchy:   { col: 0, row: 1 },
  republic:   { col: 1, row: 1 },
  democracy:  { col: 2, row: 1 },
};

/**
 * Returns inline CSS to display one diplomacy official
 * for the given government type from officials.png, scaled by `scale`.
 * `officialIndex` should be 0, 1, 2, or 3 (representing the 4 bottom boxes).
 *
 * The element should be sized to OFFICIAL_FIGURE_W*scale × OFFICIAL_FIGURE_H*scale.
 */
export function getOfficialStyle(
  govType: GovernmentType,
  officialIndex: number,
  scale = 1,
): SpriteStyle {
  const pos = GOV_BLOCK[govType as string] ?? GOV_BLOCK['despotism']!;
  // Compute block origin
  const bx  = pos.col === 2 ? OFFICIALS_SHEET_W - OFFICIAL_BLOCK_W : pos.col * OFFICIAL_BLOCK_W;
  const by  = pos.row * OFFICIAL_BLOCK_H;
  
  // The diplomacy officials are the bottom 4 boxes in the block.
  // We use officialIndex (0 to 3) for the column, and row=1 for the bottom.
  const col = Math.max(0, Math.min(3, officialIndex));
  
  const fx  = bx + (col * OFFICIAL_FIGURE_W);
  const fy  = by + OFFICIAL_FIGURE_H; // bottom row
  
  const w   = OFFICIAL_FIGURE_W * scale;
  const h   = OFFICIAL_FIGURE_H * scale;

  return {
    backgroundImage:    `url('${activeOfficialsUrl}')`,
    backgroundRepeat:   'no-repeat',
    backgroundPosition: `-${fx * scale}px -${fy * scale}px`,
    backgroundSize:     `${OFFICIALS_SHEET_W * scale}px ${OFFICIALS_SHEET_H * scale}px`,
    width:  `${w}px`,
    height: `${h}px`,
    imageRendering: 'pixelated',
  };
}
