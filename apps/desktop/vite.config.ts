import vue from "@vitejs/plugin-vue";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildFile = resolve(__dirname, "scripts", "build.json");

function getBuildNumber(): number {
  if (!existsSync(buildFile)) return 0;
  try {
    return JSON.parse(readFileSync(buildFile, "utf-8")).number ?? 0;
  } catch {
    return 0;
  }
}

const buildNumber = getBuildNumber();

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: process.env.TAURI_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].b${buildNumber}.js`,
        chunkFileNames: `assets/[name].[hash].b${buildNumber}.js`,
        assetFileNames: `assets/[name].[hash].b${buildNumber}[extname]`
      }
    }
  }
});
