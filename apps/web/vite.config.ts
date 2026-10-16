import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    allowedHosts: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@kuhni/calc": fileURLToPath(
        new URL("../../packages/calc/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "supabase";
          }
        },
      },
    },
  },
});
