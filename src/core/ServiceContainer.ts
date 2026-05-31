/**
 * Service container for dependency injection and service management
 */
export class ServiceContainer {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();

  /**
   * Register a service factory
   */
  register<T>(name: string, factory: () => T, singleton: boolean = true): void {
    this.services.set(name, { factory, singleton });
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }

    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory());
      }
      return this.singletons.get(name);
    }

    return service.factory();
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }
}

// Global service container instance
export const serviceContainer = new ServiceContainer();
