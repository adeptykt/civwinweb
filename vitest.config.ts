import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup-i18n.ts'],
    globals: true,
    environment: 'node',
    watch: false,
    environmentMatchGlobs: [['**/tile-context-menu.test.ts', 'jsdom']]
  }
});
