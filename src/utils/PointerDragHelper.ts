/** Drag a floating panel by its header using Pointer Events (mouse + touch). */
export function attachPointerDragHandle(handle: HTMLElement, panel: HTMLElement): void {
  let dragging = false;
  let pointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== pointerId) return;

    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    panel.style.left = `${Math.max(0, Math.min(event.clientX - offsetX, maxX))}px`;
    panel.style.top = `${Math.max(0, Math.min(event.clientY - offsetY, maxY))}px`;
  };

  const onEnd = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);
  };

  handle.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return;

    dragging = true;
    pointerId = event.pointerId;
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    event.preventDefault();
  });
}
