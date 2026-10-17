import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Defensive: Turbopack has been reported to mis-bundle @prisma/client's
  // generated native binaries in production builds (prisma/prisma#29025).
  // Next already auto-opts-out well-known packages, but pin it explicitly.
  // sprint-24-tasks.md решение 13 — tesseract.js loads its worker script
  // and WebAssembly core from its own folders at run time: kept out of the
  // bundle, and traced into the webhook's function explicitly.
  serverExternalPackages: ["@prisma/client", "tesseract.js"],
  outputFileTracingIncludes: {
    // The worker runs in its own thread and requires these itself, so the
    // trace never sees them: tesseract.js's whole dependency tree (a
    // missing one left the worker dead and the bot waiting, 2026-10-17).
    "/api/telegram/webhook": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/idb-keyval/**/*",
      "./node_modules/is-electron/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/tr46/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/webidl-conversions/**/*",
      "./node_modules/whatwg-url/**/*",
      "./node_modules/zlibjs/**/*",
    ],
  },
};

export default nextConfig;
