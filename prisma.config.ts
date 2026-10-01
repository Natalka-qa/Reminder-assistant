import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { directDatabaseUrl } from "./src/lib/db/direct-url";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    // Migrations bypass the pooler — see direct-url.ts.
    directUrl: directDatabaseUrl(
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_UNPOOLED,
    ),
  },
});
