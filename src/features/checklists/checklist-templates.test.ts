import { describe, expect, it } from "vitest";
import {
  checklistInputSchema,
  checklistItemInputSchema,
} from "@/lib/validation/checklist";
import { CHECKLIST_TEMPLATES, findTemplate } from "./checklist-templates";

describe("CHECKLIST_TEMPLATES", () => {
  it("has the nine templates of решение 6 and Lab tests (S26-12), keys unique", () => {
    expect(CHECKLIST_TEMPLATES).toHaveLength(10);
    const keys = CHECKLIST_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only valid names, icons and items", () => {
    for (const template of CHECKLIST_TEMPLATES) {
      if (template.key !== "empty") {
        expect(
          checklistInputSchema.safeParse({
            title: template.title,
            icon: template.icon,
          }).success,
        ).toBe(true);
      }
      for (const item of template.items) {
        expect(checklistItemInputSchema.safeParse(item).success).toBe(true);
      }
    }
  });

  it("finds one by key", () => {
    expect(findTemplate("groceries")?.icon).toBe("🛒");
    expect(findTemplate("nope")).toBeUndefined();
  });
});

describe("checklist validation", () => {
  it("needs a name and defaults the icon", () => {
    expect(checklistInputSchema.safeParse({ title: "  " }).success).toBe(false);
    expect(checklistInputSchema.parse({ title: " Groceries " })).toEqual({
      title: "Groceries",
      icon: "📝",
    });
  });

  // sprint-26-tasks.md S26-12
  it("takes a link and a typed price", () => {
    expect(
      checklistItemInputSchema.parse({
        text: "Lego",
        url: "amazon.es/lego",
        priceCents: "49,99",
      }),
    ).toMatchObject({ url: "https://amazon.es/lego", priceCents: 4999 });
    expect(
      checklistItemInputSchema.safeParse({ text: "Lego", priceCents: "abc" })
        .error?.issues[0].message,
    ).toBe("Price like 49.99.");
    expect(
      checklistItemInputSchema.safeParse({ text: "Lego", url: "not a link" })
        .success,
    ).toBe(false);
  });

  it("turns an empty note into none", () => {
    expect(checklistItemInputSchema.parse({ text: "Milk", note: " " })).toEqual(
      { text: "Milk", note: null, url: null, priceCents: null },
    );
  });
});
