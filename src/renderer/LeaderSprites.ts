/**
 * LeaderSprites.ts
 * Sprite-sheet helpers for leaders.png (970×1020 pixels).
 *
 * Layout:  3 civ columns × 5 rows of blocks.
 * Each block (323×204 px) contains:
 *   LEFT  ~60 %  (≈194 px wide)  : 4-col × 4-row grid of mood faces (~48×51 px each)
 *   RIGHT ~40 %  (≈129 px wide)  : large neutral portrait, full block height
 *
 * Civ order in the sheet (left→right, top→bottom):
 *   Row 0: English  · Egyptian  · Indian
 *   Row 1: Zulu     · American  · German
 *   Row 2: Chinese  · Babylonian· Russian
 *   Row 3: Aztec    · Roman     · French
 *   Row 4: Greek    · Mongol
 */

import type { CivilizationType } from '../game/CivilizationDefinitions.js';
import { AIMood } from '../game/DiplomacyManager.js';
import type { GovernmentType } from '../types/game.js';

// ── Leaders sheet constants ─────────────────────────────────────────────────

const SHEET_W = 970;
const SHEET_H = 1020;

/** Each civ occupies one rectangular block in a 3-col × 5-row grid. */
const BLOCK_W = Math.floor(SHEET_W / 3);     // 323
const BLOCK_H = Math.floor(SHEET_H / 5);     // 204

/** X-offset from block origin where the large portrait begins. */
const PORTRAIT_X = Math.round(BLOCK_W * 0.60);   // ≈ 194
/** Natural dimensions of the large portrait area. */
export const PORTRAIT_W = BLOCK_W - PORTRAIT_X;  // ≈ 129
export const PORTRAIT_H = BLOCK_H;               // 204

/** Mood face grid is 4 columns × 4 rows inside the left portion. */
const FACE_COLS = 4;
const FACE_ROWS = 4;
export const FACE_W = Math.floor(PORTRAIT_X / FACE_COLS);  // ≈ 48
export const FACE_H = Math.floor(BLOCK_H    / FACE_ROWS);  // ≈ 51

// ── Civ → block position ────────────────────────────────────────────────────

const CIV_BLOCK: Partial<Record<string, { col: number; row: number }>> = {
  english:    { col: 0, row: 0 },
  egyptian:   { col: 1, row: 0 },
  indian:     { col: 2, row: 0 },
  zulu:       { col: 0, row: 1 },
  american:   { col: 1, row: 1 },
  german:     { col: 2, row: 1 },
  chinese:    { col: 0, row: 2 },
  babylonian: { col: 1, row: 2 },
  russian:    { col: 2, row: 2 },
  aztecs:     { col: 0, row: 3 },
  romans:     { col: 1, row: 3 },
  french:     { col: 2, row: 3 },
  greeks:     { col: 0, row: 4 },
  mongol:     { col: 1, row: 4 },
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
  // Column 2 gets the remainder pixel (970 % 3 = 1)
  const bx = pos.col === 2 ? SHEET_W - BLOCK_W : pos.col * BLOCK_W;
  const by = pos.row * BLOCK_H;
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
      backgroundImage: `url('${SPRITE_URL}')`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
      width: `${w}px`,
      height: `${h}px`,
      imageRendering: 'pixelated',
    };
  }

  const fx = origin.bx + facePos.col * FACE_W;
  const fy = origin.by + facePos.row * FACE_H;

  return {
    backgroundImage: `url('${SPRITE_URL}')`,
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
      backgroundImage: `url('${SPRITE_URL}')`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
      width: `${w}px`,
      height: `${h}px`,
      imageRendering: 'pixelated',
    };
  }

  const px = origin.bx + PORTRAIT_X;
  const py = origin.by;

  return {
    backgroundImage: `url('${SPRITE_URL}')`,
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

const OFFICIALS_URL = new URL('../assets/officials.png', import.meta.url).href;

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
    backgroundImage:    `url('${OFFICIALS_URL}')`,
    backgroundRepeat:   'no-repeat',
    backgroundPosition: `-${fx * scale}px -${fy * scale}px`,
    backgroundSize:     `${OFFICIALS_SHEET_W * scale}px ${OFFICIALS_SHEET_H * scale}px`,
    width:  `${w}px`,
    height: `${h}px`,
    imageRendering: 'pixelated',
  };
}
