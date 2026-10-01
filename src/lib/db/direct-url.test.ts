import { describe, expect, it } from "vitest";
import { directDatabaseUrl } from "./direct-url";

const POOLED =
  "postgresql://user:p%40ss@ep-jolly-star-b1qdsqau-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

describe("directDatabaseUrl", () => {
  it("drops -pooler from a Neon host, keeping everything else", () => {
    expect(directDatabaseUrl(POOLED, undefined)).toBe(
      "postgresql://user:p%40ss@ep-jolly-star-b1qdsqau.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
  });

  it("prefers DATABASE_URL_UNPOOLED when it's set", () => {
    expect(directDatabaseUrl(POOLED, "postgresql://direct/db")).toBe(
      "postgresql://direct/db",
    );
  });

  it("leaves a URL that isn't pooled as it is", () => {
    const local = "postgresql://user:pw@localhost:5432/reminder";
    expect(directDatabaseUrl(local, undefined)).toBe(local);
  });

  it("only looks at the endpoint name, not the rest of the host", () => {
    const odd = "postgresql://u:p@ep-x.c-5-pooler.example.com/db";
    expect(directDatabaseUrl(odd, undefined)).toBe(odd);
  });

  it("is undefined with no URL at all", () => {
    expect(directDatabaseUrl(undefined, undefined)).toBeUndefined();
  });
});
