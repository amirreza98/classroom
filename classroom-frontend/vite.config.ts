import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',      // ← required for Docker
    port: 5173,
    proxy: {
      "/api": {
        target: "http://backend:8000",  // ← service name, not localhost
        changeOrigin: true,
      },
    },
  },
});