import { getHistoricalFact } from '../game/HistoricalFacts';

/**
 * Modal for displaying historical facts about a specific year
 */
export class HistoricalFactsModal {
  private modal: HTMLElement | null = null;
  private isVisible = false;

  constructor() {
    this.initializeModal();
  }

  private initializeModal(): void {
    this.modal = document.getElementById('historical-facts-modal');
    
    if (!this.modal) {
      console.warn('Historical facts modal not found in DOM');
      return;
    }

    // Setup close button
    const closeBtn = this.modal.querySelector('.historical-facts-close') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Setup OK button
    const okBtn = this.modal.querySelector('.historical-facts-ok') as HTMLButtonElement;
    if (okBtn) {
      okBtn.addEventListener('click', () => this.close());
    }

    // Close on clicking outside the modal content
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  /**
   * Show the modal with a fact for the given year
   */
  public showForYear(year: number): void {
    if (!this.modal) return;

    const fact = getHistoricalFact(year);
    if (!fact) return;

    // Update modal content
    const titleElement = this.modal.querySelector('.historical-facts-title') as HTMLElement;
    const descriptionElement = this.modal.querySelector('.historical-facts-description') as HTMLElement;
    const yearElement = this.modal.querySelector('.historical-facts-year') as HTMLElement;

    if (titleElement) {
      titleElement.textContent = fact.title;
    }
    if (descriptionElement) {
      descriptionElement.textContent = fact.description;
    }
    if (yearElement) {
      const displayYear = fact.year < 0 ? `${Math.abs(fact.year)} BC` : `${fact.year} AD`;
      yearElement.textContent = displayYear;
    }

    this.open();
  }

  private open(): void {
    if (!this.modal) return;
    this.modal.classList.add('visible');
    this.isVisible = true;
  }

  private close(): void {
    if (!this.modal) return;
    this.modal.classList.remove('visible');
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }
}
