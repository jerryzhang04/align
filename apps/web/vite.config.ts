import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/v1": "http://127.0.0.1:8788",
    },
  },
  resolve: {
    alias: {
      "@align/metrics": resolve(root, "../../packages/metrics/src/index.ts"),
      "@align/contracts": resolve(root, "../../packages/contracts/src/index.ts"),
    },
  },
});
