// sprint-25-tasks.md решение 6 — what a new list can start from: a name,
// an icon and a few starter items the user can delete.

export type ChecklistTemplate = {
  key: string;
  title: string;
  icon: string;
  items: { text: string; note?: string }[];
};

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplate[] = [
  {
    key: "groceries",
    title: "Groceries",
    icon: "🛒",
    items: [{ text: "Milk" }, { text: "Bread" }, { text: "Eggs" }],
  },
  {
    key: "packing",
    title: "Packing",
    icon: "🧳",
    items: [
      { text: "Passport" },
      { text: "Phone charger" },
      { text: "Medicines" },
      { text: "Toothbrush" },
    ],
  },
  {
    key: "workout",
    title: "Workout",
    icon: "🏋️",
    items: [
      { text: "Warm-up", note: "5 min" },
      { text: "Squats", note: "3×12" },
      { text: "Plank", note: "1 min" },
    ],
  },
  {
    key: "medicine",
    title: "Medicine",
    icon: "💊",
    items: [{ text: "Painkillers" }, { text: "Plasters" }],
  },
  {
    key: "cleaning",
    title: "Cleaning",
    icon: "🏠",
    items: [
      { text: "Kitchen" },
      { text: "Bathroom" },
      { text: "Vacuum" },
      { text: "Laundry" },
    ],
  },
  { key: "gifts", title: "Gifts", icon: "🎁", items: [] },
  { key: "to-read", title: "To read & watch", icon: "📚", items: [] },
  {
    key: "appointment",
    title: "Questions for the appointment",
    icon: "📝",
    items: [],
  },
  { key: "empty", title: "", icon: "📝", items: [] },
];

export function findTemplate(key: string): ChecklistTemplate | undefined {
  return CHECKLIST_TEMPLATES.find((template) => template.key === key);
}
