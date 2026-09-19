import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Vitest runs under plain Node, not Next's "react-server" bundler
      // condition, so the package's default export (a throwing stub meant to
      // catch client-component imports) fires on every import. Alias to its
      // own no-op build — the same file Next resolves to under that
      // condition — so server-only modules stay importable in tests.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
