import { describe, expect, it } from "vitest";
import { nameSchema, onboardingNextPath, timezoneSchema } from "./user";

describe("nameSchema", () => {
  it("trims, and an empty name is none", () => {
    expect(nameSchema.parse("  Anna ")).toBe("Anna");
    expect(nameSchema.parse("   ")).toBeNull();
    expect(nameSchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});

describe("onboardingNextPath", () => {
  it("only goes to a page of this app", () => {
    expect(onboardingNextPath("/tasks/new?text=Call%20mom")).toBe(
      "/tasks/new?text=Call%20mom",
    );
    expect(onboardingNextPath("https://evil.example")).toBe("/dashboard");
    expect(onboardingNextPath("//evil.example")).toBe("/dashboard");
    expect(onboardingNextPath("/\\evil.example")).toBe("/dashboard");
    expect(onboardingNextPath(null)).toBe("/dashboard");
  });
});

describe("timezoneSchema", () => {
  it("takes a zone under either of its names, stored as the listed one", () => {
    const listed = Intl.supportedValuesOf("timeZone");
    const kyiv = timezoneSchema.parse("Europe/Kyiv");
    expect(listed).toContain(kyiv);
    expect(timezoneSchema.parse("Europe/Kiev")).toBe(kyiv);
    expect(timezoneSchema.parse("Europe/Madrid")).toBe("Europe/Madrid");
    expect(timezoneSchema.safeParse("Mars/Olympus").success).toBe(false);
  });
});
