// /onboarding step 3 and the empty Home — a few sentences that show what
// New task picks up, in the language the browser asks for (the app itself
// is in English). Each opens New task with the sentence typed in.

export type ExampleLanguage = "en" | "ru" | "uk";

export type TaskExample = { kind: string; text: string };

const EXAMPLES: Record<ExampleLanguage, TaskExample[]> = {
  en: [
    { kind: "A task", text: "Call mom tomorrow at 18" },
    { kind: "Every week", text: "Dance every Wed at 19 and Fri at 20" },
    { kind: "A course", text: "Pills twice a day for a month" },
    { kind: "By a time", text: "Send the report by 12" },
  ],
  ru: [
    { kind: "A task", text: "Позвонить маме завтра в 18" },
    { kind: "Every week", text: "Танцы по средам в 19 и пятницам в 20" },
    {
      kind: "A course",
      text: "Таблетки 2 раза в день утром и вечером на месяц",
    },
    { kind: "By a time", text: "Сдать отчёт до 12" },
  ],
  uk: [
    { kind: "A task", text: "Зателефонувати мамі завтра о 18" },
    { kind: "Every week", text: "Танці по середах о 19 та пʼятницях о 20" },
    { kind: "A course", text: "Ліки вранці та ввечері протягом 2 тижнів" },
    { kind: "By a time", text: "Здати звіт до 12" },
  ],
};

/**
 * The browser's first language among ours, from an Accept-Language header
 * ("uk-UA,uk;q=0.9,en;q=0.8" → uk); English otherwise.
 */
export function exampleLanguage(
  acceptLanguage: string | null | undefined,
): ExampleLanguage {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === "en" || code === "ru" || code === "uk") return code;
  }
  return "en";
}

export function taskExamples(language: ExampleLanguage): TaskExample[] {
  return EXAMPLES[language];
}

/** New task with the sentence already typed in. */
export function newTaskHref(text: string): string {
  return `/tasks/new?text=${encodeURIComponent(text)}`;
}
