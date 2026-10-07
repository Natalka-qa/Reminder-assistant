import { describe, expect, it } from "vitest";
import { parseTaskText, readTaskParts } from "@/lib/parse-task/course";
import {
  exampleLanguage,
  newTaskHref,
  taskExamples,
  type ExampleLanguage,
} from "./examples";

const TODAY = "2026-10-06";

describe("exampleLanguage", () => {
  it("takes the browser's first language among ours", () => {
    expect(exampleLanguage("uk-UA,uk;q=0.9,en;q=0.8")).toBe("uk");
    expect(exampleLanguage("ru-RU,ru;q=0.9")).toBe("ru");
    expect(exampleLanguage("de-DE,ru;q=0.5")).toBe("ru");
    expect(exampleLanguage("de-DE")).toBe("en");
    expect(exampleLanguage(null)).toBe("en");
  });
});

describe("the examples read as they promise", () => {
  it.each<ExampleLanguage>(["en", "ru", "uk"])("%s", (language) => {
    const [task, weekly, course, deadline] = taskExamples(language);
    expect(parseTaskText(task.text, TODAY)).toMatchObject({
      date: "2026-10-07",
      time: "18:00",
    });
    expect(
      readTaskParts(weekly.text, TODAY)?.map((part) => [
        part.repeatDays,
        part.time,
      ]),
    ).toEqual([
      [[3], "19:00"],
      [[5], "20:00"],
    ]);
    expect(readTaskParts(course.text, TODAY)?.map((part) => part.time)).toEqual(
      ["09:00", "20:00"],
    );
    expect(parseTaskText(deadline.text, TODAY).due).toBe("12:00");
  });
});

it("opens New task with the sentence typed in", () => {
  expect(newTaskHref("Сдать отчёт до 12")).toBe(
    "/tasks/new?text=%D0%A1%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BE%D1%82%D1%87%D1%91%D1%82%20%D0%B4%D0%BE%2012",
  );
});
