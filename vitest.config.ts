import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors tsconfig's `"@/*": ["./src/*"]`. Type-only `@/` imports are
    // erased before vitest sees them, so tests got by without this until
    // one imported a module that pulls in a runtime `@/` import.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
