# Sprint 5 — Recurrence: повторяющиеся задачи

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), раздел §19 «Sprint 5 — Recurrence», §2.7 «Повторяющиеся задачи», §2.8 (Task/TaskOccurrence), §8 «Background jobs», §15 правило 5 (timezone). Продолжение [sprint-4-tasks.md](./sprint-4-tasks.md) — Sprint 4 закрыт (PR [#4](https://github.com/Natalka-qa/Reminder-assistant/pull/4)), `main` в актуальном состоянии.

**Цель спринта:** пользователь может создать повторяющуюся задачу (ежедневно / по выбранным дням недели / ежемесячно), система генерирует `TaskOccurrence` на ближайшие 30 дней и сама продлевает это окно по мере приближения его конца — без ручного вмешательства.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит (все пять — `format:check` отдельно от остальных, см. урок Sprint 4).
- [ ] Новая миграция (снятие плейсхолдера с `recurrenceRule` не требует новой колонки — поле уже есть с Sprint 2; миграций для схемы в этом спринте не ожидается, если не понадобится что-то сверх плана).
- [ ] На `/tasks/new` можно выбрать Repeat: Does not repeat / Daily / Weekly (с чекбоксами дней недели) / Monthly.
- [ ] При сохранении повторяющейся задачи создаётся `Task` с `recurrenceRule` и пачка `TaskOccurrence` на ближайшие 30 дней от даты старта.
- [ ] Конфликты проверяются по **всем** генерируемым occurrence, не только по первой — диалог конфликта (Sprint 4) показывает все найденные пересечения сразу.
- [ ] `/dashboard`, `/tasks`, `/tasks/[id]` корректно показывают повторяющуюся задачу как несколько occurrences, а не только первую когда-либо созданную.
- [ ] Есть механизм, который продлевает 30-дневное окно вперёд по мере его истечения (background job / cron endpoint — см. §2 ниже), без действий пользователя.
- [ ] Деактивация задачи (`Deactivate`, Sprint 2) останавливает генерацию новых occurrences и отменяет ещё не наступившие `SCHEDULED` occurrences этой задачи.
- [ ] Слоистая архитектура не нарушена: Prisma-вызовы только в `*.repository.ts` (тот же grep, что в Sprint 1-4).

---

## 1. Стартовое состояние (что осталось от Sprint 2-4)

| Есть | Детали |
|---|---|
| `Task.recurrenceRule` | `String?` в схеме с Sprint 2 — заведено заранее «чтобы не мигрировать второй раз» (`sprint-2-tasks.md`, п.2), **нигде не используется**: `grep -rn "recurrenceRule" src` — 0 совпадений вне схемы/миграции |
| Поле «Repeat» в форме | `src/components/tasks/task-form.tsx` — disabled `&lt;Input name="repeat"&gt;`, значение принимается Zod-схемой (`repeat: z.string().optional()`) но **не читается** ни в `actions.ts`, ни в `task.service.ts` — форма отбрасывает его после валидации |
| «Одна задача = одна occurrence» | Явный контракт с Sprint 2 (`sprint-2-tasks.md`, п.3): `taskService.createTask` создаёт Task и ровно один `TaskOccurrence` в одной транзакции. Держится до этого спринта |
| 4 места, где код читает `occurrences[0]` как «единственную» occurrence | `task.service.ts:93-98,129-136` (апдейт даты/времени и conflict-exclude), `tasks/[id]/page.tsx:28`, `tasks/[id]/edit/page.tsx:25-26` (префилл формы), `tasks/page.tsx:43` (список задач) — все четыре нужно переработать под массив |
| `dashboardService` / `/dashboard` | Уже работают через `occurrenceRepository.find*` напрямую (не через `task.occurrences[0]`) — **готовы** к множественным occurrences без изменений |
| `occurrenceRepository` | `findByTaskId` уже возвращает отсортированный массив (`orderBy: scheduledStart asc`), `taskRepository.findByIdWithOccurrences`/`findActiveByUserId` уже `include` весь массив — проблема только в потребителях (`[0]`), не в репозитории |
| `conflictService.findConflicts` | Принимает **один** интервал `{start, end}` за вызов (Sprint 4) — для recurring-задачи нужно вызывать в цикле по каждой генерируемой дате, агрегируя результат в один список конфликтов (диалог уже поддерживает показ нескольких — доработки UI не нужны) |
| Background job / cron | **Отсутствует полностью** — `grep -rniE "cron\|inngest\|trigger\.dev\|worker"` даёт 0 совпадений, нет `vercel.json`, единственный существующий Route Handler — `api/auth/[...nextauth]`. Этот спринт заводит первый в проекте механизм фонового выполнения |
| `lib/date` | Есть `addDaysInZone` (DST-safe, добавлен именно с прицелом на recurrence — см. комментарий в ADR-002), **нет** аналога для месяцев |
| `src/features/recurrence/` | Пустая папка (`.gitkeep`) из ADR-001, ещё не занята |

### Расхождения плана / решения на этот спринт

1. **План (§11) отдаёт recurring generation `OccurrenceService`, ADR-001 резервирует отдельную папку `features/recurrence/`.** Решение: `features/recurrence/` — чистая логика без Prisma (тип правила, (де)сериализация, «какие даты порождает правило» — тестируется как `overlap.ts`/`occurrence-status.ts` в предыдущих спринтах); `scheduling/occurrence.service.ts` — оркестрация (создать `TaskOccurrence[]` из этих дат, прогнать через `conflictService`, записать в БД). Ничего не меняется в ADR — это уточнение, а не отход от него.
2. **`recurrenceRule` — сериализованный JSON, а не отдельная реляционная модель.** Три вида правил в MVP: `{ frequency: "DAILY" }`, `{ frequency: "WEEKLY", daysOfWeek: number[] }` (1=Пн…7=Вс, ISO), `{ frequency: "MONTHLY" }` (тот же день месяца, что и дата старта). План §2.7 «каждую неделю» и «выбранные дни недели» — по сути один и тот же случай (`WEEKLY`); «каждую неделю» без выбора дней = `daysOfWeek` из одного элемента — дня недели даты старта. Отдельного типа для этого не заводим.
3. **Окно генерации — константа 30 дней** (план §2.7: «создавать TaskOccurrence на ближайшие 30 дней», «не создавать occurrences на годы вперёд»). `RECURRENCE_WINDOW_DAYS = 30` в одном месте (`features/recurrence/`), используется и при создании, и при продлении.
4. **Background job = Vercel Cron + защищённый Route Handler**, не Inngest/Trigger.dev. План (§8) сам предлагает cron endpoint как вариант «для локального MVP»; Inngest/Trigger.dev — «для более надёжного варианта», явно не обязательны для этой версии. Добавление внешнего провайдера фоновых задач ради одной ежедневной операции — избыточно для соло-проекта на Vercel (см. `README.md` — деплой уже предполагается на Vercel). `vercel.json` с `crons`, endpoint защищён секретом (`CRON_SECRET`, сверяется с заголовком `Authorization`) — стандартный паттерн Vercel Cron.
5. **Редактирование расписания существующей recurring-задачи — вне охвата этого спринта.** `/tasks/[id]/edit` для recurring-задачи позволяет менять Title/Description/Duration/Priority/Flexibility, но **не** Date/Time/Repeat (эти поля показываются read-only с пояснением). Причина: смена anchor-даты или правила требует решить, что делать с уже сгенерированными future-occurrences (пересоздавать? мержить?) — план не описывает этот сценарий, а любое решение «на глаз» рискует потерять данные (snooze/статусы) без реальной необходимости в MVP. Пользователь, которому нужно поменять расписание, может деактивировать задачу и создать новую — приемлемо для этой версии. Non-recurring задачи редактируются как раньше, без изменений.
6. **Изменение `durationMinutes` у recurring-задачи каскадируется на все будущие `SCHEDULED` occurrences** (пересчёт `scheduledEnd`), поскольку `durationMinutes` разрешено менять (см. п.5) и разъезжающиеся длительности между occurrences одной задачи не должны возникать молча.
7. **Деактивация отменяет будущие occurrences, а не только останавливает генерацию.** План явно не описывает это для recurring-случая, но оставлять `SCHEDULED` occurrences у деактивированной задачи — рассинхронизация с `active: false` («задача не активна, но напоминания/пункты в dashboard всё равно приходят»). Прошедшие/завершённые occurrences не трогаем (история).
8. **Батч-проверка конфликтов — последовательные вызовы `conflictService.findConflicts` в цикле**, а не новый batch-SQL-метод. При максимум ~30 кандидатах (ежедневно на 30 дней — худший случай) это не проблема производительности в масштабе MVP; отдельный batch-query — преждевременная оптимизация.
9. **`/tasks/[id]` и `/tasks` показывают «ближайшую» occurrence, а не `occurrences[0]`.** «Ближайшая» = первая, что не завершена (`status === "SCHEDULED"`) и не в прошлом; если таких нет (все occurrences в прошлом или завершены) — последняя по времени. Это отдельная задача от собственно recurrence-генерации, но без неё recurring-задача в списке будет вечно показывать самую первую (уже прошедшую) occurrence.

---

## 2. Обзор задач

| ID | Задача | Backlog | Оценка | Зависит от |
|---|---|---|---|---|
| S5-01 | `features/recurrence/recurrence-rule.ts` — тип правила, (де)сериализация, Zod-схема | MVP-019 | 1.5 ч | — |
| S5-02 | `lib/date`: `addMonthsInZone` + тест | — | 1 ч | — |
| S5-03 | `features/recurrence/occurrence-dates.ts` — чистая функция генерации дат + тесты (DST, границы окна) | MVP-020 | 2.5 ч | S5-01, S5-02 |
| S5-04 | `occurrenceRepository`: `findMaxScheduledStartForTask`, `createMany` | MVP-020 | 1 ч | — |
| S5-05 | `OccurrenceService`: `createOccurrencesForTask` (первичная генерация + батч-конфликты), `cancelFutureOccurrences` | MVP-020 | 3 ч | S5-03, S5-04, conflict.service (Sprint 4) |
| S5-06 | `TaskService.createTask`: ветка recurring vs single occurrence | MVP-019, MVP-020 | 2 ч | S5-01, S5-05 |
| S5-07 | `TaskService`: `durationMinutes` каскад на future occurrences; `deactivateTask` отменяет future occurrences | — | 1.5 ч | S5-05 |
| S5-08 | `OccurrenceService.extendOccurrencesForAllActiveTasks` — продление окна | MVP-020 | 2 ч | S5-04, S5-05 |
| S5-09 | Cron endpoint `/api/cron/extend-occurrences` + `CRON_SECRET` + `vercel.json` | — | 1.5 ч | S5-08 |
| S5-10 | `lib/validation/task.ts`: заменить `repeat`-заглушку на структурированные поля | — | 1 ч | S5-01 |
| S5-11 | `task-form.tsx`: реальный Repeat UI (Select + чекбоксы дней недели) | MVP-019 | 2.5 ч | S5-10 |
| S5-12 | `actions.ts`: читать/передавать repeat-поля; read-only Date/Time/Repeat при редактировании recurring-задачи | — | 1.5 ч | S5-11 |
| S5-13 | `/tasks/[id]`, `/tasks`: «ближайшая occurrence» вместо `occurrences[0]`; `/tasks/[id]` показывает список upcoming occurrences | — | 2.5 ч | — |
| S5-14 | Тесты | — | включено в S5-02, S5-03 | — |

**Итого:** ≈ 23 ч.

**Критический путь:** S5-01/S5-02 → S5-03 → S5-04 → S5-05 → S5-06 → S5-10 → S5-11 → S5-12. S5-07, S5-08→S5-09, S5-13 параллелятся после S5-05/S5-06.

---

## 3. Задачи

### S5-01 · `recurrence-rule.ts` — тип и (де)сериализация

**Backlog:** MVP-019 · **Оценка:** 1.5 ч

**Что сделать**
- `src/features/recurrence/recurrence-rule.ts`:
  ```ts
  export type RecurrenceRule =
    | { frequency: "DAILY" }
    | { frequency: "WEEKLY"; daysOfWeek: number[] } // ISO: 1=Пн..7=Вс, непустой массив
    | { frequency: "MONTHLY" };

  export const recurrenceRuleSchema = z.discriminatedUnion("frequency", [
    z.object({ frequency: z.literal("DAILY") }),
    z.object({ frequency: z.literal("WEEKLY"), daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1) }),
    z.object({ frequency: z.literal("MONTHLY") }),
  ]);

  export function serializeRecurrenceRule(rule: RecurrenceRule | null): string | null {
    return rule ? JSON.stringify(rule) : null;
  }

  export function parseRecurrenceRule(raw: string | null): RecurrenceRule | null {
    if (!raw) return null;
    return recurrenceRuleSchema.parse(JSON.parse(raw));
  }

  export const RECURRENCE_WINDOW_DAYS = 30;
  ```

**Acceptance criteria**
- [ ] `parseRecurrenceRule(serializeRecurrenceRule(rule))` — round-trip равен исходному `rule` для всех трёх вариантов.
- [ ] `parseRecurrenceRule(null)` → `null` (не recurring задача).

---

### S5-02 · `lib/date`: `addMonthsInZone`

**Оценка:** 1 ч

**Что сделать**
- В `src/lib/date/index.ts`, по образцу `addDaysInZone`:
  ```ts
  export function addMonthsInZone(date: Date, months: number, zone: string): Date {
    return utcToZoned(date, zone).plus({ months }).toUTC().toJSDate();
  }
  ```
- Обновить шапку-комментарий модуля — добавить в список DST-safe помощников.

**Acceptance criteria**
- [ ] Тест: 31 января + 1 месяц в любой зоне — Luxon сам клампит к последнему дню месяца (28/29/30) без исключения; зафиксировать это поведение тестом, чтобы будущая замена библиотеки не сломала его тихо.

---

### S5-03 · `occurrence-dates.ts` — генерация дат по правилу

**Backlog:** MVP-020 · **Оценка:** 2.5 ч · **Зависит от:** S5-01, S5-02

**Что сделать**
- `src/features/recurrence/occurrence-dates.ts`:
  ```ts
  export function generateOccurrenceDates(
    rule: RecurrenceRule,
    anchorDate: string,   // YYYY-MM-DD — дата старта задачи
    fromDate: string,     // YYYY-MM-DD — начало окна генерации (включительно)
    toDate: string,       // YYYY-MM-DD — конец окна генерации (включительно)
    zone: string,
  ): string[] // YYYY-MM-DD, по возрастанию
  ```
  - `DAILY` — каждый календарный день от `max(anchorDate, fromDate)` до `toDate`, шаг через `addDaysInZone`.
  - `WEEKLY` — дни из `daysOfWeek`, пересекающие `[fromDate, toDate]`, не раньше `anchorDate`.
  - `MONTHLY` — день месяца = день месяца `anchorDate`, через `addMonthsInZone` от `anchorDate`, отфильтровать по окну.
  - Всегда через `lib/date`, никогда `+24h`/`new Date(...)` напрямую (инвариант §15 плана, ADR-002).

**Acceptance criteria**
- [ ] Тест DST: `WEEKLY` через переход на летнее/зимнее время в зоне с DST — количество и даты occurrences не сдвигаются на час/день.
- [ ] Тест границ: `fromDate`/`toDate` включительно; дата раньше `anchorDate` никогда не попадает в результат.
- [ ] Тест `MONTHLY` на 31-е число + месяц с 30/28 днями — не падает, не дублирует (см. S5-02).
- [ ] Тест: пустой результат, если окно `[fromDate, toDate]` целиком раньше `anchorDate`.

---

### S5-04 · `occurrenceRepository`: новые методы

**Backlog:** MVP-020 · **Оценка:** 1 ч

**Что сделать**
- `findMaxScheduledStartForTask(taskId, userId, db?)` → `db.taskOccurrence.aggregate({ where: { taskId, userId }, _max: { scheduledStart: true } })`, возвращает `Date | null` (нет occurrences — `null`).
- `createMany(data: Prisma.TaskOccurrenceUncheckedCreateInput[], db?)` → `db.taskOccurrence.createMany({ data })`.

**Acceptance criteria**
- [ ] `findMaxScheduledStartForTask` на задаче без occurrences — `null`, не исключение.

---

### S5-05 · `OccurrenceService`: генерация и отмена

**Backlog:** MVP-020 · **Оценка:** 3 ч · **Зависит от:** S5-03, S5-04, `conflictService` (Sprint 4)

**Что сделать**
- `createOccurrencesForTask(task, rule, { date, time, durationMinutes }, timezone, tx)`:
  1. `toDate = addDaysInZone(startOfDay(date), RECURRENCE_WINDOW_DAYS, timezone)`.
  2. `dates = generateOccurrenceDates(rule, date, date, toDate, timezone)`.
  3. Для каждой даты — вычислить `scheduledStart`/`scheduledEnd` (как в `createForTask`, S2-05), собрать кандидатов.
  4. Для каждого кандидата — `conflictService.findConflicts(userId, scheduledStart, scheduledEnd, undefined, tx)`; агрегировать все найденные конфликты в один `ScheduleConflict[]` (дубликаты по `occurrenceId` не схлопывать — план не требует, дубли маловероятны при разумных правилах).
  5. Если агрегированный список не пуст и `!confirmConflicts` — `throw new ScheduleConflictError(allConflicts)` (транзакция откатывается, ничего не создано — как в Sprint 4, но теперь для пачки).
  6. Иначе — `occurrenceRepository.createMany(candidates, tx)`.
- `cancelFutureOccurrences(taskId, userId, after, tx)` — `occurrenceRepository` обновляет все `status: SCHEDULED, scheduledStart > after` этой задачи на `CANCELLED` (использовать `db.taskOccurrence.updateMany`; при необходимости добавить `updateMany` в репозиторий рядом с `createMany`).

**Acceptance criteria**
- [ ] Создание `WEEKLY`-задачи (Пн/Ср/Пт) на 30 дней вперёд — в БД ровно столько occurrences, сколько таких дней попадает в окно (проверить подсчётом, не только «не падает»).
- [ ] Конфликт хотя бы с одним кандидатом из пачки — **ни один** occurrence пачки не создаётся (атомарность на уровне транзакции).

---

### S5-06 · `TaskService.createTask`: ветвление recurring/single

**Backlog:** MVP-019, MVP-020 · **Оценка:** 2 ч · **Зависит от:** S5-01, S5-05

**Что сделать**
- В `createTask`, после парсинга схемы (S5-10 добавляет поля правила в неё): собрать `RecurrenceRule | null` из `repeatFrequency`/`repeatDaysOfWeek`.
- `taskRepository.create(...)` — добавить `recurrenceRule: serializeRecurrenceRule(rule)`.
- Если `rule === null` — как сегодня, `occurrenceService.createForTask` (один occurrence, конфликт-проверка Sprint 4 без изменений).
- Если `rule !== null` — `occurrenceService.createOccurrencesForTask(task, rule, data, timezone, tx)` (S5-05) вместо `createForTask`.

**Acceptance criteria**
- [ ] `recurrenceRule: null` в БД для non-recurring задачи (не пустая строка, не `"null"`).

---

### S5-07 · Каскад `durationMinutes` и отмена при деактивации

**Оценка:** 1.5 ч · **Зависит от:** S5-05

**Что сделать**
- `updateTask`: если у задачи `recurrenceRule !== null` и `durationMinutes` изменился — обновить `scheduledEnd` у всех `SCHEDULED`-occurrences этой задачи с `scheduledStart` в будущем (`db.taskOccurrence.updateMany` с вычислением `scheduledEnd = scheduledStart + durationMinutes` на уровне приложения — Prisma не считает выражения в `updateMany`, поэтому читаем кандидатов, затем обновляем по одному в цикле внутри той же транзакции, либо `$executeRaw` — предпочесть цикл по кандидатам для консистентности со слоем репозитория, их не более ~30).
- `deactivateTask`: после `taskRepository.setActive(taskId, userId, false)` — вызвать `occurrenceService.cancelFutureOccurrences(taskId, userId, new Date())`.

**Acceptance criteria**
- [ ] Смена `durationMinutes` у recurring-задачи с 30 на 60 — все ещё не наступившие `SCHEDULED` occurrences получают новый `scheduledEnd`; прошедшие/завершённые не трогаются.
- [ ] `Deactivate` на recurring-задаче с occurrences и в прошлом, и в будущем — будущие `SCHEDULED` становятся `CANCELLED`, прошедшие (`DONE`/`SKIPPED`/т.д.) не меняются.

---

### S5-08 · Продление окна

**Backlog:** MVP-020 · **Оценка:** 2 ч · **Зависит от:** S5-04, S5-05

**Что сделать**
- `OccurrenceService.extendOccurrencesForAllActiveTasks(now, db?)`:
  1. Выбрать все `Task` с `active: true` и `recurrenceRule !== null` (новый метод `taskRepository.findActiveRecurring()`).
  2. Для каждой — `findMaxScheduledStartForTask`; если `max < now + RECURRENCE_WINDOW_DAYS` (окно почти истекло или уже) — сгенерировать `generateOccurrenceDates` от `max + 1 день` (или от `now`, если occurrences не было вовсе) до `now + RECURRENCE_WINDOW_DAYS`, создать через `createMany`.
  3. **Без конфликт-проверки при продлении** — конфликты проверяются один раз при создании/подтверждении задачи (Sprint 4 UX); фоновая экстенсия — не пользовательское действие, показать диалог некому. Пересечение, возникшее из-за продления существующей recurring-задачи и НОВОЙ задачи, созданной уже после неё, будет поймано conflict-проверкой той новой задачи (она видит уже существующие occurrences).

**Acceptance criteria**
- [ ] Вызов на recurring-задаче, у которой `max(scheduledStart)` уже на `RECURRENCE_WINDOW_DAYS` дней вперёд — no-op, новых occurrences не создаётся (идемпотентность при частом запуске).
- [ ] Вызов на деактивированной recurring-задаче — не продлевает (уже отфильтровано `active: true`).

---

### S5-09 · Cron endpoint

**Оценка:** 1.5 ч · **Зависит от:** S5-08

**Что сделать**
- `src/app/api/cron/extend-occurrences/route.ts`: `GET` — сверить заголовок `Authorization: Bearer ${process.env.CRON_SECRET}`, при несовпадении `401`; иначе вызвать `occurrenceService.extendOccurrencesForAllActiveTasks(new Date())`, вернуть `{ extended: <кол-во задач> }`.
- `vercel.json` в корне: `{ "crons": [{ "path": "/api/cron/extend-occurrences", "schedule": "0 3 * * *" }] }` (03:00 UTC ежедневно).
- `CRON_SECRET` — добавить в `.env.example` с комментарием, и в `.github/workflows/ci.yml` env-плейсхолдеры (по образцу `AUTH_SECRET`).

**Acceptance criteria**
- [ ] Запрос без корректного `Authorization` — `401`, `extendOccurrencesForAllActiveTasks` не вызывается.
- [ ] Локальный ручной вызов (`curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/extend-occurrences`) продлевает окно существующей recurring-задачи.

---

### S5-10 · `lib/validation/task.ts`: структурированные repeat-поля

**Оценка:** 1 ч · **Зависит от:** S5-01

**Что сделать**
- Заменить плейсхолдер:
  ```ts
  repeat: z.string().optional(),
  ```
  на:
  ```ts
  repeatFrequency: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional().default("NONE"),
  repeatDaysOfWeek: z.array(z.coerce.number().int().min(1).max(7)).optional().default([]),
  ```
- В `task.service.ts` (S5-06) — валидация «`WEEKLY` требует непустой `repeatDaysOfWeek`» через `.refine` на объекте схемы (не на отдельном поле, т.к. зависит от другого поля).

**Acceptance criteria**
- [ ] `repeatFrequency: "WEEKLY", repeatDaysOfWeek: []` — ошибка валидации, не проходит как «weekly без дней».

---

### S5-11 · `task-form.tsx`: реальный Repeat UI

**Backlog:** MVP-019 · **Оценка:** 2.5 ч · **Зависит от:** S5-10

**Что сделать**
- Убрать disabled-заглушку «Repeat». Добавить `Select` (`repeatFrequency`: Does not repeat / Daily / Weekly / Monthly) как controlled-поле (по образцу `priority`/`flexibility` после фикса Sprint 4 — **не** повторять баг с `defaultValue`, сразу `value`+`onValueChange`).
- При `repeatFrequency === "WEEKLY"` — показать 7 чекбоксов (Пн…Вс), каждый `name="repeatDaysOfWeek"` со своим `value`; собранные значения идут через `formData.getAll("repeatDaysOfWeek")` в `readTaskForm` (S5-12).
- Поле «Reminder» остаётся disabled-заглушкой (Sprint 6, не трогаем).

**Acceptance criteria**
- [ ] Переключение с `WEEKLY` на `DAILY`/`MONTHLY` скрывает чекбоксы дней недели и не мешает сабмиту (не оставляет невалидный `repeatDaysOfWeek` в форме).

---

### S5-12 · `actions.ts`: чтение repeat-полей, read-only при редактировании recurring

**Оценка:** 1.5 ч · **Зависит от:** S5-11

**Что сделать**
- `readTaskForm`: `repeatFrequency: formData.get("repeatFrequency")`, `repeatDaysOfWeek: formData.getAll("repeatDaysOfWeek")`.
- `/tasks/[id]/edit/page.tsx`: если `task.recurrenceRule !== null` — передать в `TaskForm` флаг (например `scheduleLocked: true`), при котором Date/Time/Repeat рендерятся как read-only (текст вместо инпутов) с пояснением «Recurring task — schedule can't be edited yet. Deactivate and recreate to change it.» (см. «Расхождения» п.5). Non-recurring — без изменений.

**Acceptance criteria**
- [ ] Попытка отправить `date`/`time`/`repeatFrequency` для recurring-задачи через отредактированный `FormData` (минуя UI) — сервис игнорирует эти поля для recurring-задачи, не пересоздаёт occurrences (защита не только на UI, как и всегда в этом проекте).

---

### S5-13 · Списки/детали: «ближайшая occurrence» вместо `[0]`

**Оценка:** 2.5 ч

**Что сделать**
- Новый метод `taskRepository` или чистая функция-хелпер `pickCurrentOccurrence(occurrences: TaskOccurrence[]): TaskOccurrence | undefined` — первая `SCHEDULED` с `scheduledStart >= now`, иначе последняя по времени. Использовать в `tasks/page.tsx:43` и `tasks/[id]/edit/page.tsx:25-26`.
- `/tasks/[id]/page.tsx` — вместо одной карточки «Scheduled» показать список: ближайшие N (например 10) `SCHEDULED`-occurrences с датой/временем и теми же `OccurrenceActions`, что уже есть (Sprint 3), плюс отдельно последние завершённые/пропущенные (свернуто или под чертой) — соответствует плану §16 «upcoming occurrences» (множественное число, уже заложено в исходном плане до этого спринта).

**Acceptance criteria**
- [ ] Recurring-задача с прошедшей и тремя будущими occurrences — `/tasks` показывает ближайшую будущую, не прошедшую.
- [ ] `/tasks/[id]` показывает все будущие `SCHEDULED` occurrences этой задачи, действие Done/Partial/Skip на одной не влияет на остальные.

---

## 4. Не входит в Sprint 5

Сознательно откладываем: изменение расписания (Date/Time/Repeat) уже существующей recurring-задачи (п.5 «Расхождения» — deactivate+recreate как обходной путь); notifications/snooze (Sprint 6, `SNOOZED`-статус по-прежнему не используется); completion rate/7-дневная статистика (Sprint 7); дедупликация конфликтов при батч-проверке, если одна и та же существующая occurrence пересекается с несколькими кандидатами пачки (список просто покажет её несколько раз — косметическая проблема, не блокирующая); alternative background-job провайдеры (Inngest/Trigger.dev) — Vercel Cron достаточно для этого масштаба; редактирование/удаление одной конкретной occurrence recurring-задачи отдельно от остальных (кроме уже существующих Done/Partial/Skip).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| `MONTHLY` на 29/30/31 число в короткие месяцы — неоднозначное поведение библиотеки | Пропуски или дублирование occurrences в отдельные месяцы | Зафиксировать реальное поведение Luxon тестом (S5-02) вместо предположений; если поведение окажется неприемлемым (например «скачок» на следующий месяц вместо клампа) — заменить на явный кламп к последнему дню месяца в `addMonthsInZone` |
| Vercel Cron не запускается в бесплатном плане чаще 1 раза в день / есть задержки | Окно продлевается реже, чем рассчитано, но не ломается — просто догоняет при следующем запуске | `extendOccurrencesForAllActiveTasks` идемпотентен и досоздаёт недостающее целиком за один вызов, не полагается на точную частоту запуска |
| Батч-конфликт-проверка последовательными запросами (до 30 на сохранение) — медленнее одного запроса | Дольше отклик при сохранении recurring-задачи с ежедневным повтором | Приемлемо для MVP-масштаба (локальная Postgres, один пользователь за раз); оптимизация — не в этом спринте (см. «Расхождения» п.8) |
| Read-only Date/Time/Repeat при редактировании — пользователь ожидает полноценный edit | UX-неожиданность | Явно показать причину в UI (текст-пояснение, не просто disabled без объяснения), задокументировано в «Расхождения» п.5 как сознательное сужение |

---

## 6. Предлагаемый порядок работы

| День | Задачи |
|---|---|
| 1 | S5-01, S5-02, S5-03 |
| 2 | S5-04, S5-05, S5-06 |
| 3 | S5-07, S5-08, S5-09 |
| 4 | S5-10, S5-11, S5-12 |
| 5 | S5-13, прогон Sprint DoD |
