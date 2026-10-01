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
  // Only the Prisma CLI (migrate, status, studio) reads this; the app's
  // client keeps schema.prisma's pooled DATABASE_URL. The CLI goes straight
  // to Postgres, past the pooler — see direct-url.ts. As `url`, not
  // `directUrl`: with the classic engine a config `directUrl` is only
  // printed, while the lock is still taken over `url` (checked on the dev
  // branch, 2026-10-01).
  datasource: {
    url:
      directDatabaseUrl(
        env("DATABASE_URL"),
        process.env.DATABASE_URL_UNPOOLED,
      ) ?? env("DATABASE_URL"),
  },
});
