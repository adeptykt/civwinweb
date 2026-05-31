/**
 * Utility for loading HTML templates dynamically
 */
export class TemplateLoader {
  private static cache = new Map<string, string>();

  /**
   * Load an HTML template from a file
   */
  static async loadTemplate(templatePath: string): Promise<string> {
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath)!;
    }

    try {
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templatePath}`);
      }
      
      const html = await response.text();
      this.cache.set(templatePath, html);
      return html;
    } catch (error) {
      console.error(`Error loading template ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * Insert a template into a container element
   */
  static async insertTemplate(containerSelector: string, templatePath: string): Promise<void> {
    const container = document.querySelector(containerSelector);
    if (!container) {
      throw new Error(`Container element not found: ${containerSelector}`);
    }

    const html = await this.loadTemplate(templatePath);
    container.innerHTML = html;
  }

  /**
   * Append a template to a container element
   */
  static async appendTemplate(containerSelector: string, templatePath: string): Promise<void> {
    const container = document.querySelector(containerSelector);
    if (!container) {
      throw new Error(`Container element not found: ${containerSelector}`);
    }

    const html = await this.loadTemplate(templatePath);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
  }

  /**
   * Create a DOM element from a template
   */
  static async createElement(templatePath: string): Promise<DocumentFragment> {
    const html = await this.loadTemplate(templatePath);
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.cloneNode(true) as DocumentFragment;
  }

  /**
   * Clear the template cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
