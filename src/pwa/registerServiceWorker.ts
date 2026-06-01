/** Register the PWA service worker (production / preview builds only). */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) {
    return;
  }

  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegistered(registration) {
        if (registration) {
          console.info('[PWA] Service worker registered');
        }
      },
      onRegisterError(error) {
        console.warn('[PWA] Service worker registration failed', error);
      },
    });
  });
}
