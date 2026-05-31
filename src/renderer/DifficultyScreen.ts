/**
 * DifficultyScreen – full-screen difficulty.png (4800×3584) with UI regions
 * in image pixel space: text panel (2641,746)–(4235,2777), five portrait hit areas.
 * Inactive portraits are dimmed; the portrait for the selected level is clear.
 *
 * Optional looped portrait clips (same frame as the static art), UTF-8 names:
 *   public/difficulty/chieftain.mp4
 *   public/difficulty/warlord.mp4
 *   public/difficulty/prince.mp4
 *   public/difficulty/king.mp4
 *   public/difficulty/emperor.mp4
 * If a file is missing or fails to decode, that slot stays static (background image only).
 */

import type { DifficultyLevel } from '../types/game';
import { t } from '../i18n/I18nService.js';

export type { DifficultyLevel };

export const DIFFICULTY_LEVEL_ORDER: DifficultyLevel[] = [
  'chieftain',
  'warlord',
  'prince',
  'king',
  'emperor',
];

/** Source image pixel size */
const IMG_W = 4800;
const IMG_H = 3584;

const DIFFICULTY_BG_URL = new URL('../assets/difficulty.png', import.meta.url).href;

function difficultyVideoUrl(level: DifficultyLevel): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}difficulty/${level}.mp4`;
}

/** Absolute document URL (same resolution as pasting path in the address bar) */
function difficultyVideoAbsoluteUrl(level: DifficultyLevel): string {
  return new URL(difficultyVideoUrl(level), window.location.href).href;
}

/** Set `localStorage.debugDifficultyVideo = '1'` to log in production builds too */
function difficultyVideoDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('debugDifficultyVideo') === '1';
  } catch {
    return false;
  }
}

function dsVideoLog(...args: unknown[]): void {
  if (!difficultyVideoDebugEnabled()) return;
  // eslint-disable-next-line no-console -- intentional portrait-video diagnostics
  console.log('[DifficultyScreen:video]', ...args);
}

function mediaErrorSummary(err: MediaError | null): { code: number; message: string } | null {
  if (!err) return null;
  return { code: err.code, message: err.message };
}

function videoStateSnapshot(video: HTMLVideoElement): Record<string, unknown> {
  return {
    src: video.src,
    currentSrc: video.currentSrc,
    networkState: video.networkState,
    readyState: video.readyState,
    paused: video.paused,
    error: mediaErrorSummary(video.error),
  };
}

function clearPortraitVideo(video: HTMLVideoElement): void {
  video.onerror = null;
  video.onloadeddata = null;
  video.oncanplay = null;
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.classList.add('ds-portrait-video--off');
}

/** Portrait rectangles in source pixels: (left, top)–(right, bottom) per difficulty */
const PORTRAIT_RECTS: Record<DifficultyLevel, { l: number; t: number; r: number; b: number }> = {
  chieftain: { l: 292, t: 101, r: 1155, b: 972 },
  warlord: { l: 1244, t: 733, r: 2106, b: 1602 },
  prince: { l: 292, t: 1356, r: 1155, b: 2224 },
  king: { l: 1243, t: 1978, r: 2106, b: 2847 },
  emperor: { l: 292, t: 2601, r: 1155, b: 3471 },
};

function pctRectStyle(rect: { l: number; t: number; r: number; b: number }): string {
  const { l, t, r, b } = rect;
  return [
    `left:calc(${l} / ${IMG_W} * 100%)`,
    `top:calc(${t} / ${IMG_H} * 100%)`,
    `width:calc(${r - l} / ${IMG_W} * 100%)`,
    `height:calc(${b - t} / ${IMG_H} * 100%)`,
  ].join(';');
}

export class DifficultyScreen {
  private overlay: HTMLElement;
  private selectedLevel: DifficultyLevel = 'chieftain';
  /** Bumps on each sync/hide so stale video callbacks no-op */
  private portraitVideoEpoch = 0;
  private onConfirm: ((level: DifficultyLevel) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.keydownHandler = this.handleKeydown.bind(this);
    this.setupEventListeners();
  }

  show(): void {
    this.applyLabels();
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);
    this.syncPortraitVideos();
  }

  hide(): void {
    this.clearAllPortraitVideos();
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  refreshI18n(): void {
    if (this.isVisible()) {
      this.applyLabels();
    }
  }

  setOnConfirm(cb: (level: DifficultyLevel) => void): void {
    this.onConfirm = cb;
  }
  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'difficulty-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const portraitButtons = DIFFICULTY_LEVEL_ORDER.map(level => {
      const style = pctRectStyle(PORTRAIT_RECTS[level]);
      const active = level === 'chieftain' ? ' ds-active' : '';
      /* div, not button — nested <video> + transparent ::after over video breaks painting in some Chromium builds */
      return `
        <div class="ds-portrait${active}"
             role="button"
             tabindex="-1"
             data-level="${level}"
             style="${style}">
          <video class="ds-portrait-video ds-portrait-video--off"
                 muted playsinline loop preload="auto"
                 aria-hidden="true"></video>
        </div>`;
    }).join('');

    overlay.innerHTML = `
      <div class="ds-inner">
        <img class="ds-bg" src="${DIFFICULTY_BG_URL}" alt="" width="${IMG_W}" height="${IMG_H}" draggable="false" />
        <div class="ds-portrait-layer">
          ${portraitButtons}
        </div>
        <div class="ds-panel">
          <p class="ds-panel-title"></p>
          <ul class="ds-level-list" role="listbox" aria-label="">
            ${DIFFICULTY_LEVEL_ORDER.map((level, i) => `
              <li class="ds-level-item${i === 0 ? ' ds-selected' : ''}"
                  data-level="${level}"
                  role="option"
                  aria-selected="${i === 0}">
                <span class="ds-diamond" aria-hidden="true">${i === 0 ? '◆' : '◇'}</span>
                <span class="ds-level-label"></span>
              </li>
            `).join('')}
          </ul>
          <div class="ds-btn-row">
            <button class="ds-btn" id="ds-back-btn" type="button"></button>
            <button class="ds-btn ds-btn-ok" id="ds-ok-btn" type="button"></button>
          </div>
        </div>
      </div>
    `;

    this.applyLabelsTo(overlay);
    return overlay;
  }

  private applyLabels(): void {
    this.applyLabelsTo(this.overlay);
  }

  private applyLabelsTo(root: HTMLElement): void {
    root.setAttribute('aria-label', t('difficultyScreen.ariaDialog'));
    const title = root.querySelector('.ds-panel-title');
    if (title) title.textContent = t('difficultyScreen.title');
    const list = root.querySelector('.ds-level-list');
    if (list) {
      list.setAttribute('aria-label', t('difficultyScreen.ariaLevels'));
    }
    for (const level of DIFFICULTY_LEVEL_ORDER) {
      const row = root.querySelector(`.ds-level-item[data-level="${level}"]`);
      const label = row?.querySelector('.ds-level-label');
      if (label) {
        label.textContent = t(`difficultyScreen.levelLabels.${level}`);
      }
      const portrait = root.querySelector(`.ds-portrait[data-level="${level}"]`);
      if (portrait) {
        portrait.setAttribute('aria-label', t(`difficultyScreen.levelLabels.${level}`));
      }
    }
    const back = root.querySelector('#ds-back-btn') as HTMLButtonElement | null;
    if (back) back.textContent = t('difficultyScreen.goBack');
    const ok = root.querySelector('#ds-ok-btn') as HTMLButtonElement | null;
    if (ok) ok.textContent = t('dialogs.ok');
  }

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.ds-level-item').forEach(el => {
      el.addEventListener('click', () => this.selectLevel(el as HTMLElement));
      el.addEventListener('dblclick', () => {
        this.selectLevel(el as HTMLElement);
        this.confirm();
      });
    });

    this.overlay.querySelectorAll('.ds-portrait').forEach(el => {
      el.addEventListener('click', () => {
        const level = el.getAttribute('data-level') as DifficultyLevel | null;
        if (!level) return;
        const row = this.overlay.querySelector(`.ds-level-item[data-level="${level}"]`) as HTMLElement | null;
        if (row) this.selectLevel(row);
      });
      el.addEventListener('dblclick', () => {
        const level = el.getAttribute('data-level') as DifficultyLevel | null;
        if (!level) return;
        const row = this.overlay.querySelector(`.ds-level-item[data-level="${level}"]`) as HTMLElement | null;
        if (row) {
          this.selectLevel(row);
          this.confirm();
        }
      });
    });

    this.overlay.querySelector('#ds-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#ds-ok-btn')?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.ds-level-item'));
    const idx = items.findIndex(el => el.classList.contains('ds-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectLevel(items[(idx + 1) % items.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectLevel(items[(idx - 1 + items.length) % items.length]);
        break;
      case 'Enter':
        e.preventDefault();
        this.confirm();
        break;
      case 'Escape':
        e.preventDefault();
        this.goBack();
        break;
    }
  }

  private selectLevel(item: HTMLElement): void {
    this.overlay.querySelectorAll<HTMLElement>('.ds-level-item').forEach(el => {
      el.classList.remove('ds-selected');
      el.setAttribute('aria-selected', 'false');
      const d = el.querySelector<HTMLElement>('.ds-diamond');
      if (d) d.textContent = '◇';
    });
    item.classList.add('ds-selected');
    item.setAttribute('aria-selected', 'true');
    const d = item.querySelector<HTMLElement>('.ds-diamond');
    if (d) d.textContent = '◆';
    this.selectedLevel = item.dataset.level as DifficultyLevel;

    this.overlay.querySelectorAll<HTMLElement>('.ds-portrait').forEach(el => {
      const lvl = el.dataset.level as DifficultyLevel | undefined;
      el.classList.toggle('ds-active', lvl === this.selectedLevel);
    });

    this.syncPortraitVideos();
  }

  private clearAllPortraitVideos(): void {
    this.portraitVideoEpoch++;
    this.overlay.querySelectorAll<HTMLVideoElement>('.ds-portrait-video').forEach(clearPortraitVideo);
  }

  private syncPortraitVideos(): void {
    this.portraitVideoEpoch++;
    const epoch = this.portraitVideoEpoch;

    dsVideoLog('sync start', {
      epoch,
      selectedLevel: this.selectedLevel,
      BASE_URL: import.meta.env.BASE_URL,
      location: typeof window !== 'undefined' ? window.location.href : '(no window)',
    });

    this.overlay.querySelectorAll<HTMLElement>('.ds-portrait').forEach(btn => {
      const level = btn.dataset.level as DifficultyLevel | undefined;
      if (!level) return;
      const video = btn.querySelector<HTMLVideoElement>('.ds-portrait-video');
      if (!video) return;

      if (level !== this.selectedLevel) {
        clearPortraitVideo(video);
        return;
      }

      const wantResolved = difficultyVideoAbsoluteUrl(level);
      if (video.src === wantResolved && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        dsVideoLog('reuse cached src, play()', level, videoStateSnapshot(video));
        video.classList.remove('ds-portrait-video--off');
        requestAnimationFrame(() => {
          void video.play().catch(err => {
            dsVideoLog('play() rejected (reuse path)', level, err, videoStateSnapshot(video));
            if (epoch !== this.portraitVideoEpoch) return;
            clearPortraitVideo(video);
          });
        });
        return;
      }

      clearPortraitVideo(video);

      const attachPipelineLogs = (): void => {
        if (!difficultyVideoDebugEnabled()) return;
        const once = { once: true } as AddEventListenerOptions;
        const logEv = (ev: string) => () =>
          dsVideoLog(`event:${ev}`, level, videoStateSnapshot(video), {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
          });
        video.addEventListener('loadstart', logEv('loadstart'), once);
        video.addEventListener('loadedmetadata', logEv('loadedmetadata'), once);
        video.addEventListener('loadeddata', logEv('loadeddata(extra)'), once);
        video.addEventListener('canplay', logEv('canplay'), once);
        video.addEventListener('canplaythrough', logEv('canplaythrough'), once);
        video.addEventListener('stalled', logEv('stalled'), once);
        video.addEventListener('waiting', logEv('waiting'), once);
        video.addEventListener('suspend', logEv('suspend'), once);
      };
      attachPipelineLogs();

      video.playsInline = true;
      video.muted = true;
      video.defaultMuted = true;

      let playbackStarted = false;
      video.onerror = () => {
        video.onerror = null;
        video.onloadeddata = null;
        video.oncanplay = null;
        dsVideoLog('onerror', level, videoStateSnapshot(video));
        if (epoch !== this.portraitVideoEpoch) return;
        if (this.selectedLevel !== level) return;
        clearPortraitVideo(video);
      };
      const onReady = (via: 'loadeddata' | 'canplay'): void => {
        if (playbackStarted) return;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          dsVideoLog(`${via} skipped (readyState < HAVE_CURRENT_DATA)`, video.readyState, videoStateSnapshot(video));
          return;
        }
        if (epoch !== this.portraitVideoEpoch) {
          dsVideoLog(`${via} ignored (stale epoch)`, { epoch, current: this.portraitVideoEpoch });
          return;
        }
        if (this.selectedLevel !== level) {
          dsVideoLog(`${via} ignored (level changed)`, { level, selected: this.selectedLevel });
          return;
        }
        playbackStarted = true;
        video.onerror = null;
        video.onloadeddata = null;
        video.oncanplay = null;
        dsVideoLog(`${via} → play()`, level, videoStateSnapshot(video), {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        video.classList.remove('ds-portrait-video--off');
        requestAnimationFrame(() => {
          void video.play().catch(err => {
            dsVideoLog('play() rejected', level, err, videoStateSnapshot(video));
            if (epoch !== this.portraitVideoEpoch) return;
            clearPortraitVideo(video);
          });
        });
      };

      video.onloadeddata = () => onReady('loadeddata');
      video.oncanplay = () => onReady('canplay');

      dsVideoLog('assign src', level, { relative: difficultyVideoUrl(level), wantResolved });
      video.src = wantResolved;
    });
  }

  private confirm(): void {
    this.hide();
    this.onConfirm?.(this.selectedLevel);
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
