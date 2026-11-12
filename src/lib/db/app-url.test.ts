import { describe, expect, it } from "vitest";
import { appDatabaseUrl } from "./app-url";

describe("appDatabaseUrl", () => {
  const base =
    "postgresql://u:p@ep-x-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  it("gives the connection 20 s to wake the database", () => {
    const url = new URL(appDatabaseUrl(base)!);
    expect(url.searchParams.get("connect_timeout")).toBe("20");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.username).toBe("u");
    expect(url.hostname).toBe("ep-x-pooler.c-5.eu-central-1.aws.neon.tech");
  });

  it("keeps values already set, and no URL stays none", () => {
    const url = new URL(appDatabaseUrl(`${base}&connect_timeout=30`)!);
    expect(url.searchParams.get("connect_timeout")).toBe("30");
    expect(appDatabaseUrl(undefined)).toBeUndefined();
  });
});
