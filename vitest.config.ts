import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/web"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        // Web tests - React components with jsdom
        extends: true, // Inherit plugins and resolve from root
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./src/web/test/setup.ts"],
          include: ["src/web/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        // API tests - Node.js environment
        test: {
          name: "api",
          environment: "node",
          include: ["src/api/**/*.{test,spec}.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/web/test/"],
    },
  },
});
