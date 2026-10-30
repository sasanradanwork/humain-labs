import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The build is one self-contained index.html (script, styles and the founder photo inlined),
// which is what Azure Static Web Apps serves and what the preview link publishes.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: 2 * 1024 * 1024, chunkSizeWarningLimit: 2000 },
  server: { port: 5173, proxy: { "/api": "http://localhost:4280", "/.auth": "http://localhost:4280" } },
});
