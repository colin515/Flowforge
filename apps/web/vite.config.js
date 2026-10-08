import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173, strictPort: true },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        marketplace: resolve(import.meta.dirname, "marketplace/index.html"),
      },
    },
  },
});
