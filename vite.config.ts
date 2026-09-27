import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During local dev, forward /api calls to a local API server
      // running on port 8787 (see api/dev-server.ts).
      "/api": "http://localhost:8787",
    },
  },
});
