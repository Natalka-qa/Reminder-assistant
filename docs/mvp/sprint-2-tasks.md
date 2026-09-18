# Sprint 2 — Tasks: задачи

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), раздел §19 «Sprint 2 — Tasks» и backlog §22 (MVP-005…MVP-009). Продолжение [sprint-1-tasks.md](./sprint-1-tasks.md) — Sprint 1 закрыт, CI зелёный, ветка `main` защищена.

**Цель спринта:** пользователь может полноценно управлять одноразовыми задачами — создать, посмотреть, отредактировать, деактивировать и удалить; `/dashboard` показывает реальные задачи на сегодня и предстоящие вместо заглушек.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` зелёные; CI на PR проходит (branch protection уже включена).
- [ ] Новая миграция применяется поверх схемы Sprint 1 без ручных шагов.
- [ ] Пользователь проходит путь: `/dashboard` (Quick Add) → `/tasks/new` → создание → `/tasks/[id]` → edit / deactivate / delete.
- [ ] `/dashboard` показывает реальные Today / Overdue / Upcoming из БД, посчитанные в таймзоне пользователя.
- [ ] Нигде в коде нет наивной склейки Date + Time без прохода через `lib/date` (проверяется вручную/grep).
- [ ] Слоистая архитектура из ADR-001 не нарушена: Prisma-вызовы только в `*.repository.ts` (проверяется тем же grep, что и в Sprint 1).

---

## 1. Стартовое состояние (что осталось от Sprint 1)

| Есть | Детали |
|---|---|
| Схема `User` + таблицы Auth.js | `prisma/schema.prisma`, миграция `20260909200404_init` |
| `src/lib/date` | UTC↔зона, `startOfDayInZone`/`endOfDayInZone`, `addMinutes`, форматирование — но **нет** обратной конвертации «локальная дата+время → UTC» |
| `src/lib/validation/user.ts` | Zod-схема таймзоны — образец, как оформлять схемы для новых доменов |
| `src/features/user/{user.repository.ts, user.service.ts, user.errors.ts, actions.ts}` | Образец слоёв component → action → service → repository |
| `src/features/tasks/`, `src/features/scheduling/`, `src/features/recurrence/`, `src/features/notifications/` | Пустые (`.gitkeep`) — каркас уже создан в ADR-001, готов к заполнению |
| `src/app/(app)/dashboard/page.tsx` | Today/Upcoming — статичные карточки «No tasks yet», кнопка Quick Add `disabled` |
| `src/app/(app)/tasks/` | Пустая папка (`.gitkeep`), в навигации ссылка на `/tasks` уже есть и сейчас ведёт в 404 |
| `src/components/ui/` | button, input, label, select, card, dropdown-menu, skeleton, sonner — **нет** textarea, alert-dialog |
| `verifySession()` / `getCurrentUser()` | Работают, `getCurrentUser().timezone` — источник правды для всех вычислений времени в этом спринте |

### Расхождения плана с тем, что нужно решить в этом спринте

1. **§10 схема `Task`/`TaskOccurrence` не указывает `onDelete`** для связи `TaskOccurrence.task → Task`. Без `onDelete: Cascade` удаление задачи упадёт с ошибкой FK, если у неё есть occurrence (а она есть всегда, см. п.3) → решается в S2-01.
2. **`recurrenceRule` в модели `Task` есть с Sprint 2**, но генерация нескольких occurrences из правила — это Sprint 5 (MVP-019/020, явно в backlog после Sprint 2). Поле в схеме заводим сразу (чтобы не мигрировать второй раз), но поле «Repeat» в форме — disabled-заглушка, как в Sprint 1 было с notification defaults.
3. **Одна задача = одна occurrence.** До Sprint 5 recurrence не генерирует несколько occurrences — `createTask` создаёт Task и ровно один `TaskOccurrence` со статусом `SCHEDULED` в одной транзакции.
4. **Статусы occurrence (`DONE`/`SKIPPED`/…) и действия над ними — Sprint 3** (MVP-010…013, explicitly после Sprint 2 в backlog). В этом спринте occurrence всегда остаётся `SCHEDULED`; «Overdue» на дашборде — просто просроченные `SCHEDULED`, без действий над ними.
5. **`Notification` модель — Sprint 6.** Поле «Reminder» в форме — disabled-заглушка.
6. **`/tasks` index-страница явно не описана в §16 плана** (только `/tasks/new` и `/tasks/[id]`), но нужна — иначе пункт навигации «Tasks» ведёт в 404. Добавляем список активных задач как разумное расширение.

---

## 2. Обзор задач

| ID | Задача | Backlog | Оценка | Зависит от |
|---|---|---|---|---|
| S2-01 | Схема `Task` + `TaskOccurrence`, enum'ы `Priority`/`Flexibility`/`OccurrenceStatus`, миграция | MVP-005, MVP-006 | 3 ч | — |
| S2-02 | `lib/date`: локальные дата+время → UTC-инстант | — | 2 ч | — |
| S2-03 | Zod-схемы создания/редактирования задачи | — | 2 ч | S2-01 |
| S2-04 | `task.repository.ts` | — | 2 ч | S2-01 |
| S2-05 | `occurrence.repository.ts` + минимальный `OccurrenceService` | MVP-006 | 3 ч | S2-01, S2-02 |
| S2-06 | `TaskService`: create/update/delete/deactivate | MVP-008 | 4 ч | S2-03, S2-04, S2-05 |
| S2-07 | `getTodayTasks()` / `getUpcomingTasks()` / `getOverdueTasks()` | MVP-009 | 2 ч | S2-05 |
| S2-08 | Server actions для задач | MVP-007 | 2 ч | S2-06 |
| S2-09 | UI-kit: `textarea`, `alert-dialog` | — | 1 ч | — |
| S2-10 | `/tasks` — список активных задач | — | 3 ч | S2-04, S2-09 |
| S2-11 | `/tasks/new` — форма создания | MVP-007 | 4 ч | S2-08, S2-09 |
| S2-12 | `/tasks/[id]` — детали, upcoming occurrence, deactivate/delete | — | 4 ч | S2-08, S2-09, S2-07 |
| S2-13 | `/tasks/[id]/edit` — форма редактирования | — | 3 ч | S2-11 |
| S2-14 | `/dashboard`: Today/Overdue/Upcoming на реальных данных, Quick Add → `/tasks/new` | MVP-009 | 3 ч | S2-07 |
| S2-15 | Тесты: конвертация дата+время→UTC (DST-кейс), границы `durationMinutes` | — | 2 ч | S2-02, S2-03 |

**Итого:** ≈ 40 ч.

**Критический путь:** S2-01 → S2-04 → S2-05 → S2-06 → S2-08 → S2-11 → S2-13; S2-12, S2-14 параллелятся после S2-08/S2-07.
Независимо: S2-02, S2-09, S2-15.

---

## 3. Задачи

### S2-01 · Схема `Task` + `TaskOccurrence`, миграция

**Backlog:** MVP-005, MVP-006 · **Оценка:** 3 ч · **Зависит от:** —

**Что сделать**
- Добавить в `prisma/schema.prisma` модели `Task`, `TaskOccurrence` и enum'ы `Priority`, `Flexibility`, `OccurrenceStatus` — поля строго по §10 плана.
- **Явно указать `onDelete: Cascade`** на связи `TaskOccurrence.task → Task` (в плане не указано, но без этого удаление задачи с occurrence упадёт на FK constraint).
- `Task.userId` и `TaskOccurrence.userId` — оба с `onDelete: Cascade` на `User` (задачи должны удаляться вместе с пользователем).
- **Не добавлять** `Notification` и `NotificationStatus` — не используются до Sprint 6.
- Индекс `@@index([userId, scheduledStart])` на `TaskOccurrence` уже в §10 — сохранить, он нужен для Today/Upcoming запросов этого спринта.
- Миграция через `npx prisma migrate dev`; seed **не трогать** (задачи не сидируются, тестовый пользователь Sprint 1 остаётся без задач).

**Acceptance criteria**
- [ ] `prisma migrate dev` применяется на Neon-ветке без ошибок.
- [ ] Удаление `Task` через Prisma удаляет связанные `TaskOccurrence` (проверить вручную: создать задачу, удалить, `occurrence` не остаётся «сиротой»).
- [ ] `npx tsc --noEmit` зелёный после `prisma generate` (новые типы подхватились).

---

### S2-02 · `lib/date`: локальные дата+время → UTC

**Backlog:** — · **Оценка:** 2 ч · **Зависит от:** —

**Что сделать**
- Добавить в `src/lib/date/index.ts` функцию, обратную к `utcToZoned` — из wall-clock даты/времени и IANA-зоны получить UTC `Date`. Сигнатура вида `zonedDateTimeToUtc(dateStr: string, timeStr: string, zone: string): Date` (принимает `YYYY-MM-DD` и `HH:mm` — ровно то, что отдают `<input type="date">`/`<input type="time">`).
- Обновить шапку-комментарий модуля (инварианты §15) — упомянуть, что это единственное место, где комбинируются локальная дата и время.
- **Не** использовать `new Date(\`${date}T${time}\`)` где-либо в коде задач — это интерпретируется в зоне сервера/движка JS, а не пользователя, и даёт неверный instant. Вся комбинация — только через новую функцию.

**Acceptance criteria**
- [ ] Функция покрыта тестом на DST-переход (аналогично `addDaysInZone` в Sprint 1): например, дата по разные стороны перехода на летнее время даёт корректный UTC-инстант, а не смещённый на час.
- [ ] Grep по `new Date(` в `src/features/tasks`, `src/features/scheduling`, `src/app/(app)/tasks` не находит склейки строк даты/времени.

---

### S2-03 · Zod-схемы задачи

**Backlog:** — · **Оценка:** 2 ч · **Зависит от:** S2-01

**Что сделать**
- `src/lib/validation/task.ts`: `createTaskSchema` по образцу §14 плана — `title` (1–200), `description` (опционально, до ~2000), `date` (`YYYY-MM-DD`), `time` (`HH:mm`), `durationMinutes` (0–1440), `priority`/`flexibility` (enum), поля `repeat`/`reminder` из формы — принимать, но игнорировать на этом спринте (не валидировать строго, они disabled в UI).
- `updateTaskSchema` — то же самое плюс `active: z.boolean().optional()` для деактивации отдельным путём.
- Схемы валидируют **форму** (raw date/time строки), а не готовый `Date` — конвертация в UTC происходит в сервисе через S2-02, не в валидации.

**Acceptance criteria**
- [ ] Невалидный `durationMinutes` (отрицательный, >1440) отклоняется с понятным сообщением.
- [ ] Пустой `title` отклоняется.

---

### S2-04 · `task.repository.ts`

**Backlog:** — · **Оценка:** 2 ч · **Зависит от:** S2-01

**Что сделать**
- `src/features/tasks/task.repository.ts`: `create`, `findById(id, userId)` (фильтр по `userId` — задача не должна быть доступна другому пользователю), `findActiveByUserId(userId)`, `update`, `delete`, `setActive(id, userId, active)`.
- Каждый метод, кроме `create`, фильтрует по `userId` на уровне запроса (`where: { id, userId }`), а не проверяет владельца после чтения — иначе race condition/лишний запрос.

**Acceptance criteria**
- [ ] Запрос `findById` с чужим `userId` возвращает `null`, а не задачу другого пользователя.
- [ ] Prisma-вызовы для задач есть только в этом файле (проверяется тем же grep, что в ADR-001).

---

### S2-05 · `occurrence.repository.ts` + `OccurrenceService`

**Backlog:** MVP-006 · **Оценка:** 3 ч · **Зависит от:** S2-01, S2-02

**Что сделать**
- `src/features/scheduling/occurrence.repository.ts`: `create`, `findByTaskId`, `update`, `findForUserBetween(userId, start, end)` (используется в S2-07).
- `src/features/scheduling/occurrence.service.ts`: `createForTask(task, { date, time, durationMinutes }, timezone)` — считает `scheduledStart` через `zonedDateTimeToUtc` (S2-02) и `scheduledEnd` через `addMinutes`, создаёт occurrence со статусом `SCHEDULED`.
- Это ровно тот минимум из §11 «OccurrenceService: создание occurrences», без «recurring generation» (Sprint 5).

**Acceptance criteria**
- [ ] `scheduledEnd` всегда `scheduledStart + durationMinutes`, вычислено через `addMinutes`, не через ручную арифметику с миллисекундами.

---

### S2-06 · `TaskService`

**Backlog:** MVP-008 · **Оценка:** 4 ч · **Зависит от:** S2-03, S2-04, S2-05

**Что сделать**
- `src/features/tasks/task.service.ts`: `createTask(userId, input)`, `updateTask(userId, taskId, input)`, `deleteTask(userId, taskId)`, `deactivateTask(userId, taskId)`.
- `createTask` — в одной транзакции Prisma (`prisma.$transaction`) создаёт `Task` и вызывает `occurrenceService.createForTask(...)` для первого occurrence. Если один из шагов падает — оба откатываются.
- `updateTask` — **если меняются `date`/`time`/`durationMinutes`, обновить и связанный occurrence** в той же транзакции (частая ошибка — обновить только `Task`, оставив occurrence рассинхронизированным).
- Валидация (S2-03) вызывается в сервисе, не в action — action только парсит `FormData` и передаёt дальше.
- Типизированные ошибки в `src/features/tasks/task.errors.ts` (`TaskNotFoundError`, по образцу `InvalidTimezoneError` из Sprint 1).

**Acceptance criteria**
- [ ] Изменение даты/времени задачи меняет `scheduledStart` её occurrence — проверить в БД после `updateTask`.
- [ ] Удаление несуществующей/чужой задачи выбрасывает `TaskNotFoundError`, а не тихо ничего не делает.

---

### S2-07 · `getTodayTasks` / `getUpcomingTasks` / `getOverdueTasks`

**Backlog:** MVP-009 · **Оценка:** 2 ч · **Зависит от:** S2-05

**Что сделать**
- В `occurrence.service.ts` (или отдельный `dashboard.service.ts` в `src/features/scheduling/`) — три функции, использующие `startOfDayInZone`/`endOfDayInZone` (Sprint 1) в таймзоне пользователя:
  - `getTodayTasks(userId, timezone)` — occurrences с `scheduledStart` между началом и концом сегодняшнего дня.
  - `getUpcomingTasks(userId, timezone)` — `scheduledStart` после конца сегодняшнего дня, отсортированные, с лимитом (например, 10).
  - `getOverdueTasks(userId, timezone)` — `scheduledStart` до начала сегодняшнего дня и статус всё еще `SCHEDULED` (в этом спринте это единственный сигнал «просрочено» — действий над этим списком пока нет, см. §1 п.4).

**Acceptance criteria**
- [ ] Задача, запланированная на 23:50 в зоне пользователя, попадает в «Today», даже если по UTC это уже следующий день (и наоборот) — покрыть тестом с явной зоной.

---

### S2-08 · Server actions для задач

**Backlog:** MVP-007 · **Оценка:** 2 ч · **Зависит от:** S2-06

**Что сделать**
- `src/features/tasks/actions.ts`: `createTaskAction`, `updateTaskAction`, `deleteTaskAction`, `deactivateTaskAction` — `'use server'`, получают `userId` из DAL (`getCurrentUser()`), не из аргументов формы.
- После успешного изменения — `revalidatePath` для `/dashboard`, `/tasks`, `/tasks/[id]`.
- `createTaskAction`/`updateTaskAction` возвращают состояние по образцу `UpdateTimezoneState` из Sprint 1 (`status: "idle" | "success" | "error"`, `message?`) для `useActionState` в формах.

**Acceptance criteria**
- [ ] Action, вызванный без сессии (гипотетически), не долетает до сервиса — падает на `getCurrentUser()` возвращающем `null`.

---

### S2-09 · UI-kit: `textarea`, `alert-dialog`

**Backlog:** — · **Оценка:** 1 ч · **Зависит от:** —

**Что сделать**
- `npx shadcn@latest add textarea alert-dialog` (Description в форме задачи; подтверждение удаления).

**Acceptance criteria**
- [ ] Компоненты лежат в `src/components/ui`, использованы хотя бы в одном месте (иначе тут же станет мёртвым кодом).

---

### S2-10 · `/tasks` — список задач

**Backlog:** — · **Оценка:** 3 ч · **Зависит от:** S2-04, S2-09

**Что сделать**
- `src/app/(app)/tasks/page.tsx`: `verifySession()`, список активных задач пользователя (`task.service`/`repository` через сервис), карточка на задачу с приоритетом/датой occurrence, ссылка на `/tasks/[id]`, кнопка «New task» → `/tasks/new`.
- Пустой список — empty state («No tasks yet» + ссылка на создание), без фейковых данных, по аналогии с Sprint 1 dashboard.

**Acceptance criteria**
- [ ] Страница больше не 404, пункт навигации «Tasks» ведёт на реальный список.

---

### S2-11 · `/tasks/new`

**Backlog:** MVP-007 · **Оценка:** 4 ч · **Зависит от:** S2-08, S2-09

**Что сделать**
- Поля формы строго по §16: Title, Description, Date, Time, Duration, Priority, Flexibility, Repeat, Reminder.
- Date/Time — `<input type="date">` / `<input type="time">` (без сторонней date-picker библиотеки в этом спринте — осознанное упрощение, чтобы не тащить новую зависимость на один спринт).
- **Repeat и Reminder — задизейбленные заглушки** с подписью «Coming in a later sprint», как `notification defaults`/`start-end of day` в Sprint 1 settings.
- `useActionState` + `createTaskAction`, toast об успехе (sonner, уже подключён в Sprint 1), редирект на `/tasks/[id]` созданной задачи при успехе.

**Acceptance criteria**
- [ ] Создание задачи с валидными данными приводит на страницу задачи, задача видна в `/tasks` и, если запланирована на сегодня, на `/dashboard`.
- [ ] Невалидный `durationMinutes`, отправленный в обход UI, отклоняется server action, а не только клиентской валидацией.

---

### S2-12 · `/tasks/[id]`

**Backlog:** — · **Оценка:** 4 ч · **Зависит от:** S2-08, S2-09, S2-07

**Что сделать**
- Информация о задаче (title, description, priority, flexibility, duration), ближайший occurrence (в этом спринте — единственный).
- Кнопка Edit → `/tasks/[id]/edit`.
- Deactivate — сразу вызывает `deactivateTaskAction` (не деструктивно, обратимо в БД хоть и без UI для реактивации в этом спринте).
- Delete — **через `AlertDialog`** (S2-09) с явным подтверждением («This will permanently delete the task and its schedule»), только после этого вызывает `deleteTaskAction`.
- Доступ к чужой/несуществующей задаче — `notFound()` (Next.js), не 500.

**Acceptance criteria**
- [ ] Delete без подтверждения в диалоге не удаляет задачу.
- [ ] После deactivate задача пропадает из `/tasks` и `/dashboard`, но не из БД.
- [ ] Прямой заход на `/tasks/<чужой-id>` даёт 404, а не данные другого пользователя.

---

### S2-13 · `/tasks/[id]/edit`

**Backlog:** — · **Оценка:** 3 ч · **Зависит от:** S2-11

**Что сделать**
- Переиспользовать форму из S2-11 (выделить общий `TaskForm` компонент, принимающий `defaultValues` и разный submit-action/лейбл кнопки: «Create» vs «Save»), а не дублировать разметку.
- `updateTaskAction`, редирект на `/tasks/[id]` после сохранения.

**Acceptance criteria**
- [ ] Изменение даты/времени в форме и последующий Save видно на `/dashboard` (задача перемещается между Today/Upcoming/Overdue соответственно).

---

### S2-14 · `/dashboard` на реальных данных

**Backlog:** MVP-009 · **Оценка:** 3 ч · **Зависит от:** S2-07

**Что сделать**
- Заменить статичные карточки Sprint 1 на реальные `getTodayTasks`/`getOverdueTasks`/`getUpcomingTasks`.
- Порядок секций как в §16: Today, Overdue, (Quick Add), Upcoming.
- Quick Add — включить кнопку (`disabled` убрать), сделать ссылкой на `/tasks/new` (полноценный inline quick-add — не в этом спринте, отметить как возможное улучшение).
- Пустые секции — тот же empty state, что был в Sprint 1 («No tasks yet»), без фейковых данных.

**Acceptance criteria**
- [ ] Задача, созданная через `/tasks/new` на сегодня, сразу видна в Today на дашборде после редиректа/ревалидации.
- [ ] Задача с датой в прошлом и статусом `SCHEDULED` видна в Overdue.

---

### S2-15 · Тесты

**Backlog:** — · **Оценка:** 2 ч · **Зависит от:** S2-02, S2-03

**Что сделать**
- Unit-тест на `zonedDateTimeToUtc` — DST-переход (по аналогии с существующими тестами Sprint 1 для `addDaysInZone`).
- Unit-тест на границы `durationMinutes` (0, 1440, 1441 → ошибка) в `createTaskSchema`.

**Acceptance criteria**
- [ ] `npm run test` включает новые тесты и остаётся зелёным с фиксированным `TZ=UTC`.

---

## 4. Не входит в Sprint 2

Сознательно откладываем: статусы выполнения occurrence и действия над ними — complete/skip/partial (Sprint 3); conflict detection и диалог конфликтов (Sprint 4); генерация нескольких occurrences из `recurrenceRule` (Sprint 5); модель `Notification`, воркер напоминаний, snooze (Sprint 6); аналитика 7 дней, mobile polish, тесты фич (Sprint 7); содержимое `/calendar` (отдельная, пока не запланированная задача, вне Task/Dashboard scope этого спринта).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Наивная склейка `Date` + `Time` без учёта зоны пользователя | Задачи создаются со смещением на часовой пояс сервера | Единая функция `zonedDateTimeToUtc` в `lib/date` (S2-02), grep-проверка на `new Date(` в task-коде |
| Рассинхронизация `Task` и его единственного `TaskOccurrence` при редактировании даты/времени | Дашборд показывает старое время задачи | `updateTask` обновляет оба в одной транзакции (S2-06) |
| FK-ошибка при удалении задачи с occurrence | Delete не работает / 500-ошибка | `onDelete: Cascade` в схеме явно (S2-01), не полагаться на дефолт из §10 плана |
| `/tasks` без явного описания в §16 плана реализована непоследовательно (то список, то что-то другое) | Несогласованный UX | Зафиксировано здесь в S2-10 как простой список активных задач с ссылкой на создание |

---

## 6. Предлагаемый порядок работы

| День | Задачи |
|---|---|
| 1 | S2-01, S2-02 |
| 2 | S2-03, S2-04, S2-09 |
| 3 | S2-05, S2-07 |
| 4 | S2-06 |
| 5 | S2-08, S2-10 |
| 6 | S2-11 |
| 7 | S2-12, S2-13 |
| 8 | S2-14, S2-15, прогон Sprint DoD |
