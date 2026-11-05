import { describe, expect, it } from "vitest";
import {
  checklistInputSchema,
  checklistItemInputSchema,
} from "@/lib/validation/checklist";
import { CHECKLIST_TEMPLATES, findTemplate } from "./checklist-templates";

describe("CHECKLIST_TEMPLATES", () => {
  it("has the nine templates of решение 6, keys unique", () => {
    expect(CHECKLIST_TEMPLATES).toHaveLength(9);
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

  it("turns an empty note into none", () => {
    expect(checklistItemInputSchema.parse({ text: "Milk", note: " " })).toEqual(
      { text: "Milk", note: null },
    );
  });
});
