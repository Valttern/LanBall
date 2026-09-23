import { defineConfig } from "vite";

// Kehitystilassa /ws ja /api ohjataan paikalliselle LAN-palvelimelle (npm run server).
export default defineConfig({
  build: { target: "es2022" },
  server: {
    proxy: {
      "/ws": { target: "ws://localhost:8080", ws: true },
      "/api": "http://localhost:8080",
    },
  },
});
