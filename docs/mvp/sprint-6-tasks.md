# Sprint 6 — Notifications: напоминания и snooze

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), раздел §19 «Sprint 6 — Notifications», §2.10 «Напоминания», §2.11 «Snooze», §10 (Prisma-модель `Notification`), §16 (`/tasks/new` поле Reminder). Продолжение [sprint-5-tasks.md](./sprint-5-tasks.md) — **Sprint 5 ещё не смержен** (PR [#5](https://github.com/Natalka-qa/Reminder-assistant/pull/5), проходит CI/ревью), поэтому эта ветка (`sprint-6-tasks`) ответвлена от `sprint-5-tasks`, а не от `main`: recurrence-код (batch-генерация occurrences, `cancelFutureOccurrences`, `cascadeDurationChange`) нужен как есть для интеграции нотификаций. PR этого спринта будет нацелен на `sprint-5-tasks` (стек), GitHub сам переключит base на `main`, когда PR #5 смержится.

**Цель спринта:** когда наступает время задачи (или заданный оффсет до неё), пользователь получает настоящее напоминание — email и, если приложение открыто, in-app уведомление — и может отреагировать: Done / Partial / Skip, как раньше, или Snooze (+15 мин / +30 мин / +1 час / завтра).

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит (все пять отдельно, см. урок Sprint 4).
- [ ] **Новая миграция есть** (в отличие от Sprint 5): `Notification`, `NotificationStatus`, `Task.reminderOffsetMinutes`.
- [ ] На `/tasks/new` поле Reminder — реальный Select (At time of task / 5 / 15 / 30 / 60 минут до), не disabled-заглушка.
- [ ] При создании (или продлении окна) любой occurrence создаётся ровно одна `Notification` с `sendAt = scheduledStart − reminderOffsetMinutes`.
- [ ] Cron-эндпоинт отправляет все `PENDING`-нотификации с `sendAt <= now`; при ошибке — retry со следующего запуска (до `MAX_NOTIFICATION_ATTEMPTS`), затем `FAILED`.
- [ ] При загрузке `/dashboard` те же due-нотификации отправляются немедленно (не ждут cron) и показываются как in-app toast — это основной канал timely-доставки, cron — подстраховка (см. «Расхождения» п.5).
- [ ] `Snooze` (+15/+30/+1ч/завтра) переводит occurrence в `SNOOZED`, увеличивает `snoozeCount`, создаёт новую `Notification`; `SNOOZED` всюду в коде трактуется как активный статус наравне со `SCHEDULED` (конфликты, dashboard, отмена, `pickCurrentOccurrence`).
- [ ] Done/Partial/Skip и деактивация задачи отменяют (`CANCELLED`) ещё не отправленные нотификации соответствующих occurrences — не слать напоминание о уже закрытой задаче.
- [ ] Слоистая архитектура не нарушена: Prisma-вызовы только в `*.repository.ts` (тот же grep, что в Sprint 1-5), включая новый `notification.repository.ts`.

---

## 1. Стартовое состояние (что осталось от Sprint 1-5)

| Есть | Детали |
|---|---|
| `OccurrenceStatus.SNOOZED` | В enum с Sprint 2, **нигде не используется**: `canTransitionFromScheduled("SNOOZED")` явно возвращает `false` (`occurrence-status.ts:9`, зафиксировано тестом) |
| Поле «Reminder» в форме | `task-form.tsx` — disabled `<Input name="reminder">`, `reminder: z.string().optional()` в схеме, значение принимается и отбрасывается (тот же паттерн, что был у «Repeat» до Sprint 5) |
| Настройки уведомлений в `/settings` | `settings-form.tsx` — три disabled-заглушки: «Default reminder offset», «Start of day», «End of day», подписано «Coming in a later sprint» — **не этот спринт**, см. «Расхождения» п.7 |
| `Notification` модель | Отсутствует полностью. Схема: `// Notification is Sprint 6.` (комментарий в `schema.prisma`). `grep -rn "Notification" src` — 0 совпадений вне этого комментария |
| Отправка email | Только через `next-auth`'s встроенный Resend-провайдер (`src/lib/auth/config.ts`) — для magic-link входа, не переиспользуется. Пакет `resend` (SDK) **не установлен** — провайдер Auth.js делает обычный `fetch` на `https://api.resend.com/emails` (см. `node_modules/@auth/core/src/providers/resend.ts`), без SDK. `RESEND_API_KEY`/`EMAIL_FROM` уже в `env.ts`/`.env.local` — переиспользуем напрямую, новый пакет не нужен |
| `features/notifications/`, `components/notifications/` | Пустые папки (`.gitkeep`) из ADR-001, ещё не заняты |
| Background job / cron | Один существующий: `/api/cron/extend-occurrences` (Sprint 5, `0 3 * * *`), защищён `CRON_SECRET`. **Важно**: Sprint 5 сам задокументировал риск — «Vercel Cron не запускается в бесплатном (Hobby) плане чаще 1 раза в день». Для продления occurrence-окна это было не критично (30-дневный запас), для доставки напоминаний **критично** — часовая/дневная задержка обесценивает фичу. Решение — п.5 ниже |
| Buckets со `"SCHEDULED"` как единственный «активный» статус | `grep -rn '"SCHEDULED"' src` — 15 мест: `occurrence-status.ts` (`canTransitionFromScheduled`), `occurrence.service.ts` (создание, `cancelFutureOccurrences`, `cascadeDurationChange`), `occurrence.repository.ts` (`findOverlapping`, `findOverdueForUser`), `occurrence-selection.ts` (`pickCurrentOccurrence`), `occurrence-actions.tsx` (кнопки), `dashboard/page.tsx` и `tasks/[id]/page.tsx` (список/лейбл). Все нужно свести к одному предикату — `SNOOZED` должен трактоваться так же, как `SCHEDULED`, everywhere (см. §2.11 плана: snooze не меняет, что задача всё ещё предстоит — только когда о ней напомнят) |
| `occurrenceRepository.createMany` | Есть с Sprint 5 (`Prisma.createMany`), **не возвращает id** созданных строк — проблема для этого спринта, см. «Расхождения» п.4 |
| `zonedDateTimeToUtc`, `addDaysInZone`, `addMinutes`, `formatDateInZone/formatTimeInZone` | Есть, `addMinutes` уже используется с отрицательными значениями? Нет, но поддерживает (чистая арифметика в UTC) — подходит для `sendAt = scheduledStart − offset` |
| `dropdown-menu.tsx` | Есть в `components/ui` (обёртка над `@base-ui/react/menu`), готов для Snooze-меню с 4 опциями |

### Расхождения плана / решения на этот спринт

1. **`Notification` привязана к `TaskOccurrence` через `occurrenceId`, а не к `Task`.** Так в плане (§2.10) — одна нотификация на один occurrence. Добавляем денормализованный `userId` (тот же паттерн, что `TaskOccurrence.userId` рядом с `taskId` с Sprint 2) — репозиторные методы фильтруют по `userId` без лишнего join.
2. **Оффсет напоминания — поле `Task.reminderOffsetMinutes` (`Int`, default `0`), а не отдельная модель.** `0` = «в момент начала» (текущий плейсхолдер формы). Живёт на `Task`, как `durationMinutes`/`priority` — общий для всех occurrences задачи, и так же каскадируется на будущие `PENDING`-нотификации при изменении (симметрично `durationMinutes` из Sprint 5, п.6 его «Расхождений»).
3. **`canTransitionFromScheduled` переименовывается в `isActionableOccurrenceStatus`, `true` для `SCHEDULED` и `SNOOZED`.** План не описывает snooze как смену «типа» occurrence — он гасит только уведомление, задача всё ещё предстоит («occurrence остаётся связанным с той же задачей», §2.11). Раз `SNOOZED` — не финальный статус, весь код, где `"SCHEDULED"` означает «ещё не закрыта / ещё занимает слот», должен принимать оба. Единая замена везде (перечень — таблица выше) вместо точечных `!== "DONE" && !== "SKIPPED" && ...` — так поведение остаётся одним местом правды, как `hasOverlap`/`canTransitionFromScheduled` уже задают паттерн для этого проекта.
4. **Батч-создание occurrences + notifications: `createMany` не возвращает id, поэтому после вставки occurrences перечитываем их по `taskId` и сопоставляем по `scheduledStart`** (уникален в пределах одной генерации одной задачи — ни одно правило (`DAILY`/`WEEKLY`/`MONTHLY`) не производит два occurrence на один и тот же instant), затем вторым `createMany` вставляем `Notification[]`. Альтернатива — предгенерировать `id` на клиенте (`crypto.randomUUID()`, без новых зависимостей) и передать явно в оба батча; re-fetch-подход выбран, потому что не создаёт визуальной несогласованности id (`cuid()` у всех строк, а не uuid только у батчевых) и не полагается на синхронизацию двух параллельных массивов.
5. **Основной канал timely-доставки — не cron, а «ленивый» триггер при заходе на `/dashboard`.** Из-за Hobby-плана (см. таблицу выше) ежедневный cron не годится сам по себе для «напоминание в момент начала задачи». `/dashboard` уже единственное место, где пользователь физически смотрит в приложение — ровно момент, когда имеет смысл in-app toast, и естественная точка для «раз уж открыли — отправим то, что уже назрело» и по email тоже. Cron (`/api/cron/send-notifications`, расписание `*/5 * * * *` — работает как задумано на платном плане, на Hobby выполнится реже, но не сломается) — подстраховка на случай, если пользователь не заходил в приложение к моменту напоминания: доставит с опозданием, но доставит, не потеряет. Апгрейд Vercel-плана или внешний пинг (cron-job.org / GitHub Actions на тот же защищённый эндпоинт) — сознательно не в этом спринте, та же логика, что отказ от Inngest/Trigger.dev в Sprint 5 (`sprint-5-tasks.md`, «Расхождения» п.4).
6. **Два независимых триггера (dashboard-load и cron) могут задеть одну и ту же нотификацию почти одновременно** → нужна защита от двойной отправки. `notificationRepository.claim(id)` — условный `updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING" } })`; если `count === 0` — кто-то другой уже забрал, пропускаем. Дёшево, без внешнего лока.
7. **`/settings` — «Default reminder offset» / «Start of day» / «End of day» остаются disabled-заглушками.** План группирует их с notifications (§16), но default-per-user оффсет (auto-заполнение формы) и quiet-hours — отдельная функциональность сверх «occurrence получает работающее напоминание»; риск размытия скоупа без DoD-необходимости. `reminderOffsetMinutes` этого спринта — per-task, выбирается в форме, без пользовательского дефолта.
8. **Retry — переотправка на следующий запуск (cron или dashboard-load), без backoff.** `attemptCount` растёт при каждой неудаче; `attemptCount >= MAX_NOTIFICATION_ATTEMPTS` (3) → `FAILED`, дальше не трогаем. Никакого «зависшего `PROCESSING`»-восстановления (например, если процесс упал между `claim` и отправкой) — при MVP-масштабе (один cron/dashboard-запрос за раз, не параллельно) шанс наступить на это ничтожен; если случится — просто зависшая `PROCESSING`-строка, не блокирующая остальные. Не в этом спринте.
9. **Email — обычный `fetch` на Resend REST API (`lib/email/send-email.ts`), без SDK.** Тот же подход, что у `next-auth`'s Resend-провайдера (см. таблицу выше) — не тянуть `resend`-пакет ради одного вызова.
10. **Snooze не создаёт новый occurrence и не двигает `scheduledStart`/`scheduledEnd`.** Двигается только *когда напомнить* — новая `Notification.sendAt`; фактическое время задачи (и, значит, конфликт-проверка для *других* задач) не меняется. Старая `PENDING`/`PROCESSING`-нотификация того же occurrence отменяется, чтобы не отправить и старое, и новое напоминание.

---

## 2. Обзор задач

| ID | Задача | Backlog | Оценка | Зависит от |
|---|---|---|---|---|
| S6-01 | Prisma-схема: `Notification`, `NotificationStatus`, `Task.reminderOffsetMinutes` + миграция | MVP-021 | 1.5 ч | — |
| S6-02 | `occurrence-status.ts`: `isActionableOccurrenceStatus`; развести `SNOOZED` как активный статус по всем 8 местам | — | 2 ч | S6-01 |
| S6-03 | `lib/email/send-email.ts` — Resend REST-вызов + шаблон письма-напоминания | — | 1 ч | — |
| S6-04 | `features/notifications/notification.repository.ts` | MVP-021 | 1.5 ч | S6-01 |
| S6-05 | `features/notifications/notification.service.ts`: создание (одиночное + батч), отмена, каскад оффсета, `sendDueNotifications`, `snoozeOccurrence` | MVP-022, MVP-023 | 4 ч | S6-02, S6-03, S6-04 |
| S6-06 | Вписать создание нотификаций в `occurrenceService` (`createForTask`, `createOccurrencesForTask`, `extendOccurrencesForAllActiveTasks`) | MVP-021 | 2 ч | S6-05 |
| S6-07 | Вписать отмену нотификаций в `transitionOccurrence` (Done/Partial/Skip) и `cancelFutureOccurrences` (деактивация) | — | 1.5 ч | S6-05 |
| S6-08 | `lib/validation/task.ts` + `TaskService`: `reminderOffsetMinutes` вместо `reminder`-заглушки, каскад при изменении | — | 1.5 ч | S6-05 |
| S6-09 | `task-form.tsx`: реальный Reminder Select | MVP-021 | 1 ч | S6-08 |
| S6-10 | Cron-эндпоинт `/api/cron/send-notifications` + запись в `vercel.json` | MVP-022 | 1 ч | S6-05 |
| S6-11 | `/dashboard`: ленивый триггер отправки + in-app toast для только что отправленных | MVP-022 | 2 ч | S6-05 |
| S6-12 | `OccurrenceActions`: кнопка Snooze с dropdown (+15/+30/+1ч/завтра) | MVP-023 | 2 ч | S6-05, S6-02 |
| S6-13 | Тесты | — | включено в S6-02/03/05 | — |

**Итого:** ≈ 21.5 ч.

**Критический путь:** S6-01 → S6-02 → S6-04 → S6-05 → S6-06/S6-07/S6-08 → S6-09/S6-10/S6-11/S6-12.

---

## 3. Задачи

### S6-01 · Prisma-схема и миграция

**Backlog:** MVP-021 · **Оценка:** 1.5 ч

**Что сделать**
- В `Task` добавить:
  ```prisma
  reminderOffsetMinutes Int @default(0) // 0 = at time of task
  ```
- Добавить модель и enum (план §2.10, с денормализованным `userId` — см. «Расхождения» п.1):
  ```prisma
  model Notification {
    id           String             @id @default(cuid())
    occurrenceId String
    userId       String

    sendAt       DateTime
    status       NotificationStatus @default(PENDING)

    attemptCount Int                @default(0)
    sentAt       DateTime?

    occurrence   TaskOccurrence     @relation(fields: [occurrenceId], references: [id], onDelete: Cascade)
    user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)

    createdAt    DateTime           @default(now())
    updatedAt    DateTime           @updatedAt

    @@index([status, sendAt])
  }

  enum NotificationStatus {
    PENDING
    PROCESSING
    SENT
    FAILED
    CANCELLED
  }
  ```
- `TaskOccurrence` получает обратную связь `notifications Notification[]`; `User` — `notifications Notification[]`.
- `npx prisma migrate dev --name add_notifications`.

**Acceptance criteria**
- [ ] Миграция применяется на чистой БД (`prisma migrate deploy`, как в CI) без ручных правок.
- [ ] Создание `Task` без явного `reminderOffsetMinutes` даёт `0` в БД.

---

### S6-02 · `isActionableOccurrenceStatus` — SNOOZED как активный статус

**Оценка:** 2 ч · **Зависит от:** S6-01

**Что сделать**
- Переименовать `canTransitionFromScheduled` → `isActionableOccurrenceStatus`, `true` для `SCHEDULED` и `SNOOZED` (см. «Расхождения» п.3). Обновить `occurrence-status.test.ts`.
- Обновить все 8 мест из таблицы «Стартовое состояние»:
  - `occurrence.service.ts`: `transitionOccurrence` использует новый предикат.
  - `occurrence.service.ts` `cancelFutureOccurrences`: WHERE `status: { in: ["SCHEDULED", "SNOOZED"] }` вместо `"SCHEDULED"`.
  - `occurrence.service.ts` `cascadeDurationChange`: тот же фильтр в `.filter(...)`.
  - `occurrence.repository.ts` `findOverlapping`: `status: { in: ["SCHEDULED", "SNOOZED"] }` — snooze не освобождает временной слот для конфликт-проверки других задач.
  - `occurrence.repository.ts` `findOverdueForUser`: то же — просроченная, но снузнутая задача остаётся просроченной.
  - `occurrence-selection.ts` `pickCurrentOccurrence`: `isActionableOccurrenceStatus(o.status)` вместо `o.status === "SCHEDULED"`.
  - `occurrence-actions.tsx`: показывать кнопки (Done/Partial/Skip/Snooze — Snooze добавляется в S6-12) при `isActionableOccurrenceStatus(status)`, не только `status === "SCHEDULED"`.
  - `dashboard/page.tsx` (лейбл в «Upcoming») и `tasks/[id]/page.tsx` (разбиение upcoming/history): не показывать статус-лейбл / относить к «upcoming» также и `SNOOZED`.

**Acceptance criteria**
- [ ] `isActionableOccurrenceStatus("SNOOZED")` → `true`; `"DONE"/"SKIPPED"/"CANCELLED"` → `false`.
- [ ] Снузнутый occurrence по-прежнему учитывается как конфликт при создании новой задачи на то же время.
- [ ] Снузнутый occurrence показывается в «Upcoming» на `/tasks/[id]` с кнопками действий, не в «History».

---

### S6-03 · `lib/email/send-email.ts`

**Оценка:** 1 ч

**Что сделать**
- `src/lib/email/send-email.ts`:
  ```ts
  import "server-only";
  import { env } from "@/lib/env";

  export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html }),
    });
    if (!res.ok) {
      throw new Error(`Resend error (${res.status}): ${await res.text()}`);
    }
  }
  ```
- `src/lib/email/reminder-email.ts` — чистая функция `buildReminderEmail({ title, timeLabel, durationMinutes, taskUrl }): { subject, text, html }`, без побочных эффектов (тестируема без мока сети).

**Acceptance criteria**
- [ ] `buildReminderEmail` — снапшот/точечный тест: заголовок и текст содержат название задачи и время.
- [ ] `sendEmail` бросает на не-2xx ответ (проверить на моке `fetch` в тесте — единственный тест в этом спринте, трогающий сеть, через `vi.stubGlobal("fetch", ...)`).

---

### S6-04 · `notification.repository.ts`

**Backlog:** MVP-021 · **Оценка:** 1.5 ч · **Зависит от:** S6-01

**Что сделать**
- `src/features/notifications/notification.repository.ts`, по образцу `occurrence.repository.ts`:
  - `create(data, db?)`, `createMany(data[], db?)`.
  - `findDueForSending(now, db?)` → `status: "PENDING", sendAt: { lte: now }`, `include: { occurrence: { include: { task: true } }, user: true }` (нужны `task.title`, `occurrence.scheduledStart/scheduledEnd`, `user.email/timezone`).
  - `claim(id, db?)` → `updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING" } })`, вернуть `result.count === 1` (см. «Расхождения» п.6).
  - `markSent(id, db?)` → `update({ status: "SENT", sentAt: new Date() })`.
  - `markFailedOrRetry(id, attemptCount, db?)` → если `attemptCount + 1 >= MAX_NOTIFICATION_ATTEMPTS`, `status: "FAILED"`, иначе `status: "PENDING"`; всегда `attemptCount: { increment: 1 }`.
  - `cancelForOccurrence(occurrenceId, db?)` → `updateMany({ where: { occurrenceId, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED" } })`.
  - `cancelForTaskAfter(taskId, userId, after, db?)` → `updateMany({ where: { status: { in: ["PENDING", "PROCESSING"] }, occurrence: { taskId, userId, scheduledStart: { gt: after } } }, data: { status: "CANCELLED" } })` (relation-фильтр в `updateMany`, поддерживается Prisma).

**Acceptance criteria**
- [ ] `claim` на уже `PROCESSING`/`SENT` строке возвращает `false`, статус не трогается.
- [ ] `cancelForTaskAfter` не трогает `SENT`/`FAILED`-нотификации (историю не переписываем).

---

### S6-05 · `notification.service.ts`

**Backlog:** MVP-022, MVP-023 · **Оценка:** 4 ч · **Зависит от:** S6-02, S6-03, S6-04

**Что сделать**
- `createForOccurrence(occurrence, reminderOffsetMinutes, tx)` — `sendAt = addMinutes(occurrence.scheduledStart, -reminderOffsetMinutes)`, `notificationRepository.create(...)`. Транзакционный контракт как у `occurrenceService.createForTask` (S2-06).
- `createForOccurrences(occurrences, reminderOffsetMinutes, tx)` — батч-версия для recurring/extend путей (см. «Расхождения» п.4): строит кандидатов из уже вставленных occurrence-строк (у которых уже есть `id` — вызывается **после** `occurrenceRepository.createMany` + re-fetch на стороне `occurrenceService`, не сам re-fetch'ит), `notificationRepository.createMany(...)`.
- `cancelForOccurrence(occurrenceId, tx)`, `cancelForTaskAfter(taskId, userId, after, tx)` — тонкие обёртки над репозиторием.
- `rescheduleForTask(taskId, userId, newOffsetMinutes, tx)` — каскад при изменении `reminderOffsetMinutes` (симметрично `occurrenceService.cascadeDurationChange`, Sprint 5): найти будущие `PENDING`-нотификации задачи через `occurrence.repository.findByTaskId` + фильтр по статусу occurrence и `scheduledStart > now`, для каждой пересчитать `sendAt` и `update`.
- `sendDueNotifications(now, db?)`:
  1. `notificationRepository.findDueForSending(now, db)`.
  2. Для каждой — `claim`; если не удалось (гонка с другим триггером) — пропустить.
  3. Отправить письмо (`buildReminderEmail` + `sendEmail`, время форматировать в `user.timezone`).
  4. Успех → `markSent`; ошибка (`try/catch` вокруг `sendEmail`) → `markFailedOrRetry`.
  5. Вернуть список успешно обработанных (`{ occurrenceId, title, timeLabel }[]`) — для in-app toast (S6-11), **независимо от результата письма**: сам факт «время пришло» реален и для toast, даже если email упал (toast — параллельный канал, не зависит от почты).
- `snoozeOccurrence(userId, occurrenceId, option: "15m" | "30m" | "1h" | "tomorrow", timezone, tx)`:
  1. Загрузить occurrence, проверить `isActionableOccurrenceStatus` (иначе `InvalidOccurrenceTransitionError`, как в `transitionOccurrence`).
  2. Вычислить новое время: `15m/30m/1h` → `addMinutes(now, N)`; `tomorrow` → тот же час/минута `scheduledStart`, но `+1 календарный день` в `timezone` (`addDaysInZone`, никогда `+24h` — тот же инвариант §15 плана, что и recurrence).
  3. `occurrenceRepository.update`: `status: "SNOOZED"`, `snoozeCount: { increment: 1 }`.
  4. `notificationRepository.cancelForOccurrence` (гасим ещё не отправленное старое напоминание) + `createForOccurrence`-подобная вставка новой `Notification` с вычисленным `sendAt`.

**Acceptance criteria**
- [ ] `sendDueNotifications` на нотификации с `sendAt` в прошлом и `attemptCount = MAX_NOTIFICATION_ATTEMPTS - 1` — при смоканной ошибке отправки переводит в `FAILED`, не `PENDING`.
- [ ] `snoozeOccurrence("tomorrow")` на occurrence `19:00` сегодня — новая `Notification.sendAt` соответствует `19:00` завтра в timezone пользователя, не «+24 часа» (тест на дату вокруг DST-перехода, по образцу `occurrence-dates.test.ts`).
- [ ] Повторный вызов `snoozeOccurrence` (снуз со снуза) — `snoozeCount` растёт дальше, старая нотификация от первого снуза отменена, не задваивается.

---

### S6-06 · Создание нотификаций из `occurrenceService`

**Backlog:** MVP-021 · **Оценка:** 2 ч · **Зависит от:** S6-05

**Что сделать**
- `createForTask` (одиночный occurrence): после `occurrenceRepository.create`, вызвать `notificationService.createForOccurrence(occurrence, task.reminderOffsetMinutes, tx)`. Сигнатура принимает `reminderOffsetMinutes` явно (пробрасывается из `Task`, доступного вызывающей стороне — `TaskService`).
- `createOccurrencesForTask` (batch, recurring): после `occurrenceRepository.createMany(candidates, tx)`, перечитать созданные строки (`occurrenceRepository.findByTaskId(task.id, task.userId, tx)`, отфильтровать по `scheduledStart`, совпадающим с `candidates` — см. «Расхождения» п.4), передать в `notificationService.createForOccurrences(..., reminderOffsetMinutes, tx)`.
- `extendOccurrencesForAllActiveTasks`: то же самое после его `occurrenceRepository.createMany` — `task.reminderOffsetMinutes` уже есть на объекте `task` (из `findActiveRecurring`, не нужен доп. запрос).

**Acceptance criteria**
- [ ] Создание recurring-задачи (WEEKLY, 3 дня в неделю) на 30 дней — ровно столько же `Notification`, сколько `TaskOccurrence` (проверить подсчётом).
- [ ] Продление окна (`extendOccurrencesForAllActiveTasks`) тоже создаёт нотификации для новых occurrences, не только сами occurrences.

---

### S6-07 · Отмена нотификаций при завершении/деактивации

**Оценка:** 1.5 ч · **Зависит от:** S6-05

**Что сделать**
- `transitionOccurrence` (Done/Partial/Skip, `occurrence.service.ts`): после `occurrenceRepository.update`, вызвать `notificationService.cancelForOccurrence(occurrenceId)` (без `tx` — последовательный, не критично-атомарный вызов, см. «Расхождения»: худший случай — одно лишнее письмо, не порча данных).
- `TaskService.deactivateTask`: рядом с существующим `occurrenceService.cancelFutureOccurrences(taskId, userId, new Date(), tx)` (Sprint 5) добавить `notificationService.cancelForTaskAfter(taskId, userId, new Date(), tx)`.

**Acceptance criteria**
- [ ] Отметить occurrence `Done` до срабатывания напоминания — соответствующая `Notification` переходит в `CANCELLED`, `sendDueNotifications` её больше не берёт.
- [ ] Деактивация recurring-задачи с будущими occurrences — все их `PENDING`-нотификации тоже `CANCELLED`.

---

### S6-08 · `reminderOffsetMinutes` в валидации и `TaskService`

**Оценка:** 1.5 ч · **Зависит от:** S6-05

**Что сделать**
- В `lib/validation/task.ts` заменить:
  ```ts
  reminder: z.string().optional(),
  ```
  на:
  ```ts
  reminderOffsetMinutes: z.coerce.number().int().min(0).max(1440).optional().default(0),
  ```
- `TaskService.createTask`: передать `reminderOffsetMinutes: data.reminderOffsetMinutes` в `taskRepository.create` и далее в `occurrenceService.createForTask`/`createOccurrencesForTask` (S6-06).
- `TaskService.updateTask`: и в recurring-, и в non-recurring-ветке — если `data.reminderOffsetMinutes !== existing.reminderOffsetMinutes`, вызвать `notificationService.rescheduleForTask(taskId, userId, data.reminderOffsetMinutes, tx)` (в дополнение к уже существующему duration-каскаду в recurring-ветке; для non-recurring-ветки это новый вызов — оффсет можно менять и для обычной задачи).

**Acceptance criteria**
- [ ] `reminderOffsetMinutes` не передан в форме → `0` в БД (как `repeatFrequency` дефолтится в `NONE` в Sprint 5).
- [ ] Смена оффсета у recurring-задачи с `0` на `15` — `sendAt` всех будущих `PENDING`-нотификаций сдвигается на 15 минут раньше исходного `scheduledStart`; уже отправленные (`SENT`) не трогаются.

---

### S6-09 · `task-form.tsx`: реальный Reminder Select

**Backlog:** MVP-021 · **Оценка:** 1 ч · **Зависит от:** S6-08

**Что сделать**
- Убрать disabled-заглушку «Reminder». Добавить `Select` (`reminderOffsetMinutes`) по образцу `repeatFrequency` (Sprint 5) — controlled `value`+`onValueChange`, не `defaultValue`:
  ```text
  0  → "At time of task"
  5  → "5 minutes before"
  15 → "15 minutes before"
  30 → "30 minutes before"
  60 → "1 hour before"
  ```
- В отличие от Repeat/Date/Time — это поле **не блокируется** для recurring-задач при редактировании (оно не влияет на генерацию occurrences, только на то, когда слать напоминание — см. «Расхождения» п.2), значит в `scheduleLocked`-режиме (`edit/page.tsx`) остаётся обычным интерактивным полем.

**Acceptance criteria**
- [ ] На `/tasks/new` и на `/tasks/[id]/edit` (в том числе для recurring-задачи) Reminder — активный Select, не read-only.
- [ ] Пересоздание формы после конфликт-диалога (`handleCreateAnyway`, Sprint 4/5 паттерн) сохраняет выбранный `reminderOffsetMinutes`.

---

### S6-10 · Cron-эндпоинт для отправки

**Backlog:** MVP-022 · **Оценка:** 1 ч · **Зависит от:** S6-05

**Что сделать**
- `src/app/api/cron/send-notifications/route.ts` — тот же паттерн, что `extend-occurrences` (Sprint 5): проверка `Authorization: Bearer ${CRON_SECRET}`, иначе `401`; вызов `notificationService.sendDueNotifications(new Date())`, вернуть `{ sent: <кол-во> }`.
- В `vercel.json` добавить второй cron:
  ```json
  { "path": "/api/cron/send-notifications", "schedule": "*/5 * * * *" }
  ```
  (На Hobby-плане Vercel сожмёт частоту до одного запуска в день — см. «Расхождения» п.5; расписание задаётся «на вырост», не ломается и не требует правки при апгрейде плана.)

**Acceptance criteria**
- [ ] Запрос без корректного `Authorization` — `401`, `sendDueNotifications` не вызывается (тот же тест, что был у `extend-occurrences` в Sprint 5).
- [ ] Локальный ручной вызов после `snoozeOccurrence("15m")` и ожидания — отправляет письмо и переводит нотификацию в `SENT`.

---

### S6-11 · Dashboard: ленивый триггер + in-app toast

**Backlog:** MVP-022 · **Оценка:** 2 ч · **Зависит от:** S6-05

**Что сделать**
- `dashboard/page.tsx`: перед вычислением `todayTasks`/`overdueTasks`/`upcomingTasks`, вызвать `await notificationService.sendDueNotifications(new Date())` (только если есть `user` — см. существующий guard). Результат (`{ occurrenceId, title, timeLabel }[]`) передать в новый клиентский компонент.
- `src/components/notifications/due-notifications-toast.tsx` — `"use client"`, принимает `notifications: {...}[]`, в `useEffect` на маунт вызывает `toast(...)` (sonner, уже используется в проекте) для каждой — например `toast("🏃 Тренировка", { description: "19:00" })`. Рендерится в `dashboard/page.tsx` рядом с остальным контентом (ничего не рендерит сам, только эффект).

**Acceptance criteria**
- [ ] Occurrence с `sendAt` в прошлом и `status: "PENDING"` у его нотификации — после захода на `/dashboard` нотификация становится `SENT`, появляется toast.
- [ ] Повторный заход на `/dashboard` сразу после — не показывает тот же toast снова (нотификация уже не `PENDING`, `findDueForSending` её не вернёт).

---

### S6-12 · Snooze-кнопка в `OccurrenceActions`

**Backlog:** MVP-023 · **Оценка:** 2 ч · **Зависит от:** S6-05, S6-02

**Что сделать**
- В `src/features/scheduling/actions.ts` добавить `snoozeOccurrenceAction(occurrenceId, option)` — серверный action, аналог `completeOccurrenceAction` и др., вызывает `occurrenceService.snoozeOccurrence` (нужен `user.timezone` — брать из `getCurrentUser()`, как остальные actions), `revalidatePath` тем же трём путям.
- `occurrence-actions.tsx`: заменить условие `status !== "SCHEDULED"` на `!isActionableOccurrenceStatus(status)` (S6-02); добавить кнопку «Snooze» с `DropdownMenu` (4 пункта: +15 мин / +30 мин / +1 час / Завтра), видимую при `SCHEDULED` и `SNOOZED`.
- Если статус уже `SNOOZED` — показать рядом с кнопками маленькую подпись с временем следующего напоминания (`STATUS_LABELS` уже содержит `"Snoozed"`, дополнить временем).

**Acceptance criteria**
- [ ] Клик «Snooze → +30 мин» на `/dashboard` или `/tasks/[id]` — occurrence переходит в `SNOOZED`, но остаётся в списке с активными кнопками (не пропадает и не становится «историей»).
- [ ] Done/Partial/Skip продолжают работать на `SNOOZED`-occurrence (не только на `SCHEDULED`).

---

## 4. Не входит в Sprint 6

Сознательно откладываем: пользовательские дефолты напоминаний и quiet-hours (`/settings`, «Расхождения» п.7); настоящие браузерные push-уведомления (Web Push API, Service Worker, permission-флоу) — «in-app/browser notification» реализуется как in-tab toast при заходе в приложение, не системный push, который требует значительно больше инфраструктуры ради соло-MVP; live-обновление toast без перезахода/навигации (никакого polling/WebSocket — только на загрузке `/dashboard` или после revalidate от какого-либо action); recovery зависших `PROCESSING`-нотификаций и exponential backoff при retry (простое «в следующий раз» — «Расхождения» п.8); внешний cron-пинг или апгрейд Vercel-плана ради sub-daily-частоты (тот же выбор, что Inngest/Trigger.dev в Sprint 5); completion rate / 7-дневная статистика (Sprint 7, план §17).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Vercel Cron на Hobby-плане не бьёт `*/5 * * * *` | Напоминание по email может задержаться на весь день, если пользователь не открывал приложение | Ленивый триггер на `/dashboard` — основной канал, не полагается на частоту cron (см. «Расхождения» п.5); cron — подстраховка |
| Два триггера отправки (dashboard + cron) гоняются за одной и той же нотификацией | Двойная отправка письма | `claim()` — условный `updateMany` с проверкой `count`, атомарно на уровне БД (см. «Расхождения» п.6) |
| Resend может быть недоступен/rate-limit | Письма не уходят | `attemptCount`/retry уже покрывает временные сбои; постоянный сбой → `FAILED` после `MAX_NOTIFICATION_ATTEMPTS`, occurrence не блокируется — пользователь всё ещё видит occurrence и in-app toast |
| Каскад `reminderOffsetMinutes` трогает и recurring, и non-recurring задачи — больше кода, чем duration-каскад (только recurring) в Sprint 5 | Риск пропустить non-recurring-ветку | Явно выделено отдельным пунктом в S6-08 (обе ветки `updateTask`), acceptance criteria покрывают оба случая |
| `SNOOZED`-статус меняет поведение 8 существующих мест сразу | Регрессия в Sprint 2-5 функциональности (конфликты, dashboard, список задач) | Единая замена через `isActionableOccurrenceStatus`, а не точечные патчи — тесты S6-02 покрывают каждый из перечисленных случаев |

---

## 6. Предлагаемый порядок работы

| День | Задачи |
|---|---|
| 1 | S6-01, S6-02, S6-03 |
| 2 | S6-04, S6-05 |
| 3 | S6-06, S6-07, S6-08 |
| 4 | S6-09, S6-10, S6-11 |
| 5 | S6-12, прогон Sprint DoD |
