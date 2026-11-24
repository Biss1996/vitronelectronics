import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    // Generates src/routeTree.gen.ts from the files in src/routes. Must come before react().
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    // In development, /api calls go to the backend on port 4000 — same as production,
    // where DigitalOcean routes /api to the backend on the same domain.
    proxy: {
      "/api": { target: process.env.API_PROXY || "http://localhost:4000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
