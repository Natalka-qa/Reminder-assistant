import { describe, expect, it } from "vitest";
import { displayName } from "./display-name";

describe("displayName", () => {
  it("uses the name when there is one", () => {
    expect(displayName("  Nata ", "natalia@x.com")).toBe("Nata");
  });

  it("takes the first word of the email otherwise", () => {
    expect(displayName(null, "natalia.cherniavska@lanars.com")).toBe("Natalia");
    expect(displayName("", "OLGA_K@x.com")).toBe("Olga");
    expect(displayName("   ", "ivan-petrov+work@x.com")).toBe("Ivan");
    expect(displayName(null, "марія@x.ua")).toBe("Марія");
    expect(displayName(null, "anna2024@x.com")).toBe("Anna");
  });

  it("says no name rather than something odd", () => {
    expect(displayName(null, "x@x.com")).toBeNull();
    expect(displayName(null, "123@x.com")).toBeNull();
    expect(displayName(null, "jd77@x.com")).toBe("Jd");
    expect(displayName(null, null)).toBeNull();
  });
});
