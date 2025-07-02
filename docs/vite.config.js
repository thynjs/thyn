import thyn from "@thyn/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [thyn()],
  build: { modulePreload: false },
});
