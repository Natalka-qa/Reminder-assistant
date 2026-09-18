# Sprint 4 — Conflicts: обнаружение пересечений

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), раздел §19 «Sprint 4 — Conflicts», §12 «ConflictService», сценарий §2.6 и Scenario 2 (§5). Продолжение [sprint-3-tasks.md](./sprint-3-tasks.md) — Sprint 3 закрыт (PR [#2](https://github.com/Natalka-qa/Reminder-assistant/pull/2)), но смержен по ошибке в `sprint-2-tasks`, а не в `main`; `main` довезён до Sprint 3 отдельным PR [#3](https://github.com/Natalka-qa/Reminder-assistant/pull/3) перед стартом этого спринта.

**Цель спринта:** при создании или редактировании задачи приложение ищет пересечения по времени с уже существующими задачами пользователя и предупреждает об этом диалогом, прежде чем сохранить — пользователь может изменить время или сохранить несмотря на конфликт.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` зелёные; CI на PR проходит.
- [ ] Миграций не требуется — `Task.priority`/`Task.flexibility`/`Task.durationMinutes` уже в схеме с Sprint 2.
- [ ] Создание задачи, пересекающейся по времени с существующей `SCHEDULED`-occurrence того же пользователя, показывает диалог конфликта вместо немедленного сохранения.
- [ ] Диалог показывает каждую пересекающуюся задачу: название, время, priority, flexibility.
- [ ] Пользователь может закрыть диалог и поменять время ИЛИ подтвердить «Создать всё равно» — тогда задача сохраняется без повторной проверки на то же время.
- [ ] Редактирование задачи (`/tasks/[id]/edit`) проверяется на конфликт так же, как создание, но не конфликтует само с собой (occurrence, который редактируется, исключён из поиска).
- [ ] Задачи, не пересекающиеся по времени, сохраняются как раньше — без диалога, без лишнего запроса в UI.
- [ ] Слоистая архитектура не нарушена: Prisma-вызовы только в `*.repository.ts` (тот же grep, что в Sprint 1-3).

---

## 1. Стартовое состояние (что осталось от Sprint 2-3)

| Есть | Детали |
|---|---|
| `Task.durationMinutes` / `priority` / `flexibility` | В схеме и форме с Sprint 2 (`S2-01`, `S2-03`, `S2-11`) — **не** новые поля этого спринта, вопреки терминологии в §19 плана (см. «Расхождения» ниже) |
| `task-form.tsx` | Title/Description/Date/Time/Duration/Priority/Flexibility — живые поля; Repeat/Reminder — disabled-заглушки |
| `occurrence.repository.findForUserBetween` | Фильтрует только по `scheduledStart` (`gte/lte`) — **не** реализует пересечение интервалов, нужен новый метод |
| `occurrenceService.createForTask` | Считает `scheduledStart`/`scheduledEnd` через `zonedDateTimeToUtc` + `addMinutes`; `durationMinutes = 0` даёт `scheduledEnd === scheduledStart`, не `null` |
| `taskService.createTask` / `updateTask` | Одна транзакция на создание/обновление Task + (ровно один) TaskOccurrence; конфликтов не ищут |
| `AlertDialog` (`src/components/ui/alert-dialog.tsx`) | Base UI-обёртка, уже используется для подтверждения удаления (`task-actions.tsx`) — переиспользуем, отдельный `Dialog`-компонент не нужен |
| `TaskActionState` (`actions.ts`) | `{ status: "idle" \| "success" \| "error"; message? }`, `useActionState` в `task-form.tsx` — нужно расширить статусом `"conflict"` |
| Конфликт-код | Отсутствует полностью — `grep -rniE "conflict\|overlap" src/` даёт 0 совпадений |

### Расхождения плана / решения на этот спринт

1. **`duration`, `priority`, `flexibility` из §19 — уже сделаны в Sprint 2.** Терсовая формулировка плана «duration, overlap query, conflict dialog, fixed/flexible, priority» — это ранний черновик до разбивки по спринтам; фактически из этого списка не хватает только overlap query и conflict dialog. Этот спринт покрывает именно их; `priority`/`flexibility` используются только как информация в диалоге, а не как новые поля.
2. **Два действия в диалоге, а не три.** План (§5) описывает «Изменить время / Создать всё равно / Отмена». В нашем UI (одна страница-форма, не модальная навигация) «Изменить время» и «Отмена» физически делают одно и то же — закрывают диалог, ничего не отправляя, значения формы остаются как есть. Оставляем два действия: **Edit time** (закрыть, значения не теряются) и **Create anyway** (досоздать с подтверждением). Отдельной кнопки Cancel не вводим — закрытие диалога (Escape/оверлей/Edit time) уже покрывает этот сценарий.
3. **Автоматический перенос не делаем** — совпадает с планом (§2.6: «для первой версии автоматический перенос не нужен»). `priority`/`flexibility` пересекающейся задачи только отображаются в диалоге, не блокируют и не выбирают действие автоматически (даже `FIXED` + `FIXED` не блокирует сохранение — решение остаётся за пользователем).
4. **Проверяем только `SCHEDULED`-occurrences.** Occurrence в статусе `DONE`/`PARTIALLY_DONE`/`SKIPPED`/`CANCELLED` больше не занимает время — не считается конфликтом. `SNOOZED` не используется до Sprint 6, но на всякий случай тоже не считается активным конфликтом.
5. **Recurring-задачи вне охвата.** Пока `Task` = ровно один `TaskOccurrence` (до Sprint 5), проверка конфликта — это проверка ровно одного интервала на пересечение с другими occurrences пользователя. Множественные occurrences одной recurring-задачи — Sprint 5.
6. **Повторный конфликт-запрос на подтверждённое сохранение не делаем.** Как только пользователь нажал «Create anyway», hidden-поле `confirmConflicts` уходит в сервер как `true`, и `TaskService` пропускает проверку для этого сабмита. Если после этого пользователь меняет любое поле формы и отправляет снова, флаг сбрасывается на `false` (иначе случайно изменённое время задачи молча проскочит мимо проверки).

---

## 2. Обзор задач

| ID | Задача | Backlog | Оценка | Зависит от |
|---|---|---|---|---|
| S4-01 | `scheduling/overlap.ts`: чистая функция `hasOverlap` + тест | MVP-017 | 1 ч | — |
| S4-02 | `occurrence.repository.ts`: `findOverlapping` | MVP-017 | 1 ч | — |
| S4-03 | `scheduling/conflict.errors.ts`: `ScheduleConflictError` | — | 0.5 ч | — |
| S4-04 | `scheduling/conflict.service.ts`: `findConflicts` | MVP-017 | 1.5 ч | S4-01, S4-02, S4-03 |
| S4-05 | `lib/validation/task.ts`: поле `confirmConflicts` | — | 0.5 ч | — |
| S4-06 | `TaskService`: подключить проверку конфликтов в `createTask`/`updateTask` | MVP-017 | 2 ч | S4-04, S4-05 |
| S4-07 | `actions.ts`: статус `"conflict"` в `TaskActionState` | MVP-018 | 1.5 ч | S4-06 |
| S4-08 | `task-form.tsx`: диалог конфликта + пересабмит с подтверждением | MVP-018 | 3 ч | S4-07 |
| S4-09 | Тесты | — | включено в S4-01 | S4-01 |

**Итого:** ≈ 11 ч.

**Критический путь:** S4-01/S4-02/S4-03 → S4-04 → S4-05 → S4-06 → S4-07 → S4-08.

---

## 3. Задачи

### S4-01 · `scheduling/overlap.ts` — чистая функция пересечения

**Backlog:** MVP-017 · **Оценка:** 1 ч

**Что сделать**
- `src/features/scheduling/overlap.ts`: `hasOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean` — ровно формула §2.6: `aStart < bEnd && bStart < aEnd`. Без Prisma/БД — как `occurrence-status.ts` в Sprint 3, единственный способ покрыть интервальную математику тестом без мока БД.
- В комментарии отметить, что SQL-запрос в `occurrence.repository.findOverlapping` (S4-02) обязан выражать ту же самую формулу — держать их в синхроне, если формула когда-нибудь изменится.

**Acceptance criteria**
- [ ] Тест: полное пересечение, частичное пересечение с двух сторон, вложенный интервал → `true`.
- [ ] Тест: интервалы, касающиеся ровно границей (`aEnd === bStart`) → `false` (строгое неравенство, не `<=`).
- [ ] Тест: два нулевой-длительности occurrence в одну и ту же секунду → `false` (пустой интервал ни с чем не пересекается, включая другой пустой интервал в то же время).

---

### S4-02 · `occurrence.repository.ts`: `findOverlapping`

**Backlog:** MVP-017 · **Оценка:** 1 ч

**Что сделать**
- Добавить `findOverlapping(userId: string, start: Date, end: Date, excludeOccurrenceId?: string, db: Db = prisma)`:
  ```ts
  findOverlapping(
    userId: string,
    start: Date,
    end: Date,
    excludeOccurrenceId?: string,
    db: Db = prisma,
  ) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        status: "SCHEDULED",
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        ...(excludeOccurrenceId ? { id: { not: excludeOccurrenceId } } : {}),
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  }
  ```
- `status: "SCHEDULED"` — см. «Расхождения» п.4. `excludeOccurrenceId` — для режима редактирования (S4-06), чтобы occurrence не конфликтовал сам с собой.

**Acceptance criteria**
- [ ] Запрос с чужим `userId` не возвращает чужие occurrences (как и остальные методы репозитория).
- [ ] `excludeOccurrenceId` исключает переданный id из результата, даже если его время пересекается с самим собой.

---

### S4-03 · `scheduling/conflict.errors.ts`

**Оценка:** 0.5 ч

**Что сделать**
- По образцу `task.errors.ts`/`occurrence.errors.ts`:
  ```ts
  import type { ScheduleConflict } from "@/features/scheduling/conflict.service";

  export class ScheduleConflictError extends Error {
    conflicts: ScheduleConflict[];

    constructor(conflicts: ScheduleConflict[]) {
      super(`Schedule conflict with ${conflicts.length} existing task(s)`);
      this.name = "ScheduleConflictError";
      this.conflicts = conflicts;
    }
  }
  ```

---

### S4-04 · `scheduling/conflict.service.ts`

**Backlog:** MVP-017 · **Оценка:** 1.5 ч · **Зависит от:** S4-01, S4-02, S4-03

**Что сделать**
- Тип `ScheduleConflict` — ровно по §12 плана: `{ occurrenceId, taskId, title, start: Date, end: Date, priority: Priority, flexibility: Flexibility }` (`taskId` добавлен сверх плана — нужен, чтобы диалог мог когда-нибудь дать ссылку на задачу; не используется в этом спринте, но дешевле завести сразу, чем мигрировать тип второй раз).
- `conflictService.findConflicts(userId, start, end, excludeOccurrenceId?, db?)` → вызывает `occurrenceRepository.findOverlapping`, мапит результат в `ScheduleConflict[]`.
- Не выбрасывает ошибку сам — это забота вызывающего кода (S4-06). Сервис только возвращает список (может быть пустым).

**Acceptance criteria**
- [ ] Пустой список, если пересечений нет — не `null`/`undefined`.

---

### S4-05 · `lib/validation/task.ts`: `confirmConflicts`

**Оценка:** 0.5 ч

**Что сделать**
- Добавить в `taskFormFields`: `confirmConflicts: z.coerce.boolean().optional().default(false)`.
- Наследуется в `createTaskSchema` и `updateTaskSchema` автоматически (оба строятся из `taskFormFields`).

**Acceptance criteria**
- [ ] `safeParse({...валидные поля без confirmConflicts})` — `confirmConflicts` по умолчанию `false`, парсинг не падает (поле опционально, как `repeat`/`reminder`).

---

### S4-06 · `TaskService`: подключить проверку конфликтов

**Backlog:** MVP-017 · **Оценка:** 2 ч · **Зависит от:** S4-04, S4-05

**Что сделать**
- В `createTask`: после парсинга схемы (S4-05 даёт `data.confirmConflicts`) — вычислить `scheduledStart`/`scheduledEnd` теми же `zonedDateTimeToUtc`/`addMinutes`, что и `occurrenceService.createForTask`. Внутри `runInTransaction`, **до** `taskRepository.create`, если `!data.confirmConflicts`, вызвать `conflictService.findConflicts(userId, scheduledStart, scheduledEnd, undefined, tx)`; если список не пуст — `throw new ScheduleConflictError(conflicts)` (откатывает транзакцию, `taskRepository.create` ещё не вызван — ничего не записано).
- В `updateTask`: тот же вызов после `occurrenceRepository.findByTaskId` (нужен `occurrence.id`, чтобы исключить сам себя через `excludeOccurrenceId`), **до** `taskRepository.update`/`occurrenceRepository.update`.
- Пересчёт `scheduledStart`/`scheduledEnd` в `taskService` дублирует то, что `occurrenceService.createForTask` считает заново для самой записи — сознательно: те же чистые функции с теми же входами дают тот же результат, а рефакторить `occurrenceService` под приём готовых дат ради экономии одного вызова `zonedDateTimeToUtc` не стоит риска регрессии в Sprint 2-коде.

**Acceptance criteria**
- [ ] Создание задачи с `confirmConflicts: false` и пересекающимся временем — `ScheduleConflictError`, в БД ничего не создано (ни `Task`, ни `TaskOccurrence`).
- [ ] Тот же запрос с `confirmConflicts: true` — создаётся, несмотря на пересечение.
- [ ] Редактирование задачи с тем же временем, что было (без изменений) — не конфликтует само с собой.
- [ ] Пересечение с `DONE`/`SKIPPED`/`CANCELLED`-occurrence — не конфликт (S4-02 уже фильтрует по статусу, здесь просто не ломаем это фильтром выше).

---

### S4-07 · `actions.ts`: статус `"conflict"`

**Backlog:** MVP-018 · **Оценка:** 1.5 ч · **Зависит от:** S4-06

**Что сделать**
- Расширить `TaskActionState`:
  ```ts
  export type ConflictSummary = {
    occurrenceId: string;
    title: string;
    timeLabel: string;
    priority: Priority;
    flexibility: Flexibility;
  };

  export type TaskActionState = {
    status: "idle" | "success" | "error" | "conflict";
    message?: string;
    conflicts?: ConflictSummary[];
  };
  ```
- `readTaskForm`: добавить `confirmConflicts: formData.get("confirmConflicts") === "true"`.
- В `createTaskAction`/`updateTaskAction`: перед общим `catch`/`rethrow`, поймать `ScheduleConflictError` и смаппить `error.conflicts` в `ConflictSummary[]`, форматируя `start`/`end` через `formatDateInZone`/`formatTimeInZone` с `user.timezone` (тот же паттерн форматирования на границе action/page, что уже используется в `dashboard/page.tsx`, `tasks/[id]/page.tsx` — сервисный слой Date не форматирует, это ответственность вызывающего кода на границе с UI). Вернуть `{ status: "conflict", conflicts, message: error.message }`.

**Acceptance criteria**
- [ ] `ConflictSummary.timeLabel` — читаемая строка в таймзоне пользователя (например `"10 Sep, 19:00–20:00"`), а не сырой ISO/UTC.

---

### S4-08 · `task-form.tsx`: диалог конфликта

**Backlog:** MVP-018 · **Оценка:** 3 ч · **Зависит от:** S4-07

**Что сделать**
- `useRef<HTMLFormElement>` на `<form>` (для `requestSubmit()` из «Create anyway»).
- `useState` для `conflictDialogOpen`; открывается adjust-during-render по смене `state` (см. ниже), не в `useEffect` — `setState` синхронно внутри эффекта ловится ESLint-правилом `react-hooks/set-state-in-effect`.
- **Найдено ручным тестированием после первой реализации:** React сбрасывает несontrolled-поля `<form action={fn}>` после **любого** завершения action — не только успеха, но и возврата `"conflict"`/`"error"`-статуса (задокументированное поведение React 19, а не баг конкретно этого кода). С `defaultValue`-полями (как в Sprint 2) это было незаметно, потому что единственный «неуспешный» путь — `TaskValidationError` — почти всегда перехватывается HTML5-валидацией раньше, чем долетает до сервера. Конфликт — штатный, частый исход, поэтому сброс полей стал видимым и блокирующим сценарий «Edit time» / «Create anyway» целиком.
  - **Решение:** все data-полня формы (title/description/date/time/durationMinutes/priority/flexibility) переведены с `defaultValue` на controlled (`value` + `onChange`/`onValueChange`, локальный `useState` на каждое поле) — React не может тихо сбросить значение, которое рендерится из его собственного state. Скрытое поле `confirmConflicts` — тоже `value` (controlled) вместо `ref`+`defaultValue`, с тем же `useState`, который сбрасывается в `false` при изменении `date`/`time`/`durationMinutes` (полей, влияющих на окно конфликта; `title`/`description`/`priority`/`flexibility` на конфликт не влияют — сброс на их изменение не нужен).
- Диалог — переиспользуем `AlertDialog`/`AlertDialogContent`/`AlertDialogHeader`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogFooter`/`AlertDialogAction`/`AlertDialogCancel` (как в `task-actions.tsx`), рендерится **вне** `<form>` (сиблингом, не потомком) — `AlertDialogAction`/`AlertDialogCancel` рендерят `<button>` без явного `type`, что внутри формы означало бы `type="submit"` по умолчанию и случайный лишний сабмит при клике «Edit time»; вдобавок оба явно получили `type="button"`.
  - Title: «Scheduling conflict».
  - Список `state.conflicts`: название, `timeLabel`, priority/flexibility.
  - `AlertDialogCancel` → «Edit time» (закрывает диалог, значения формы не трогает — они всё равно в React state, не в DOM).
  - `AlertDialogAction` → «Create anyway»: `onClick` — `setConfirmConflicts(true)`, закрыть диалог, `formRef.current?.requestSubmit()`.

**Acceptance criteria**
- [ ] После «Create anyway» форма реально пересабмитится и (если новых конфликтов на этот момент нет) произойдёт `redirect` как при обычном успешном сохранении.
- [ ] После «Edit time» значения полей формы остаются как были — ничего не сбрасывается (проверено вручную: без controlled-полей это ломалось).
- [ ] Изменение даты/времени после показа диалога и повторный сабмит без нажатия «Create anyway» — заново проверяется на конфликт (флаг не «залипает» в `true`).

---

## 4. Не входит в Sprint 4

Сознательно откладываем: автоматический перенос конфликтующей задачи (план §2.6 — не нужно в MVP); учёт `priority`/`flexibility` как правила, блокирующего сохранение (только информативно в диалоге); проверка конфликтов для recurring-задач с несколькими occurrences (Sprint 5, до этого у `Task` ровно одна occurrence); realtime-проверка конфликта на лету при вводе времени (без сабмита формы) — целиком серверная проверка при сохранении, как описано в плане; recurrence (Sprint 5); notifications/snooze (Sprint 6).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| TOCTOU: конфликт создаётся между проверкой и записью (два параллельных сабмита) | Редкий дубль пересечения проскакивает без диалога | Не защищаемся отдельно в MVP — тот же уровень строгости, что план закладывает для v1 (нет distributed lock/uniq-констрейнта на пересечения); фиксируем как известное ограничение |
| Пользователь меняет время после «Create anyway», но флаг подтверждения не сбрасывается | Тихо создаётся новый конфликт без предупреждения | `onChange` на форме сбрасывает `confirmConflicts` в `false` при любом изменении поля (S4-08) |
| `findOverlapping` без индекса на `(userId, scheduledStart, scheduledEnd)` — full scan по occurrences пользователя при большом объёме данных | Деградация на масштабе, не в MVP-диапазоне | Существующий `@@index([userId, scheduledStart])` покрывает `userId`+`scheduledStart`-часть предиката (`lt`) с приемлемой производительностью для объёма MVP; отдельный композитный индекс — не в этом спринте |

---

## 6. Предлагаемый порядок работы

| День | Задачи |
|---|---|
| 1 | S4-01, S4-02, S4-03, S4-04, S4-05 |
| 2 | S4-06, S4-07 |
| 3 | S4-08, прогон Sprint DoD |
