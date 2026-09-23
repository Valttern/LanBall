import { defineConfig } from "vite";

// Kehitystilassa /ws ja /api ohjataan paikalliselle LAN-palvelimelle (npm run server).
// Suhteelliset polut: sama build toimii LAN-hostin juuressa ja GitHub Pagesin alihakemistossa (/LanBall/).
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  server: {
    proxy: {
      "/ws": { target: "ws://localhost:8080", ws: true },
      "/api": "http://localhost:8080",
    },
  },
});
