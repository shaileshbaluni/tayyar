import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["pdfjs-dist/legacy/build/pdf.mjs"],
  },
  server: {
    port: 5174,
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
      "/api/gemini": {
        target: "http://127.0.0.1:5173",
        changeOrigin: true,
      },
      "/api/elevenlabs": {
        target: "http://127.0.0.1:5173",
        changeOrigin: true,
      },
    },
  },
});
