import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development, /api calls are proxied to the FastAPI backend so the
// frontend never has to worry about CORS or absolute URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
