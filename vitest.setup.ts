import { config } from "dotenv";

// Mirrors prisma.config.ts: fills process.env from .env.local for local runs.
// In CI the real env vars are already set at the job level, and dotenv's
// config() never overrides an existing process.env value, so this is a
// no-op there.
config({ path: ".env.local" });
