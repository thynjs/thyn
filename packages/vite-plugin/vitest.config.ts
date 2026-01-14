import thyn from "./src/index.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [thyn()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
    setupFiles: ['./tests/setup.ts'],
  },
});
