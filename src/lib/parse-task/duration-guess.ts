// How long a task usually takes, from its title's words, when the text
// names no duration: "Танцы" → 1 hour, "Визит к врачу" → 30 min, "Принять
// таблетки" → none. A guess only — the form shows it in the Duration
// field, where it's changed like any other value. Words are matched by
// their start (stems), so "тренировка", "тренировки" and "тренуватися"
// all count. The first group that matches wins: what you do (pay, call,
// buy) before what it's about (pills, a doctor), so "Купить таблетки" is
// shopping and "Оплатить страховку" a payment.

const START = "(?<![\\p{L}\\p{N}])";

type Guess = { minutes: number; stems: string[]; not?: string[] };

const GUESSES: Guess[] = [
  // Pay a bill, a loan, a subscription — 5 min.
  {
    minutes: 5,
    stems: ["pay", "оплат", "заплат", "погас", "сплат", "оплачу"],
  },
  // Call or write to someone — 5 min. Not writing a report or a text.
  {
    minutes: 5,
    stems: [
      "call",
      "phone",
      "text ",
      "message",
      "email",
      "write to",
      "позвон",
      "звон",
      "набрать",
      "написать",
      "напиши",
      "созвон",
      "подзвон",
      "зателефон",
      "телефон",
      "написати",
    ],
    not: [
      "отч[её]т",
      "звіт",
      "report",
      "стат",
      "article",
      "код",
      "code",
      "текст",
      "план",
      "резюме",
      "essay",
      "эссе",
      "есе",
      "диплом",
      "курсов",
    ],
  },
  // Papers: apply, renew a passport, visa, insurance — 15 min.
  {
    minutes: 15,
    stems: [
      "renew",
      "apply",
      "application",
      "passport",
      "visa",
      "insurance",
      "document",
      "tax(?:es)?(?![\\p{L}])",
      "подать",
      "подач",
      "продлить",
      "продлен",
      "заявлен",
      "паспорт",
      // Not "визит" (a visit): the visa's own forms.
      "виз(?:а|у|ы|е|ой)(?![\\p{L}])",
      "страхов",
      "документ",
      "налог",
      "подати",
      "продовж",
      "заяв",
      "віз(?:а|у|и|і|ою)(?![\\p{L}])",
      "податк",
    ],
  },
  // Shopping and chores — 1 hour.
  {
    minutes: 60,
    stems: [
      "buy",
      "shop",
      "groceries",
      "clean",
      "laundry",
      "wash",
      "cook",
      "iron",
      "vacuum",
      "купить",
      "закуп",
      "покуп",
      "магазин",
      "продукт",
      "убрать",
      "уборк",
      "помыть",
      "мыть",
      "стирк",
      "постир",
      "приготов",
      "готовить",
      "погладить",
      "пропылесос",
      "купити",
      "закупи",
      "прибрати",
      "прибиран",
      "помити",
      "прання",
      "випрати",
      "приготу",
      "готувати",
      "попрасувати",
    ],
  },
  // Pills, medicine, vitamins — no time of its own.
  {
    minutes: 0,
    stems: [
      "pill",
      "medicine",
      "meds",
      "vitamin",
      "tablet",
      "таблет",
      "лекарств",
      "витамин",
      "капл",
      "пигулк",
      "ліки",
      "ліків",
      "пігулк",
      "вітамін",
      "краплі",
    ],
  },
  // A doctor's visit — 30 min.
  {
    minutes: 30,
    stems: [
      "doctor",
      "dentist",
      "clinic",
      "physician",
      "gp ",
      "врач",
      "доктор",
      "стоматолог",
      "дантист",
      "терапевт",
      "поликлиник",
      "клиник",
      "лікар",
      "лікаря",
      "поліклінік",
      "клінік",
    ],
  },
  // A film — 2 hours.
  {
    minutes: 120,
    stems: ["movie", "cinema", "film", "кино", "фильм", "кіно", "фільм"],
  },
  // Dance, a workout, massage, a lesson, the pool — 1 hour.
  {
    minutes: 60,
    stems: [
      "dance",
      "dancing",
      "workout",
      "training",
      "gym",
      "massage",
      "lesson",
      "class",
      "pool",
      "swim",
      "yoga",
      "pilates",
      "fitness",
      "танц",
      "трениров",
      "тренаж",
      "спортзал",
      "массаж",
      "урок",
      "занят",
      "бассейн",
      "плаван",
      "йог",
      "пилатес",
      "фитнес",
      "тренуван",
      "масаж",
      "басейн",
      "плаванн",
      "пілатес",
      "фітнес",
    ],
  },
];

const PATTERNS = GUESSES.map(({ minutes, stems, not }) => ({
  minutes,
  match: new RegExp(`${START}(?:${stems.join("|")})`, "iu"),
  not: not ? new RegExp(`${START}(?:${not.join("|")})`, "iu") : null,
}));

/**
 * The usual length of a task titled `title`, in minutes, or undefined when
 * nothing in it says. 0 is a guess too: "no duration" (pills).
 */
export function guessDuration(title: string): number | undefined {
  const text = `${title} `;
  return PATTERNS.find(
    ({ match, not }) => match.test(text) && !(not && not.test(text)),
  )?.minutes;
}
