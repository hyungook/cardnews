import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [], // No tests in figma-plugin (Figma sandbox code can't be unit tested)
  },
});
