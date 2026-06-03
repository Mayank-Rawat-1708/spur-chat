import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      "/chat": { target: "http://localhost:3001", changeOrigin: true },
      "/health": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
