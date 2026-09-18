# Sprint 3 — Tasks: задачи

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), раздел §19 «Sprint 3 — Completion» и backlog §22 (MVP-010…MVP-013). Продолжение [sprint-2-tasks.md](./sprint-2-tasks.md) — Sprint 2 закрыт (PR [#1](https://github.com/Natalka-qa/Reminder-assistant/pull/1)), CI зелёный.

**Цель спринта:** пользователь может отмечать фактическое выполнение задачи — Done / Partial / Skip — прямо из `/dashboard` и со страницы задачи; просроченные (`Overdue`) задачи становятся действием-разрешимыми вместо чисто информационных.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` зелёные; CI на PR проходит.
- [ ] Миграций не требуется — `OccurrenceStatus` уже содержит все нужные значения (заведены в Sprint 2 заранее).
- [ ] На `/dashboard`: occurrence в `Today` и `Overdue` можно отметить Done / Partial / Skip без перезагрузки страницы.
- [ ] После отметки Done/Partial/Skip просроченная задача пропадает из `Overdue` (но не удаляется из БД).
- [ ] `/tasks/[id]` показывает статус occurrence и те же три действия, пока статус `SCHEDULED`.
- [ ] Нельзя повторно завершить/скипнуть уже завершённый occurrence (idempotency guard, типизированная ошибка, не молчаливый no-op).
- [ ] Слоистая архитектура не нарушена: Prisma-вызовы только в `*.repository.ts` (тот же grep, что в Sprint 1/2).

---

## 1. Стартовое состояние (что осталось от Sprint 2)

| Есть | Детали |
|---|---|
| `OccurrenceStatus` enum | Уже содержит `SCHEDULED / DONE / PARTIALLY_DONE / SKIPPED / SNOOZED / CANCELLED` — заведён в Sprint 2 (S2-01) заранее, чтобы не мигрировать второй раз |
| `TaskOccurrence.completedAt` | Поле в схеме есть с Sprint 1-плана, но сервис его никогда не устанавливает |
| `occurrence.repository.ts` | `create`, `findByTaskId`, `update`, `findForUserBetween`, `findUpcomingForUser`, `findOverdueForUser` — **нет** `findById` для одного occurrence по id |
| `occurrence.service.ts` | Только `createForTask` — нет методов перехода статуса |
| `dashboardService.getOverdueTasks` | Уже фильтрует `status: SCHEDULED` — значит после смены статуса overdue-пункт сам пропадёт из списка без дополнительных правок запроса |
| `/dashboard` | Today / Overdue / Upcoming — список без действий, просто ссылка на `/tasks/[id]` |
| `/tasks/[id]` | Показывает ближайший occurrence, без статуса и действий над ним |

### Расхождения плана / решения на этот спринт

1. **Snooze не входит.** Snooze в §2.11 плана привязан к `Notification` (Sprint 6) — «после напоминания пользователь может перенести его». Без напоминаний snooze не имеет смысла как отдельное действие; `OccurrenceStatus.SNOOZED` остаётся неиспользуемым до Sprint 6.
2. **Completion rate / 7-дневная аналитика — Sprint 7** (§17 плана, явно после Sprint 3 в порядке разработки, backlog MVP-024). В этом спринте только сами действия, без счётчиков.
3. **Действия доступны только для `Today` и `Overdue`.** `Upcoming` — задачи в будущем, отмечать их выполненными раньше времени не входит в сценарий плана (§2.12/§7); кнопки там не показываем.
4. **Undo не входит.** План не описывает отмену Done/Partial/Skip в MVP; после перехода из `SCHEDULED` статус финален до тех пор, пока это не понадобится явно (можно добавить позже отдельной задачей).
5. **`completedAt`** проставляется для `DONE` и `PARTIALLY_DONE` (пользователь физически что-то сделал в это время), но не для `SKIPPED` (ничего не сделано).

---

## 2. Обзор задач

| ID | Задача | Backlog | Оценка | Зависит от |
|---|---|---|---|---|
| S3-01 | `occurrence.repository.ts`: добавить `findById` | — | 0.5 ч | — |
| S3-02 | `occurrence.errors.ts`: типизированные ошибки | — | 0.5 ч | — |
| S3-03 | `lib/scheduling/occurrence-status.ts`: чистая функция-guard перехода статуса + тест | — | 1 ч | — |
| S3-04 | `OccurrenceService`: `completeOccurrence` / `partiallyCompleteOccurrence` / `skipOccurrence` | MVP-010, MVP-011, MVP-012, MVP-013 | 2 ч | S3-01, S3-02, S3-03 |
| S3-05 | Server actions для occurrence | MVP-011, MVP-012, MVP-013 | 1.5 ч | S3-04 |
| S3-06 | `OccurrenceActions` — общий UI-компонент (Done/Partial/Skip + read-only статус) | — | 2 ч | S3-05 |
| S3-07 | `/dashboard`: подключить `OccurrenceActions` в Today и Overdue | MVP-009 | 1.5 ч | S3-06 |
| S3-08 | `/tasks/[id]`: статус occurrence + `OccurrenceActions` | — | 1 ч | S3-06 |
| S3-09 | Тесты | — | включено в S3-03 | S3-03 |

**Итого:** ≈ 10 ч.

**Критический путь:** S3-01/S3-02/S3-03 → S3-04 → S3-05 → S3-06 → S3-07/S3-08 (параллелятся).

---

## 3. Задачи

### S3-01 · `occurrence.repository.ts`: `findById`

**Оценка:** 0.5 ч

**Что сделать**
- Добавить `findById(id: string, userId: string, db: Db = prisma)` — `findFirst({ where: { id, userId }, include: { task: true } })` (включаем `task`, чтобы actions могли получить `taskId` для `revalidatePath` без второго запроса).

**Acceptance criteria**
- [ ] Запрос с чужим `userId` возвращает `null`.

---

### S3-02 · `occurrence.errors.ts`

**Оценка:** 0.5 ч

**Что сделать**
- `OccurrenceNotFoundError` — по образцу `TaskNotFoundError`.
- `InvalidOccurrenceTransitionError` — «occurrence уже в терминальном статусе, повторное действие недопустимо».

---

### S3-03 · Guard перехода статуса (чистая функция)

**Оценка:** 1 ч

**Что сделать**
- `src/features/scheduling/occurrence-status.ts`: `canTransitionFromScheduled(status: OccurrenceStatus): boolean` — `true` только для `SCHEDULED`. Чистая функция без Prisma/БД, чтобы её можно было юнит-тестировать напрямую (в проекте нет мока БД — только так покрывается тестом переход-guard).

**Acceptance criteria**
- [ ] Тест: `SCHEDULED` → `true`; `DONE` / `PARTIALLY_DONE` / `SKIPPED` / `SNOOZED` / `CANCELLED` → `false`.

---

### S3-04 · `OccurrenceService`: переходы статуса

**Backlog:** MVP-010, MVP-011, MVP-012, MVP-013 · **Оценка:** 2 ч · **Зависит от:** S3-01, S3-02, S3-03

**Что сделать**
- `completeOccurrence(userId, occurrenceId)` → статус `DONE`, `completedAt = now`.
- `partiallyCompleteOccurrence(userId, occurrenceId)` → статус `PARTIALLY_DONE`, `completedAt = now`.
- `skipOccurrence(userId, occurrenceId)` → статус `SKIPPED`, `completedAt` не трогаем.
- Каждый метод: найти occurrence через `findById` (S3-01) → если `null`, `OccurrenceNotFoundError`; если `!canTransitionFromScheduled(occurrence.status)` (S3-03), `InvalidOccurrenceTransitionError`; иначе `occurrenceRepository.update(...)`.

**Acceptance criteria**
- [ ] Повторный вызов `completeOccurrence` на уже `DONE` occurrence выбрасывает `InvalidOccurrenceTransitionError`, не перезаписывает `completedAt`.
- [ ] Вызов на чужом/несуществующем occurrence выбрасывает `OccurrenceNotFoundError`.

---

### S3-05 · Server actions

**Backlog:** MVP-011, MVP-012, MVP-013 · **Оценка:** 1.5 ч · **Зависит от:** S3-04

**Что сделать**
- `src/features/scheduling/actions.ts`: `completeOccurrenceAction(occurrenceId)`, `partialOccurrenceAction(occurrenceId)`, `skipOccurrenceAction(occurrenceId)` — `'use server'`, `userId` из DAL, вызывают сервис, ловят `OccurrenceNotFoundError` / `InvalidOccurrenceTransitionError` → `{ status: "error", message }`.
- При успехе — `revalidatePath("/dashboard")`, `revalidatePath("/tasks")`, `revalidatePath(`/tasks/${taskId}`)` (taskId из occurrence, включённого в S3-01). Без редиректа — пользователь остаётся на месте (dashboard или task detail).

**Acceptance criteria**
- [ ] Action без сессии не долетает до сервиса.

---

### S3-06 · `OccurrenceActions` — UI-компонент

**Оценка:** 2 ч · **Зависит от:** S3-05

**Что сделать**
- `src/components/scheduling/occurrence-actions.tsx`: клиентский компонент `{ occurrenceId, status }`.
  - Если `status === "SCHEDULED"` — три кнопки: Done / Partial / Skip (`useTransition`, вызывают actions напрямую, по образцу `TaskActions` из Sprint 2), toast об ошибке при неудаче.
  - Иначе — статичный бейдж с результатом (`Done` / `Partial` / `Skipped`), без кнопок (idempotency на уровне UI — тот же guard, что и на сервере).

**Acceptance criteria**
- [ ] После успешного действия кнопки заменяются на бейдж без перезагрузки страницы (за счёт `revalidatePath` + ре-рендера серверного компонента).

---

### S3-07 · `/dashboard`: действия в Today и Overdue

**Backlog:** MVP-009 · **Оценка:** 1.5 ч · **Зависит от:** S3-06

**Что сделать**
- В `OccurrenceList` (dashboard) подключить `OccurrenceActions` для секций `Today` и `Overdue`. `Upcoming` — без изменений (без действий, см. §1 п.3).
- `Today` показывает occurrence независимо от статуса (в том числе уже `DONE`/`SKIPPED` — как выполненный/скипнутый пункт сегодняшнего дня, не исчезает из списка).
- `Overdue`-запрос уже фильтрует `status: SCHEDULED` (Sprint 2) — как только статус меняется, пункт сам пропадает из списка при следующем рендере.

**Acceptance criteria**
- [ ] Просроченная задача, отмеченная Done, пропадает из Overdue после действия, задача остаётся в БД.
- [ ] Задача на сегодня, отмеченная Done, остаётся видна в Today с бейджем `Done`.

---

### S3-08 · `/tasks/[id]`: статус + действия

**Оценка:** 1 ч · **Зависит от:** S3-06

**Что сделать**
- В карточке «Scheduled» показать текущий статус occurrence и `OccurrenceActions`.

**Acceptance criteria**
- [ ] Действие на странице задачи и на дашборде дают одинаковый результат (общий сервис/action).

---

## 4. Не входит в Sprint 3

Sознательно откладываем: `Snooze` (привязан к `Notification`, Sprint 6); completion rate / 7-дневная статистика (Sprint 7); conflict detection (Sprint 4); recurrence/множественные occurrences (Sprint 5); undo для Done/Partial/Skip (не описано в плане, добавим отдельной задачей при необходимости).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Повторное завершение уже завершённого occurrence (двойной клик, race condition) | `completedAt` перезаписывается, некорректная история | Guard `canTransitionFromScheduled` на уровне сервиса (S3-03/S3-04), а не только UI |
| `Today` неявно фильтрует по статусу и прячет выполненные задачи | Пользователь теряет уверенность, что задача была создана/выполнена | Явно: `Today` показывает все статусы, `Overdue` — только `SCHEDULED` (см. S3-07) |

---

## 6. Предлагаемый порядок работы

| День | Задачи |
|---|---|
| 1 | S3-01, S3-02, S3-03, S3-04 |
| 2 | S3-05, S3-06 |
| 3 | S3-07, S3-08, прогон Sprint DoD |
