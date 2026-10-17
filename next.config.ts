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
    "/api/telegram/webhook": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;
