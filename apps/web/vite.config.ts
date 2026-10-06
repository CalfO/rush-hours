import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    // `@rushhours/domain` is an npm-workspace symlink (`packages/domain`),
    // built to CommonJS (see CLAUDE.md). Vite's dependency scanner doesn't
    // pre-bundle linked workspace packages by default, so without this it's
    // served raw via `/@fs/...` and the browser tries to load it as native
    // ESM — its `__exportStar`-based barrel re-exports (`dist/index.js`)
    // aren't statically visible as `export` syntax, so named imports like
    // `profileSchema` fail at runtime ("does not provide an export named").
    // Forcing it through esbuild's optimizer runs it through proper
    // CJS→ESM interop (cjs-module-lexer), which resolves re-exports
    // correctly.
    include: ["@rushhours/domain"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
