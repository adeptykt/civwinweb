/**
 * A lightweight Win95-style notification / confirmation dialog.
 *
 * Usage:
 *   await NotificationDialog.info('Title', 'Some message.');
 *   const yes = await NotificationDialog.confirm('Title', 'Are you sure?');
 */
export class NotificationDialog {
  /**
   * Show an information dialog with a single OK button.
   * Returns a Promise that resolves when the user dismisses the dialog.
   */
  static info(title: string, message: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const overlay = NotificationDialog.createOverlay(
        title, message, false,
        () => resolve(),
        () => resolve()
      );
      document.body.appendChild(overlay);
      overlay.querySelector<HTMLButtonElement>('.notif-btn-ok')?.focus();
    });
  }

  /**
   * Show a confirmation dialog with OK and Cancel buttons.
   * Resolves to `true` if OK was clicked, `false` if Cancel / ESC was used.
   */
  static confirm(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const overlay = NotificationDialog.createOverlay(
        title, message, true,
        () => resolve(true),
        () => resolve(false)
      );
      document.body.appendChild(overlay);
      overlay.querySelector<HTMLButtonElement>('.notif-btn-ok')?.focus();
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static createOverlay(
    title: string,
    message: string,
    showCancel: boolean,
    onOk: () => void,
    onCancel: () => void
  ): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'notif-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const htmlMessage = message.replace(/\n/g, '<br>');
    const cancelBtn = showCancel
      ? `<button class="notif-btn notif-btn-cancel">Cancel</button>`
      : '';

    overlay.innerHTML = `
      <div class="notif-dialog">
        <div class="notif-title-bar">
          <span class="notif-title-text">${title}</span>
          <button class="notif-close-btn" title="Close" aria-label="Close">×</button>
        </div>
        <div class="notif-content">
          <p class="notif-message">${htmlMessage}</p>
        </div>
        <div class="notif-buttons">
          <button class="notif-btn notif-btn-ok">OK</button>
          ${cancelBtn}
        </div>
      </div>
    `;

    const remove = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    overlay.querySelector<HTMLButtonElement>('.notif-btn-ok')
      ?.addEventListener('click', () => { remove(); onOk(); });

    overlay.querySelector<HTMLButtonElement>('.notif-btn-cancel')
      ?.addEventListener('click', () => { remove(); onCancel(); });

    overlay.querySelector<HTMLButtonElement>('.notif-close-btn')
      ?.addEventListener('click', () => { remove(); onCancel(); });

    // Keyboard support
    overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); remove(); onOk(); }
      if (e.key === 'Escape') { e.preventDefault(); remove(); onCancel(); }
    });

    return overlay;
  }
}
