import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/web",
  publicDir: "../../public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/web"),
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  define: {
    // Polyfills for Solana wallet adapter
    "process.env": {},
    global: "globalThis",
  },
});
