import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The engine and asset modules use explicit .ts specifiers so they run under
  // Node's native type stripping with no build step. Vite resolves them as-is.
  build: {
    outDir: "dist",
    sourcemap: true,
    // Overwrite in place rather than clearing the directory first. The
    // sandboxed shell this is sometimes built from cannot unlink files, and
    // a stale hashed asset is harmless since index.html names the current one.
    emptyOutDir: false,
  },
});
