import { TemplateLoader } from './TemplateLoader';

/**
 * Manages loading and initialization of UI templates
 */
export class UITemplateManager {
  private static instance: UITemplateManager;
  private templatesLoaded = false;

  static getInstance(): UITemplateManager {
    if (!this.instance) {
      this.instance = new UITemplateManager();
    }
    return this.instance;
  }

  /**
   * Load all UI templates into the page
   */
  async loadAllTemplates(): Promise<void> {
    if (this.templatesLoaded) {
      return;
    }

    const container = document.getElementById('templates-container');
    if (!container) {
      throw new Error('Templates container not found');
    }

    try {
      // Load all templates in parallel for better performance
      const templatePromises = [
        this.loadTemplate(container, '/templates/minimap-window.html'),
        this.loadTemplate(container, '/templates/status-window.html'),
        this.loadTemplate(container, '/templates/scenario-modal.html'),
        this.loadTemplate(container, '/templates/city-modal.html'),
        this.loadTemplate(container, '/templates/settings-modal.html'),
        this.loadTemplate(container, '/templates/technology-selection-modal.html'),
        this.loadTemplate(container, '/templates/science-advisor-modal.html'),
        this.loadTemplate(container, '/templates/technology-discovery-modal.html'),
        this.loadTemplate(container, '/templates/defeat-notification-modal.html'),
        this.loadTemplate(container, '/templates/building-completion-modal.html'),
        this.loadTemplate(container, '/templates/historical-facts-modal.html'),
        this.loadTemplate(container, '/templates/budget-modal.html'),
        this.loadTemplate(container, '/templates/government-modal.html'),
        this.loadTemplate(container, '/templates/diplomacy-dialog.html'),
      ];

      await Promise.all(templatePromises);
      this.templatesLoaded = true;
      
      console.log('All UI templates loaded successfully');
    } catch (error) {
      console.error('Error loading UI templates:', error);
      throw error;
    }
  }

  /**
   * Load a single template and append it to the container
   */
  private async loadTemplate(container: HTMLElement, templatePath: string): Promise<void> {
    try {
      const fragment = await TemplateLoader.createElement(templatePath);
      container.appendChild(fragment);
    } catch (error) {
      console.error(`Failed to load template ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * Check if templates are loaded
   */
  isLoaded(): boolean {
    return this.templatesLoaded;
  }

  /**
   * Reload all templates (useful for development)
   */
  async reloadTemplates(): Promise<void> {
    TemplateLoader.clearCache();
    this.templatesLoaded = false;
    
    const container = document.getElementById('templates-container');
    if (container) {
      container.innerHTML = '';
    }
    
    await this.loadAllTemplates();
  }
}
