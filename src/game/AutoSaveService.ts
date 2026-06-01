const AUTO_SAVE_KEY = 'civwin-autosave';
const AUTO_SAVE_META_KEY = 'civwin-autosave-meta';

export interface AutoSaveMeta {
  turn: number;
  savedAt: string;
}

export type AutoSavePayload = {
  version: number;
  savedAt: string;
  gameState: unknown;
  diplomacy: unknown;
};

export function shouldAutoSaveThisTurn(
  turn: number,
  enabled: boolean,
  interval: number,
): boolean {
  if (!enabled || interval < 1 || turn < 1) return false;
  return turn % interval === 0;
}

export function writeAutoSave(payload: AutoSavePayload): void {
  try {
    const json = JSON.stringify(payload);
    localStorage.setItem(AUTO_SAVE_KEY, json);
    const turn = (payload.gameState as { turn?: number })?.turn ?? 0;
    const meta: AutoSaveMeta = { turn, savedAt: payload.savedAt };
    localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('Auto-save failed:', e);
  }
}

export function readAutoSave(): AutoSavePayload | null {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoSavePayload;
  } catch {
    return null;
  }
}

export function readAutoSaveMeta(): AutoSaveMeta | null {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoSaveMeta;
  } catch {
    return null;
  }
}

export function clearAutoSave(): void {
  localStorage.removeItem(AUTO_SAVE_KEY);
  localStorage.removeItem(AUTO_SAVE_META_KEY);
}
