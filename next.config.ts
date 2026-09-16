import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Defensive: Turbopack has been reported to mis-bundle @prisma/client's
  // generated native binaries in production builds (prisma/prisma#29025).
  // Next already auto-opts-out well-known packages, but pin it explicitly.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
