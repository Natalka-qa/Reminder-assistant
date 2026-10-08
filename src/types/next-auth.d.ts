import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      timezone: string;
      /** The first-run setup was finished or skipped (User.onboardedAt). */
      onboarded: boolean;
      /** sprint-23-tasks.md S23-03 — Settings → Appearance. */
      theme: "SYSTEM" | "LIGHT" | "DARK";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    timezone: string;
    onboardedAt?: Date | null;
    theme?: "SYSTEM" | "LIGHT" | "DARK";
  }
}
