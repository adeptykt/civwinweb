/**
 * Manages the defeat notification modal that appears when a player is defeated
 */
export class DefeatNotificationModal {
  private modal: HTMLElement | null = null;
  private messageText: HTMLElement | null = null;
  private isVisible: boolean = false;
  private onAcknowledged: (() => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  private initializeModal(): void {
    this.modal = document.getElementById('defeat-notification-modal');
    this.messageText = document.getElementById('defeat-message-text');

    if (!this.modal || !this.messageText) {
      console.error('Defeat notification modal elements not found');
      return;
    }

    // Set up event handlers
    const closeBtn = document.getElementById('defeat-notification-close');
    const okBtn = document.getElementById('defeat-notification-ok');

    closeBtn?.addEventListener('click', () => this.acknowledge());
    okBtn?.addEventListener('click', () => this.acknowledge());

    // Close modal when clicking outside
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.acknowledge();
      }
    });

    // Handle keyboard events for acknowledgment
    document.addEventListener('keydown', (event) => {
      if (this.isVisible) {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.acknowledge();
        }
      }
    });
  }

  /**
   * Show the defeat notification modal
   * @param defeatedCivName Name of the defeated civilization
   * @param victorCivName Name of the victorious civilization
   * @param onAcknowledged Callback function called when notification is acknowledged
   */
  public show(defeatedCivName: string, victorCivName: string, onAcknowledged?: () => void): void {
    if (!this.modal || !this.messageText) {
      console.error('Modal elements not available');
      return;
    }

    // Store the acknowledgment callback
    this.onAcknowledged = onAcknowledged || null;

    // Set the defeat message
    this.messageText.textContent = `The ${defeatedCivName} have been defeated by the mighty ${victorCivName}.`;

    // Show the modal
    this.modal.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Acknowledge the defeat notification and hide the modal
   */
  private acknowledge(): void {
    console.log('Defeat notification acknowledged');
    
    // Call the acknowledgment callback if provided
    if (this.onAcknowledged) {
      this.onAcknowledged();
    }
    
    // Hide the modal
    this.hide();
  }

  /**
   * Hide the defeat notification modal
   */
  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.isVisible = false;
      this.onAcknowledged = null;
    }
  }

  /**
   * Check if the modal is currently visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }
}
