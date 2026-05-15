import { I18nService, t } from '../i18n/I18nService.js';

/**
 * Formats remaining movement points for UI. Road/rail fractional costs (e.g. 1/3)
 * accumulate floating-point noise; this keeps labels short and readable.
 */
export function formatMovementPointsDisplay(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(2)).toString();
}

/**
 * Russian plural for countable "ход" (game turn): 1 ход, 2–4 хода, 5+ ходов
 * (with 11–14 always ходов).
 */
export function ruPluralHodPhrase(n: number): string {
  const x = Math.abs(Math.floor(n));
  const m10 = x % 10;
  const m100 = x % 100;
  let word: string;
  if (m10 === 1 && m100 !== 11) {
    word = 'ход';
  } else if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) {
    word = 'хода';
  } else {
    word = 'ходов';
  }
  return `${x} ${word}`;
}

/** e.g. "(3 turns)" / "(3 хода)" */
export function formatTurnsRemainingParen(n: number): string {
  if (I18nService.getInstance().getLocale() === 'ru') {
    return `(${ruPluralHodPhrase(n)})`;
  }
  return t('templates.cityModal.turnsRemaining', { n });
}

/** Queue row: "(~3 turns)" / "(~3 хода)" */
export function formatApproxTurnsParen(n: number): string {
  if (I18nService.getInstance().getLocale() === 'ru') {
    return `(~${ruPluralHodPhrase(n)})`;
  }
  return t('templates.cityModal.queueTurnsApprox', { n });
}

/** Production list "(n turns)" */
export function formatProductionOptionTurnsParen(n: number): string {
  if (I18nService.getInstance().getLocale() === 'ru') {
    return `(${ruPluralHodPhrase(n)})`;
  }
  return t('templates.production.optionTurns', { turns: n });
}

export function formatProductionUnitDetails(params: {
  turns: number;
  adm: string;
  attack: number;
  defense: number;
  movement: number;
}): string {
  const { turns, adm, attack, defense, movement } = params;
  if (I18nService.getInstance().getLocale() === 'ru') {
    return `(${ruPluralHodPhrase(turns)}, ${adm}:${attack}/${defense}/${movement})`;
  }
  return t('templates.production.optionUnitDetails', {
    turns,
    adm,
    attack,
    defense,
    movement,
  });
}

export function formatProductionHelpTimeLine(turns: number): string {
  if (I18nService.getInstance().getLocale() === 'ru') {
    return `Время: ${ruPluralHodPhrase(turns)}`;
  }
  return t('templates.production.helpTime', { turns });
}

/** Status queue dialog / similar: "1 move" | "2 moves" / "1 ход" | "2 хода" */
export function formatQueueMovesDisplay(n: number): string {
  const locale = I18nService.getInstance().getLocale();
  const ms = formatMovementPointsDisplay(n);
  const isWhole = Math.abs(n - Math.round(n)) < 1e-4;
  const ni = Math.round(n);

  if (locale === 'ru' && isWhole) {
    return ruPluralHodPhrase(ni);
  }
  if (locale === 'en' && isWhole && ni === 1) {
    return t('statusPanel.queueMoveOne');
  }
  return t('statusPanel.queueMoves', { n: ms });
}
