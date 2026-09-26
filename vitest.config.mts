import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirrors the "@/*" path alias from tsconfig.json so modules that use it can be tested.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { exclude: ["node_modules/**", ".next/**", ".pnpm-store/**", "generated/**"] },
});
