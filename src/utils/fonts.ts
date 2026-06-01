/** Canvas font stacks — keep in sync with --font-ui / --font-display in styles/fonts.css */
export const FONT_UI = '"IBM Plex Sans", system-ui, sans-serif';
export const FONT_DISPLAY = '"Crimson Pro", Georgia, serif';

export function canvasUiFont(sizePx: number, weight: 'normal' | 'bold' = 'normal'): string {
  const prefix = weight === 'bold' ? 'bold ' : '';
  return `${prefix}${sizePx}px ${FONT_UI}`;
}
