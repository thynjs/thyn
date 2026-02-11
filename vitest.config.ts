import { resolve } from "path";
import { defineConfig } from "vitest/config";
import thyn from "./src/plugin/index.js";

export default defineConfig({
  plugins: [thyn()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
    alias: {
      '@thyn/core': resolve(__dirname, './src'),
    },
  },
});
