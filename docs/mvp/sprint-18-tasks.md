# Sprint 18 — Задачи без времени («Any time»)

Источник: решение 2026-10-02: «задачи без времени точно должны быть — например, купить что-то или придумать план». Это отменяет решение A от 2026-09-25 («у задачи всегда есть время», `new-task-fields.ts:167`). Дизайн для таких задач уже есть в хэндоффе 5 (`~/Downloads/design_handoff_reminder_assistant 5/`), тогда его сознательно не стали делать:
- `NEW_TASK_V2_UPDATE.md` §4: Time — «09:00» или «Any time», крестик `aria-label="Remove time"` → у задачи нет времени; без ввода — дата сегодня, **времени нет**, длительности нет.
- §5: «Fixed if a time is set, Flexible if not».
- §6: напоминания **без времени** — «No reminder · That morning, 09:00 · Evening before, 19:00», по умолчанию «No reminder»; со временем — «No reminder · At start time · 5/10/15/30 min · 1 hour · 1 day before».
- §11, примеры: «Buy groceries» → сегодня, Any time, Flexible, без напоминания; «Pay rent on October 1» → Oct 1, Any time; «Take vitamins every morning» → каждый день, без времени.
- `CALENDAR_V2_UPDATE.md` §2.3 — строка «Any time» над сеткой недели (только если в неделе есть такие задачи), §3 — блок «Any time» над сеткой дня на телефоне.
- `TASKS_V2_UPDATE.md` (хэндофф 4): сортировка «время (без времени — последними)», в мете вместо времени — «Flexible».

Порядок спринтов утверждён 2026-10-02: 17 (Google и привычки во времени) → **18 (этот)** → 19 (один день серии, Undo, Deactivate — [sprint-19-tasks.md](./sprint-19-tasks.md)) → 20 (курсы и сроки — [sprint-20-tasks.md](./sprint-20-tasks.md)) → 21 (трекер привычек — [sprint-21-tasks.md](./sprint-21-tasks.md)); 20 и 21 переставлены 2026-10-03.

**Цель спринта:** задачу можно записать без времени — «купить продукты», «придумать план отпуска» — на день, как в списке дел. Она видна в этот день везде, где видны задачи, не мешает пересечениям и поиску времени и напоминает утром или накануне вечером, если попросить.

- В форме у времени есть «Any time» и крестик «Remove time». Без ввода задача создаётся без времени.
- Задача без времени — всегда Flexible. Она не пересекается с другими задачами и с Google. Просроченной она становится только после конца дня.
- Calendar — строка «Any time» над сеткой. Home — блок «Any time» в дне. Tasks — в конце дня, «Flexible» вместо времени. Бот — «Anytime» в `/today` и сводке.
- Напоминания: «No reminder» (теперь и у задач со временем, как в хэндоффе), «That morning, 09:00», «Evening before, 19:00» — по местному времени.
- Одна миграция, только добавления.

**Sprint Definition of Done**

- [x] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит. *(Локально — все пять, 690 → 749 тестов; CI на PR [#34](https://github.com/Natalka-qa/Reminder-assistant/pull/34) — `ci`, Vercel, Vercel Preview Comments зелёные; смержен 2026-10-02, `341f360`.)*
- [x] Миграция применена на `dev`, потом на проде; существующие задачи и напоминания не изменились (сверка до/после). *(`dev` — S18-01. Прод — превью #34 выполнило `migrate deploy`: последняя миграция в базе прода — `20261002201247_add_untimed_tasks`; все 26 задач — `hasTime = true`, `reminderKind = OFFSET`, то есть как были. На проде 2026-10-03 пользователь создал задачу без времени — создаётся и видна в Calendar.)*
- [x] «Buy groceries» в New task → сегодня, Any time, Flexible, No reminder; «Pay rent on October 1» → Oct 1, Any time; «Take vitamins every morning» → каждый день, без времени. Время можно убрать крестиком и вернуть. *(S18-04.)*
- [x] Задача без времени видна в свой день: Home (блок «Any time»), Tasks (в конце дня, «Flexible»), Calendar (строка «Any time»; на телефоне — блок над сеткой; в Month — в сводке дня), `/today` и утренняя сводка («Anytime»). *(S18-05…S18-08, проверка S18-11.)*
- [x] Она не участвует в пересечениях («Overlaps with…», «N at the same time», подсказка на Home), в поиске свободного времени и в «Free after»; диапазон сетки Calendar из-за неё не расширяется. *(Фильтр в `findOverlapping` (S18-02), Home/Tasks/Calendar — S18-05…S18-07; сетка в S18-11 — с 07:00.)*
- [x] Просроченная — только после конца своего дня, с подписью «Overdue since Oct 1» без времени; «Move to today» оставляет её без времени. *(S18-05, S18-06.)*
- [x] Повторяющаяся без времени создаётся, продлевается cron и меняется в правке; сегодняшний день не теряется (сравнения «ещё впереди» по дате, не по `now`). *(S18-02; продление — тем же `buildCandidateIntervals` с `time: null`, отдельно cron вживую не запускался.)*
- [ ] «That morning, 09:00» и «Evening before, 19:00» приходят вовремя (почта и Telegram) с текстом без времени; «No reminder» не создаёт напоминания; «Snooze → tomorrow» у задачи без времени — на 09:00 следующего дня. *(Время отправки, «No reminder», Snooze и тексты — S18-03. Настоящая отправка письма/Telegram — не делалась, нужен твой «да».)* *(2026-10-04: проверка на проде — у пользователя: задача без времени на 5 окт с «That morning» (Telegram 5 окт 09:00) и на 6 окт с «Evening before» (Telegram 5 окт 19:00). Письмо не проверяется — у пользователя на проде выключены «Email reminders». Записать результат.)*
- [x] Смена часового пояса в настройках не переносит задачи без времени на другой день. *(S18-02, в транзакции с откатом; напоминания с фиксированным часом пересчитываются — S18-03.)*
- [x] Паттерны (Progress, подсказка на Home) не относят задачи без времени к «поздним»: в части дня они не считаются. *(S18-09; Home — S18-05.)*
- [x] Контраст новых элементов — AA; на 390 px без горизонтальной прокрутки. *(Новые подписи — `--newtask-quiet-text` / `--calendar-quiet-text` (≈5.1:1), названия — `--text-primary`; `scrollWidth` = 390 на форме, Home и Calendar.)*
- [x] Новые тесты — только на чистую логику. *(59 новых.)*

---

## 1. Стартовое состояние (аудит по факту, 2026-10-02)

| Область | Что нашли |
|---|---|
| **Модель** | `TaskOccurrence.scheduledStart DateTime` (обязателен), `scheduledEnd DateTime?`, индекс `[userId, scheduledStart]`; `Task.durationMinutes Int @default(0)`; `Notification.sendAt` обязателен. Время хранится как момент в UTC; дата и время соединяются только в `zonedDateTimeToUtc` (`lib/date`). |
| **Запросы** | `occurrence.repository.ts`: `findForUserBetween` (границы дня — Home, Calendar, `/today`, сводка), `findOutcomesBetween` (берёт только `status` и `scheduledStart`), `findUpcomingForUser`, `findOverdueForUser` (`scheduledStart < начала сегодня`), `findOverlapping`, агрегаты `findMax/MinScheduledStartForTask` (якорь продления серии). |
| **Валидация** | `lib/validation/task.ts`: `time` обязателен (HH:mm), `durationMinutes` 0–1440, `flexibility` и `priority` обязательны, `reminderOffsetMinutes` 0–1440. Одна схема на создание и правку. |
| **Форма** | `newTaskDefaults` — следующий полный час (после 23:00 — завтра 09:00). `resolveTaskFields`: Fixed, если время из текста или руками, иначе Flexible. `when-group.tsx` — время всегда, комментарий «there's no remove-time button». Проверка пересечений в форме — по дате и времени (`previewOverlaps`, 400 мс). `REMINDER_CHOICES` без «No reminder» (решение B). |
| **Разбор фраз** | Нет времени во фразе → `time` не задаётся, форма подставляет значение по умолчанию. «every morning» / «каждое утро» / «щоранку» → `DAILY`, часть дня отбрасывается. «утром» само по себе значимо только в поиске времени. |
| **Повторения** | Даты — без времени (`generateOccurrenceDates`), время подставляется в `buildCandidateIntervals`. Продление берёт время у последнего повторения (`formatTimeInZone(maxStart)`). `planScheduleChange` заменяет и сохраняет по `scheduledStart > now`. |
| **Сравнения с `now`** | `planScheduleChange`, `rescheduleForTask`, `cancelFutureOccurrences`, `cascadeDurationChange`, `pickCurrentOccurrence` — все по `scheduledStart > now`. Если хранить задачу без времени как полночь, сегодняшний день для них «уже прошёл». |
| **Пересечения** | `findOverlapping`, `findConflicts`, `recurringOverlapDays`, `findBusyOverlaps`, `busyTasks` в `slot.service.ts`, `findMoveTime` — по интервалам. Полночь без длительности «пересеклась» бы с событием Google на весь день или с задачей через полночь. |
| **Home** | `selectUpNext` — первая открытая после 09:00, иначе самая ранняя: день только из задач без времени дал бы «00:00 · now». `groupRemainingByTime` группирует по точному моменту: все задачи без времени склеились бы в «N at the same time» и подняли бы подсказку о пересечении. «Free after» — по `latestOccurrenceEnd`. `patternInsight` — по части дня (полночь — «late»). Просроченные — `< начала сегодня` (дата подходит), но подпись «Overdue since LLL d, HH:mm». |
| **Tasks** | Комментарий `task-list-view.ts:31-32`: правила хэндоффа «без времени — последними» и «Flexible вместо времени» — «never apply»; можно вернуть. Сортировка по моменту, «Same time as…» по точному моменту, мета с временем, колонка времени в Today. `move-to-today.ts` сохраняет время на стене. |
| **Calendar** | `startMinutes` из местного часа; `timelineRange` расширяется под самое раннее начало — полночь растянула бы сетку на всю неделю. Заглушка `week-calendar.tsx:178`: строки «Any time» нет, «would never render». |
| **Напоминания** | `computeSendAt = scheduledStart − offset`; полночь дала бы напоминание в 00:00 или 23:45. Текст с временем — тост, письмо (`reminder-email.ts`: «Reminder: X at HH:mm»), Telegram (`reminder-telegram-message.ts`). «Snooze → tomorrow» = `scheduledStart + 1 день`. |
| **Telegram** | `DayItem.time: string \| null` и «Anytime» уже есть в `bot-messages.ts`, но `dayItem` всегда ставит время. `/next` — первая с `scheduledStart >= now`. Сводка — кнопки «✓ HH:mm Title». Фраза без времени в чате → следующий полный час (`newTaskDefaults`). «+1 h» — только при времени. |
| **Паттерны** | `partOfDayOf` по часу начала; «missed» — по началу дня (подходит). `findOutcomesBetween` должен отдавать признак «без времени». |
| **Смена пояса** | `user.service.ts:27` меняет пояс без пересчёта задач. Полночь старого пояса в новом может оказаться вчерашним вечером. |
| **Паттерн тестов** | Только чистая логика. |

### Расхождения / решения на этот спринт

Нужны решения — у каждого рекомендация.

**Модель**

1. **Как хранить.** Вариант (а): `scheduledStart` — местная полночь дня, плюс признак `Task.hasTime Boolean @default(true)`. Все запросы «за день» и «просроченные» работают без изменений. Вариант (б): `scheduledStart` nullable — тогда нужна ещё отдельная колонка даты, а ломается каждый запрос (агрегаты пропускают `NULL`, сортировка). Рекомендация: (а). Признак — у задачи, а не у повторения: у серии все дни одного вида (так же решено в Sprint 19 п.3). Фильтр в SQL — через связь (`task: { hasTime: true }`), отдельная копия признака в повторении не нужна.
2. **Признак явный, не «00:00».** Задача со временем ровно в 00:00 остаётся задачей со временем. В поясах, где переводят саму полночь, «полночь» — первый момент дня (`startOfDayInZone`), как уже сделано в `busyByDay` (S17-01).
3. **Конец и длительность.** У задачи без времени `scheduledEnd = null`. Длительность можно указать («2 hours» на «придумать план»), она показывается в мете, но интервала не создаёт. Рекомендация: так.
4. **«Ещё впереди» — по дате.** Одна чистая функция `isAhead(occurrence, hasTime, now, timezone)`: со временем — `scheduledStart > now`, без времени — дата не раньше сегодня. Ей заменяются все сравнения из §1 («Сравнения с `now`»). Рекомендация: так — иначе правка серии теряла бы сегодняшний день.
5. **Смена часового пояса.** При смене пояса будущие повторения задач без времени переносятся на полночь того же дня в новом поясе, а их напоминания пересчитываются. Рекомендация: так. Прошлые не трогаем: это история.

**Форма и разбор фраз**

6. **По умолчанию — без времени.** Как в хэндоффе: без ввода — сегодня, Any time, без длительности. Время ставится, только если оно есть во фразе или выбрано руками. Это меняет нынешнее «следующий полный час». Рекомендация: так.
7. **«Any time» и крестик.** Кнопка времени показывает «Any time» (`--text-secondary`). Крестик «Remove time» (32 px, `aria-label`) — рядом с выбранным временем. Подсказка «No date or time found — set them below, or leave it for today.» остаётся.
8. **Без времени — всегда Flexible.** Карточка Fixed недоступна, подпись «Tasks without a time are flexible». Хэндофф говорит только «Flexible if not» как значение по умолчанию; Fixed без времени ничего не значит. Рекомендация: так.
9. **Разбор.** Фраза без времени → без времени (а не следующий час). «every morning» → каждый день без времени (пример 5 хэндоффа). Связать «утром» с напоминанием «That morning» — §4.
10. **Правка.** Время можно убрать или поставить и у существующей задачи. У серии это смена расписания: будущие дни заменяются, как при смене времени сейчас.

**Напоминания**

11. **Виды напоминаний.** `enum ReminderKind { NONE, OFFSET, MORNING_OF, EVENING_BEFORE }`, `Task.reminderKind @default(OFFSET)`. `reminderOffsetMinutes` остаётся для `OFFSET`. `NONE` — напоминание не создаётся. Рекомендация: так.
12. **Списки — как в хэндоффе.** Без времени: No reminder (по умолчанию) · That morning, 09:00 · Evening before, 19:00. Со временем: **No reminder** · At start time · 5/10/15/30 min · 1 hour · 1 day before; по умолчанию — из настроек. «No reminder» у задач со временем раньше не делали, потому что его было не выразить (решение B Sprint 14). Теперь его можно хранить. Рекомендация: добавить, как в хэндоффе. «Default reminder» в настройках — без «No reminder»: это значение для задач со временем.
13. **Расчёт.** `computeSendAt(start, { kind, offsetMinutes }, timezone)`: 09:00 в день задачи и 19:00 накануне — по местному времени, через `lib/date` с учётом перевода часов. Если время напоминания уже прошло (задачу создали в 10:00 на сегодня с «That morning»), напоминание не создаётся, а форма предупреждает: «09:00 has already passed today.» Рекомендация: так.
14. **Тексты без времени.** Письмо и Telegram: «Reminder: Buy groceries — today» / «— tomorrow» вместо «at HH:mm». Тост — то же.
15. **«Snooze → tomorrow»** у задачи без времени — 09:00 следующего дня по местному времени. Остальные варианты (15/30/60 мин) — как сейчас.

**Где видно**

16. **Пересечения и поиск — без задач без времени.** Они пропускаются везде, где считаются интервалы: проверки при создании и правке, `previewOverlaps`, повторяющиеся пересечения, занятость в поиске слотов, `findMoveTime`, «N at the same time», «Same time as…». В форме без времени «Overlaps with…» не запрашивается. Рекомендация: так.
17. **Home.**
    - Блок «Any time» в дне: строки с кружком выполнения, после задач со временем (или вместо них, если их нет).
    - Up next — только задачи со временем; если их не осталось — первая открытая без времени с подписью «Any time today».
    - «Free after» и подсказки — без задач без времени.
    - Число «N things today» — со всеми задачами.
    - Подпись просроченной — «Overdue since Oct 1» без времени.
    - Рекомендация: так. Хэндофф Home v2 об этом молчит.
18. **Tasks.** Как в хэндоффе 4: в дне — последними, в мете «Flexible» вместо времени. В колонке времени (Today) — «Any time». «Move to today» оставляет задачу без времени.
19. **Calendar.**
    - _Утверждено 2026-10-02:_ одна строка «Any time» — в ней и задачи без времени, и «Busy», если день в Google занят целиком (см. «Сверка §1 с Sprint 17» в S18-00).
    - Неделя на десктопе — строка «Any time» по §2.3 хэндоффа: только если в неделе есть такие задачи; подпись «ANY TIME» в колонке часов; до 2 строк на название; кружок (пунктир) — только у выбранного дня.
    - Телефон — блок над сеткой дня (§3).
    - Month — в сводке дня строки без времени, последними, «Any time».
    - Диапазон сетки и плотность дня (`busyLevel`): в плотности они считаются, в диапазоне — нет.
    - Рекомендация: так. Цвет подписи — `#6B686D` вместо `#8A868B` хэндоффа, ради контраста AA (как в решении 2026-09-25).
20. **Telegram.**
    - `/today` и сводка: задачи без времени — «Anytime», после задач со временем.
    - Кнопка в сводке — «✓ Buy groceries».
    - `/next`: сначала ближайшая со временем после текущего момента. Если таких нет — первая открытая без времени на сегодня. Если и таких нет — самая ранняя прошедшая.
    - Фраза в чате без времени → без времени, как в форме (меняет поведение Sprint 15).
    - Под новой задачей без времени — Undo · Tomorrow · Open, без «+1 h».
    - Рекомендация: так.
21. **Паттерны.** В частях дня (утро/день/вечер/поздно) задачи без времени не считаются. В общем проценте, буднях и выходных — считаются. В «обычном времени тренировок» (Sprint 17 п.10) — не считаются. Рекомендация: так.

**Миграция**

22. **Одна миграция, только добавления:** `Task.hasTime Boolean @default(true)`, `enum ReminderKind`, `Task.reminderKind ReminderKind @default(OFFSET)`. Существующие задачи остаются со временем и с напоминанием «за N минут». Превью PR применяет миграции к базе прода (Sprint 16), поэтому PR открывается, когда миграция окончательная. Рекомендация: так.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S18-00 | Предпроверки: Sprint 17 смержен, ветка от `main`, `NEON_BRANCH=dev`; гайды Prisma по enum и миграциям | 0.5 ч | — |
| S18-01 | Миграция: `hasTime`, `ReminderKind`, `reminderKind` — на `dev`, сверка | 0.5 ч | S18-00 |
| S18-02 | Ядро: валидация без времени, создание и правка, серия без времени, `isAhead`, пересечения без них, смена пояса (+ тесты) | 3 ч | S18-01 |
| S18-03 | Напоминания: виды, `computeSendAt` с поясом, No reminder, Snooze → tomorrow, тексты письма и Telegram (+ тесты) | 2.5 ч | S18-01 |
| S18-04 | Форма New task и правка: Any time и крестик, значения по умолчанию, Flexible, списки напоминаний; разбор фраз (+ тесты) | 2.5 ч | S18-02, S18-03 |
| S18-05 | Home: блок «Any time», Up next, «Free after», подсказки, подпись просроченной (+ тесты) | 2 ч | S18-02 |
| S18-06 | Tasks: сортировка, мета, колонка, «Move to today» (+ тесты) | 1.5 ч | S18-02 |
| S18-07 | Calendar: строка «Any time» (неделя), блок (телефон), сводка дня (Month) (+ тесты) | 2 ч | S18-02 |
| S18-08 | Telegram: `/today`, `/next`, сводка, фраза в чате, кнопки новой задачи (+ тесты) | 1.5 ч | S18-02, S18-03 |
| S18-09 | Паттерны без задач без времени в частях дня (+ тесты) | 0.5 ч | S18-01 |
| S18-10 | README: «Creating a task», «Reminders», «Telegram bot», «Your patterns» | 0.5 ч | всё выше |
| S18-11 | Живая проверка на `dev` + прогон Sprint DoD; после мержа — миграция на проде и сверка | 1.5 ч | всё выше |

Итого ~18.5 ч — больше прикидки (14–16 ч): задачи без времени затрагивают почти каждый экран и бота. Если нужно сократить: S18-08 (бот) можно отдать в Sprint 19, а боту пока оставить задачи без времени в `/today` с «Anytime» — это почти бесплатно.

---

## 3. Задачи

### S18-00 · Предпроверки

**Что сделать**
- Sprint 17 смержен; ветка `sprint-18-tasks` от актуального `main`.
- `.env.local` — `NEON_BRANCH=dev`; CLI Prisma — мимо пулера (`prisma.config.ts`).
- Прочитать про `enum` и миграции в Prisma этой версии; в `node_modules/next/dist/docs/` — что нужно для форм (AGENTS.md).
- Сверить §1 с тем, что изменил Sprint 17 (занятость на Home, `busyByDay`).

**Acceptance criteria**
- [x] Ветка от `main`; `NEON_BRANCH=dev`; `prisma migrate status` — без расхождений; §1 сверен. *(2026-10-02: `sprint-18-tasks` — от `origin/main` = `9902713` (merge #33, Sprint 17); `NEON_BRANCH=dev`; `prisma migrate status` — 8 миграций, «Database schema is up to date», хост без `-pooler`. Prisma 6.19.3.)*

**Заметки по Prisma 6.19.3**
- Новый `enum` — `CREATE TYPE … AS ENUM` в той же миграции; колонка с `@default` значения enum — `NOT NULL DEFAULT '…'`, существующие строки получают значение по умолчанию без отдельного `UPDATE`.
- `prisma migrate dev` применяет миграцию к `dev` и сразу перегенерирует клиент; теневая база Neon — без ручной настройки (как в прошлых миграциях).
- `prisma format` выравнивает и чужие модели (в этот раз — поля `User`); выравнивание отменено, чтобы в диффе было только своё. `.prisma` Prettier не проверяет.

**Сверка §1 с Sprint 17** — что Sprint 17 добавил и что из этого касается задач без времени:
- Home (`dashboard/home-day.tsx`, `home-view.ts`): `latestOccurrenceEnd(tasks, busyRows)` и `findMoveTime(…, externalBusy)` — задачи без времени не должны давать «Free after 00:00» и не должны быть «занятым» временем в поиске переноса (п.16–17, S18-05); `mergeTimeline` — блок «Any time» отдельно от групп по времени, «Busy all day» из Google — рядом с ним.
- Calendar: строка «ALL DAY» с «Busy» из Google стоит ровно там, где по хэндоффу строка «Any time» (§2.3). **Дополнение к п.19:** не две строки, а одна — «Any time»: задачи без времени и, если день занят в Google целиком, «Busy» в той же клетке дня; на телефоне — блок «Any time» над сеткой и под ним строка «Busy all day · Google Calendar», как сейчас. Делается в S18-07.
- `usualWorkoutTime` (обычное время тренировок): задачи без времени не считаются — у них нет времени начала (п.21, S18-09).
- `slotNote` и порядок слотов — не затрагиваются: слоты всегда со временем.

---

### S18-01 · Миграция

**Что сделать**
- `schema.prisma`: `Task.hasTime Boolean @default(true)`, `enum ReminderKind { NONE OFFSET MORNING_OF EVENING_BEFORE }`, `Task.reminderKind ReminderKind @default(OFFSET)` (п.22).
- `prisma migrate dev` на `dev`; до и после — число задач, повторений, напоминаний по статусам.

**Acceptance criteria**
- [x] Миграция на `dev`; счётчики совпадают; у всех задач `hasTime = true`, `reminderKind = OFFSET`. *(2026-10-02: `20261002201247_add_untimed_tasks` — `CREATE TYPE "ReminderKind"`, `ALTER TABLE "Task" ADD COLUMN "hasTime" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "reminderKind" "ReminderKind" NOT NULL DEFAULT 'OFFSET'`. До и после — одинаково: задач 22 (активных 22), смещения напоминаний 0/5/15/60; повторений DONE 15, PARTIALLY_DONE 3, SCHEDULED 45, SKIPPED 4; напоминаний PENDING 30, SENT 20, CANCELLED 5. После: у всех 22 — `true/OFFSET`. lint, typecheck, 690 тестов — зелёные; код новые поля ещё не использует.)*
- **Прод:** миграция попадёт туда, как только откроется PR (превью Vercel выполняет `prisma migrate deploy` на базе прода, Sprint 16). Она только добавляет колонки со значениями по умолчанию — старый код прода с ней работает, поэтому PR можно открывать в конце спринта, как обычно, но миграцию до него больше не менять.

---

### S18-02 · Ядро

**Что сделать**
- zod: `time` необязателен; без времени — `flexibility = FLEXIBLE`, напоминание — `NONE` / `MORNING_OF` / `EVENING_BEFORE` (п.8, 12).
- `createTask` / `updateTask`: без времени — `scheduledStart` = местная полночь (`startOfDayInZone`), `scheduledEnd = null`, `hasTime = false`; снятие и установка времени у серии — через план замены (п.10).
- Серия без времени: кандидаты на полночь без конца; продление — без «времени последнего повторения».
- `isAhead` (п.4) вместо сравнений с `now` в `planScheduleChange`, `rescheduleForTask`, `cancelFutureOccurrences`, `cascadeDurationChange`, `pickCurrentOccurrence`.
- Пересечения и слоты — без задач без времени (п.16): `findOverlapping` и занятость слотов фильтруют `task.hasTime`.
- Смена пояса — перенос будущих задач без времени (п.5).

**Acceptance criteria**
- [x] Тесты: `isAhead` (сегодня, вчера, со временем); план замены серии без времени сегодня; кандидаты серии без времени; перенос при смене пояса (Мадрид → Нью-Йорк и обратно). *(2026-10-02: 690 → 702. `untimed.test.ts` — 6 (`isAhead`: со временем, сегодняшний день без времени до конца дня, вчера/завтра, день пользователя, а не UTC; `reanchorUntimed`: Мадрид ↔ Нью-Йорк, смещение нового пояса на дату после перевода часов); `occurrence-candidates` — полночь и `null` конец, оба смещения Мадрида; `occurrence-selection` — сегодняшний день без времени — «текущий»; `schedule-change` — 4: добавить/убрать время — это смена расписания, серия без времени заменяет и создаёт сегодняшний день, снятие времени оставляет прошедшее 09:00 сегодня, добавление времени заменяет сегодняшний день на 18:00.)*
- [x] На `dev`: разовая и повторяющаяся без времени создаются; правка серии (смена дней) сохраняет сегодняшний день. *(2026-10-02, скриптом через `taskService` (пятница, 2 окт, Мадрид), тестовые задачи удалены в конце:*
  - *разовая без времени (`time: ""`, прислана Fixed) → `hasTime=false`, Flexible, 2 окт 00:00 без конца, напоминаний 0;*
  - *«каждый день» без времени → 31 день с 2 окт, все 00:00 без конца;*
  - *смена на «пт и пн» → 2 окт (сегодня) остался, дальше 5 и 9 окт — 9 дней;*
  - *добавлено время 23:45 → у всех 9 дней время, конец и напоминание (9);*
  - *разовой добавлено 23:50 → Fixed, конец, напоминание; снова убрано → Flexible, полночь, напоминание отменено;*
  - *`reanchorUntimedOccurrences` Мадрид → Нью-Йорк в транзакции с откатом: `2026-10-01T22:00Z` → `2026-10-02T04:00Z` (2 окт 00:00 по Нью-Йорку); после отката — как было, пояс пользователя не менялся;*
  - *деактивация разовой без времени → сегодняшний день `CANCELLED`;*
  - *после удаления: «S18 test» — 0, повторений и напоминаний без родителя — 0, задач — 22, как до проверки.)*

**Как сделано**
- `lib/date` — `startOfLocalDate(date, zone)` (первый момент местной даты через `startOfDayInZone`); две прежние частные копии (`busy-blocks.ts`, `calendar.service.ts`) заменены им.
- `scheduling/untimed.ts` — `isAhead(occurrence, hasTime, now, timezone)` (п.4) и `reanchorUntimed` (п.5).
- `occurrence-candidates.ts` — `time: string | null`; без времени — полночь и `scheduledEnd: null`. `schedule-change.ts` — `isScheduleChange` с `null` временем; `planScheduleChange({ hadTime, time })`: заменяется по старому виду, создаётся по новому, оба через `isAhead`.
- `task.service.ts` — `createTask`/`updateTask` без времени: `hasTime`, всегда Flexible (п.8), без Google и без проверки пересечений; у серии `hasTime` меняется только вместе с планом замены (п.10); `cascadeDurationChange` — только у задач со временем; `previewRecurringOverlaps` — только дни со временем. `deactivateTask(userId, taskId, timezone)` → `cancelFutureOccurrences(task, now, timezone)`: у задачи без времени отменяется и сегодняшний день.
- `occurrence.service.ts` — кандидаты без конца не проверяются на пересечения (`findCandidateConflicts`); продление серии без времени — без «времени последнего повторения»; `reanchorUntimedOccurrences`. `occurrence.repository.ts` — `findOverlapping` фильтрует `task.hasTime` (пересечения, слоты, «Free nearby» — все через него), `findUntimedForUser`.
- `pickCurrentOccurrence(…, { hasTime, timezone })` — страница задачи и правка.
- `userService.setTimezone` — пояс и перенос дней без времени в одной транзакции.
- zod: `time` необязателен, пустая строка — «без времени».
- **Временно до S18-03:** задачам без времени напоминания не создаются (метки `TODO(S18-03)` в `occurrence.service.ts` и `task.service.ts`); у разовой задачи при снятии времени напоминание отменяется, при добавлении — создаётся, если день ещё впереди и открыт.
- Бот (`createdReply`) и `repeatHint` уже не падают на задаче без времени (без проверки пересечений, без «at HH:MM»); остальное по боту — S18-08.

---

### S18-03 · Напоминания

**Что сделать**
- `computeSendAt(start, { kind, offsetMinutes }, timezone)` (п.13) и все его вызовы; `NONE` — без строки `Notification`.
- «Snooze → tomorrow» без времени — 09:00 следующего дня (п.15).
- Тексты письма, Telegram и тоста без времени (п.14).

**Acceptance criteria**
- [x] Тесты: 09:00 и 19:00 по местному времени, оба перевода часов, накануне через границу месяца, прошедшее время — без напоминания; тексты. *(2026-10-02: 702 → 715. `reminder-rule.test.ts` — 12: NONE, OFFSET, 09:00/19:00 по Мадриду, переводы часов 25 окт и 29 мар (утро и вечер накануне в разных смещениях), вечер перед 1 ноября; прошедший фиксированный час не создаётся, опоздавшее «за N минут» — как раньше; допустимые виды со временем и без; вид по умолчанию; «today / tomorrow / Wed, Oct 7» в поясе пользователя. `reminder-email.test.ts` +1 — тема «Reminder: Buy groceries — today».)*
- [x] На `dev` — `sendAt` у каждого вида по базе. *(2026-10-02, 22:36 по Мадриду, скриптом через `taskService`, задачи удалены в конце:*
  - *без времени на завтра, «That morning» → PENDING 3 окт 09:00; «Evening before» → нет (сегодня 19:00 уже прошло, п.13); на послезавтра → 3 окт 19:00;*
  - *без времени, вид не указан → NONE, напоминаний нет;*
  - *каждый день без времени с «That morning» → 30 напоминаний с 3 окт 09:00 (сегодняшнее 09:00 прошло — не создано);*
  - *«That morning» → «Evening before» на завтра: старое CANCELLED, новое не создано (прошло); дата → послезавтра: PENDING 3 окт 19:00; → «No reminder»: CANCELLED; добавлено 18:00 и «за 30 мин» без указания вида → OFFSET, PENDING 4 окт 17:30;*
  - *без времени + OFFSET → «A task without a time is reminded that morning or the evening before.»;*
  - *«Snooze → tomorrow» у задачи без времени → PENDING 3 окт 09:00.)*
- [ ] Одно настоящее «That morning» приходит почтой и в Telegram — **в S18-11, с твоего разрешения**: это настоящее письмо на твой адрес (а Telegram на `dev` не привязан), поэтому сейчас не отправляла. Тексты проверены тестами. *(2026-10-04: проверка на проде — у пользователя: задача без времени на 5 окт с «That morning» (Telegram 5 окт 09:00) и на 6 окт с «Evening before» (Telegram 5 окт 19:00). Письмо не проверяется — у пользователя на проде выключены «Email reminders». Записать результат.)*

**Как сделано**
- `notifications/reminder-rule.ts` — `ReminderRule { kind, offsetMinutes }`, `computeSendAt(start, rule, timezone)` (п.13), `shouldCreateReminder` (прошедший фиксированный час — нет; «за N минут» — как было), `isReminderAllowed` / `defaultReminderKind` (п.12), `reminderDayLabel` (п.14).
- `notificationService.createForOccurrence(s)` принимают правило и пояс; `rescheduleForTask(task, rule, timezone)` — для каждого открытого повторения впереди (`isAhead`): переносит ожидающее, отменяет, если правило даёт «нет», создаёт, если его не было и напоминание этого повторения ещё не уходило (`hasGoneOut`: PROCESSING / SENT / FAILED) — так смена вида или времени не повторяет отправленное. Используется и правкой разовой задачи (там раньше был `TODO(S18-03)`), и сменой вида/минут у серии, и сменой пояса (фиксированный час — местное время, п.5).
- `snoozeOccurrence` — «tomorrow» без времени → 09:00 завтра по местному времени (п.15).
- `sendDueNotifications` — у задачи без времени `timeLabel` = «today / tomorrow / дата»; письмо — тема «Reminder: … — today» (`untimed`), тело «… is scheduled for today.»; Telegram и тост — тот же `timeLabel` («… is scheduled for today.»).
- zod: `reminderKind` необязателен; `taskService` берёт вид по умолчанию по наличию времени и отклоняет несовместимый (`reminderRuleFor`). «Move to today» — фиксированный час сам пропускает прошедшее.
- Метки `TODO(S18-03)` убраны.

---

### S18-04 · Форма и разбор фраз

**Что сделать**
- `when-group.tsx`: «Any time» и крестик «Remove time» (п.7); `newTaskDefaults` без времени (п.6); Scheduling без времени — только Flexible с подписью (п.8).
- Списки напоминаний по п.12; переключение времени меняет список и значение по умолчанию (No reminder ↔ из настроек), если пользователь не выбирал руками.
- «Overlaps with…» — только при времени.
- Правка: то же, плюс снятие и установка времени (п.10).
- Разбор: без времени во фразе → без времени (п.9); тесты на примеры хэндоффа 1, 3, 5.

**Acceptance criteria**
- [x] Примеры хэндоффа §11 (1–5, 9) — как описано; крестик и возврат времени; ручной выбор не перезаписывается дальнейшим вводом. *(2026-10-02: тесты `phrase-task-input` (+4, через тот же разбор, что форма): «Buy groceries» → сегодня, без времени, Flexible, `NONE`; «Pay rent on October 1» → 1 окт без времени; «Take vitamins every morning» → каждый день без времени; «Call the dentist tomorrow at 9 for 30 minutes» → 09:00, 30 мин, Fixed, «за 30 мин». Вживую — временная страница с настоящими `NewTaskForm`/`EditTaskForm` без данных (удалена; без входа сохранить нельзя, ничего не сохранялось), 390 px:*
  - *New task: «Buy groceries» → «Today · Oct 3 · Any time», Fixed недоступна (`aria-disabled`), «Tasks without a time are flexible.», Reminder — «No reminder · That morning, 09:00 · Evening before, 19:00»; в отправляемой форме `time=""`, `FLEXIBLE`, `reminderKind=NONE`;*
  - *допечатано «at 18» → 18:00 с крестиком, Fixed, «15 min before» (по умолчанию из настроек), 8 вариантов напоминания;*
  - *крестик «Remove time» → снова «Any time», Flexible, `NONE`, хотя «at 18» осталось в тексте — правка руками важнее текста (§ 8);*
  - *время выбрано в поле → 07:30, Fixed, «15 min before»;*
  - *Edit: задача без времени с «That morning» → «Any time», Flexible, «That morning, 09:00» выбрано; подсказка «09:00 that morning has already passed — no reminder.» (у страницы «сейчас» 10:00); время 18:00 → напоминание «15 min before», Fixed снова доступна.)*
- [x] 390 px без прокрутки вбок; «Any time» и подпись Flexible — контраст AA. *(`scrollWidth` = 390. «Any time», «Tasks without a time are flexible.», недоступная Fixed — `--newtask-quiet-text` (5.1:1 на фоне).)*

**Найдено при проверке:** серверное действие формы (`readTaskForm` в `features/tasks/actions.ts`) не читало новое поле `reminderKind` — форма всегда сохраняла бы вид по умолчанию. Добавлено; пачка задач («по пн в 19 и по ср в 20») идёт JSON через ту же схему и `reminderKind` уже несла.

**Как сделано**
- `new-task-fields.ts`: `newTaskDefaults(today)` → без времени (п.6; «следующий полный час» и решение A убраны). `resolveTaskFields`: `time: string | null`, крестик — `overrides.time = null` (правка руками), без времени — всегда Flexible (п.8); напоминание — `ReminderChoice { kind, offsetMinutes }`: выбранное руками, пока подходит ко времени, иначе «за N минут» из настроек со временем и «нет» без (`fittingReminder`). `reminderOptions(hasTime, keep)` — списки п.12 (со временем — «No reminder» + минуты + своё значение задачи, если его нет в списке; без — «нет / утро / вечер»), `reminderValue` / `parseReminderValue` — значение `<select>`. `pastNotice` без времени — только прошедшая дата; `reminderPastNotice` — п.13. `taskInput` — без времени `time` не передаётся, `reminderKind` передаётся. `reminderLabel` перенесён сюда из `edit-task-fields.ts`.
- `edit-task-fields.ts`: `time: string | null` (у задачи без времени — `null`, а не её полночь), `reminder` вместо `reminderOffsetMinutes`; `reminderChoicesFor` заменён на `reminderOptions`.
- Компоненты: `WhenGroup` — «Any time» и крестик «Remove time» (32 px, `aria-label`); `SchedulingChoice` — `fixedUnavailable`; `TaskDetailsFields` — значение напоминания строкой. Формы New task и Edit — скрытые поля `time` (пусто без времени) и `reminderKind`; «Overlaps with…» — только со временем; в Edit смена времени подстраивает напоминание (`fittingReminder`).
- Страница задачи: «Reminder» — `formatReminder(kind, minutes)` («No reminder», «That morning, 09:00», «Evening before, 19:00» или минуты, п.13).
- Бот: «+1 h» у задачи без времени — `null` (кнопки и так нет), `shiftedTaskInput` передаёт `reminderKind`. Фраза без времени в чате теперь тоже без времени (через `newTaskDefaults`) — остальное по боту в S18-08.
- 715 → 733 тестов: `new-task-fields` (+15: без времени по умолчанию, Flexible, крестик, напоминание подстраивается, сохранение без времени, `reminderOptions`, `reminderLabel`, `reminderPastNotice`, `pastNotice`), `edit-task-fields` (задача без времени), `phrase-task-input` (+4 примера), `bot-view` (+1), `format` (+1); тесты `reminderChoicesFor` заменены тестами `reminderOptions`.

---

### S18-05 · Home

**Что сделать**
- Блок «Any time» в дне, Up next, «Free after», подсказки о пересечении, подпись просроченной (п.17) — в чистых функциях `home-view.ts` (+ тесты); `patternInsight` без задач без времени (п.21).

**Acceptance criteria**
- [x] День только из задач без времени — без «00:00», без «N at the same time»; Up next — «Any time today». *(Тесты `home-view` (+4): Up next берёт задачу без времени, только когда открытых со временем нет, и без «also now»; в группы по времени они не попадают; «Free after» без задач со временем — нет. Up next такой задачи — «Any time · today».)*
- [x] Смешанный день — задачи со временем как раньше, блок «Any time» после них. *(S18-11: временная страница с `HomeDay` и выдуманными задачами, 390 px — «18:00 English lesson», затем «Any time: Buy groceries, Call the bank», «Free after 19:00»; просроченная «Pay rent» — «Overdue since Oct 1». Найдено: у задачи без длительности мета была «0 min · Flexible» — теперь просто «Flexible» (и у задач со временем без длительности).)*

**Как сделано:** `home-view.ts` — `hasTime(o)`; `selectUpNext` (п.17), `groupRemainingByTime` и `latestOccurrenceEnd`, `findMoveTime`, `patternInsight` — только задачи со временем; `untimedRemaining` — блок «Any time». `home-day.tsx` — блок «Any time» последней группой, Up next «Any time · today», подпись просроченной без времени; `DayTimeline` без задач со временем — без строки «Your evening is free».

---

### S18-06 · Tasks

**Что сделать**
- `compareBase` — без времени последними в дне; `buildMeta` — «Flexible»; «Same time as…» — без них; колонка Today — «Any time»; `move-to-today.ts` — без времени остаётся без времени (п.18) (+ тесты).
- Убрать устаревший комментарий «never apply» в `task-list-view.ts`.

**Acceptance criteria**
- [x] Tasks: задачи без времени в конце дня, «Flexible» в мете; «Move to today» у просроченной без времени. *(Тесты `task-list-view` (+4), `move-to-today` (+1). S18-11 на `dev` — «Today: late call [23:55 · Fixed · 5 min], buy milk [Flexible] | Sat, Oct 3: plan trip [Sat, Oct 3 · Flexible]». Глазами экран Tasks не смотрела — нужен вход.)*

**Как сделано:** `task-list-view.ts` — `hasTime` у строки; `compareBase`: день → со временем раньше → время → приоритет; `buildMeta` — без «00:00», в другие дни «Flexible» вместо времени; «Same time as…» и повторённое время — без них. Колонка времени Today — «Any time». `planMoveToToday` — без времени остаётся без времени (полночь сегодня, без конца; напоминание — по правилу задачи).

---

### S18-07 · Calendar

**Что сделать**
- `calendar-view.ts`: у события признак «без времени»; `timelineRange` и раскладка — только задачи со временем (+ тесты).
- `week-calendar.tsx`: строка «Any time» (десктоп), блок над сеткой (телефон), убрать заглушку-комментарий; `month-calendar.tsx`: сводка дня (п.19).

**Acceptance criteria**
- [x] Неделя без таких задач — строки нет; с ними — строка, сетка 07–22 не растянута; телефон — блок над сеткой; Month — в сводке. *(Тест `calendar-view` (+1). S18-11, временная страница: 1280 px — строка «ANY TIME»: «Busy» во вторник (весь день в Google), «Pay rent» в среду, две задачи в пятницу (длинное название — в 2 строки), сетка с 07:00; 390 px — «ANY TIME» над сеткой выбранного дня. Без задач без времени и без занятого целиком дня строка не рисуется (условие в `AnyTimeRow`).)*
- [x] Контраст подписи «ANY TIME» — AA. *(`--calendar-quiet-text`, 5.1:1.)*

**Как сделано:** `calendar-view.ts` — у дня `events` (со временем — сетка) и `anyTime`; плотность дня и подписи — по всем. `any-time-row.tsx` — `AnyTimeRow` (задачи без времени + «Busy» за весь день, одна строка, решено 2026-10-02) в `Suspense`: пока Google не ответил — строка только с задачами; `AnyTimeBlock` — телефон. Строка «ALL DAY» Sprint 17 (`GoogleAllDayRow`) убрана — её место заняла эта. Month — задачи без времени последними, «Any time». Кружок выполнения в строке «Any time» (§2.3) не сделан — названия открывают задачу; в §4.

---

### S18-08 · Telegram

**Что сделать**
- `dayItem` — `time: null` без времени; порядок в `/today` и сводке; `pickNext` по п.20; кнопки сводки без времени; фраза без времени в чате; кнопки новой задачи без «+1 h» (+ тесты).

**Acceptance criteria**
- [x] «buy milk» → задача без времени, Undo · Tomorrow · Open; `/today` — «Anytime» после задач со временем; `/next` по п.20. *(Тесты `bot-view` (+3), `bot-messages` (+1), `phrase-task-input`. S18-11 на `dev` через те же функции, что вебхук: «/today» — «23:55 · late call», затем «Anytime · buy milk», «Anytime · vitamins»; «/next» — late call; кнопки сводки «✓ 23:55 late call», «✓ buy milk». Через настоящий вебхук не гоняла.)*

**Как сделано:** `bot-view.ts` — `dayItem` без времени → `time: null` («Anytime»); `/today` и сводка — задачи без времени после; `pickNext` — п.20; `openItems` / `summaryButtons` — «✓ Title» без времени. Фраза без времени и «+1 h» — S18-04.

---

### S18-09 · Паттерны

**Что сделать**
- `findOutcomesBetween` отдаёт `task.hasTime`; `partOfDayOf` — только для задач со временем (п.21) (+ тесты).

**Acceptance criteria**
- [x] Тест: задачи без времени в общем проценте есть, в частях дня — нет. *(`behavior-stats` +1, `usual-time` +1; `findOutcomesBetween` отдаёт `task.hasTime`. S18-11 на `dev`: из 34 итогов в «поздно» — только задача в 23:55.)*

---

### S18-10 · README

**Что сделать**
- «Creating a task» — задачи без времени, Flexible, примеры.
- «Reminders» — No reminder, That morning, Evening before, местное время.
- «Telegram bot» — «Anytime», фраза без времени.
- «Your patterns» — почему задачи без времени не в частях дня.

**Acceptance criteria**
- [x] Разделы обновлены. *(Новый раздел «Tasks without a time»; «Editing a task» — снятие и добавление времени; «Reminders» — виды напоминаний, местное время, прошедший фиксированный час, тексты, Snooze; «Telegram bot» — фраза без времени, `/next`, «Anytime». Раздела «Creating a task» в README нет — всё про создание в «Tasks without a time» и «Finding free time».)*

---

### S18-11 · Живая проверка + Sprint DoD

**Что сделать**
- На `dev`: все сценарии DoD, 390 и 1280 px. Тестовые задачи создаются и удаляются скриптом, только с разрешения.
- Прогон пяти команд, PR (миграция окончательная, п.22). После мержа — миграция на проде, сверка.

**Acceptance criteria**
- [x] Все пункты Sprint DoD отмечены с результатом проверки. *(2026-10-02, кроме CI, миграции на проде и настоящей отправки напоминания — они после PR / с твоего разрешения.)*

**Как проверено (S18-11, 2026-10-02):** на `dev` скриптом через сервисы и те же функции, что строят экраны (задачи созданы и удалены): «buy milk» и «vitamins» (каждый день) без времени, «plan trip» на завтра с «Evening before», «late call» в 23:55.
- Home: Up next — late call, блок «Any time» — buy milk, vitamins.
- Tasks, Calendar, бот, паттерны — см. S18-06…S18-09 выше; напоминания: «Evening before» на завтра не создано (19:00 прошло), late call — 23:55.
- Глазами — временная страница с выдуманными данными (Calendar 1280/390, Home 390), удалена.
- После: «S18 test» — 0, задач 22, хвостов нет; lint, typecheck, 749 тестов, format:check, build — зелёные.

---

## 4. Не входит в Sprint 18

- «That morning» / «Evening before» для задач со временем (хэндофф даёт их только задачам без времени); своё время утреннего и вечернего напоминания.
- Связь слов «утром», «вечером» с напоминанием («every morning» → That morning).
- Задачи без даты (inbox, «когда-нибудь»).
- Поиск времени для задачи без времени («find time to plan the trip» уже ищет слот — это задача со временем).
- Перенос всех задач без времени со вчера на сегодня одной кнопкой.
- Кружок выполнения у задач в строке «Any time» Calendar (§2.3) — пока названия открывают задачу.
- Один день серии, Undo, Deactivate, «Custom…» — [sprint-19-tasks.md](./sprint-19-tasks.md); трекер привычек — [sprint-21-tasks.md](./sprint-21-tasks.md).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Пропущенное сравнение с `now` | Сегодняшняя задача без времени пропадает при правке серии или деактивации | Одна функция `isAhead` (п.4), поиск всех `> now` по `scheduledStart` в S18-02, тесты |
| Задачи без времени попадают в пересечения | Ложные «Overlaps» и «N at the same time» | Фильтр по `hasTime` в репозитории и чистых функциях (п.16) |
| Смена пояса | Задача без времени уезжает на вчера | Перенос при смене пояса (п.5), тест |
| Перевод часов | Утреннее напоминание на час раньше/позже | Расчёт в местном времени, тесты на оба перевода |
| Превью PR накатывает миграцию на прод | Недоделанная схема на проде | Только добавления с умолчаниями; PR — когда миграция окончательная |
| Объём больше прикидки | Спринт затянется | S18-08 можно перенести (§2) |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи | Стоп на ревью |
|---|---|---|
| 1 | S18-00, S18-01 | решения 1–22 утверждены; миграция на `dev` |
| 2 | S18-02 (+ тесты) | ядро: создание, серия, `isAhead`, пересечения, пояс |
| 3 | S18-03 (+ тесты) | напоминания |
| 4 | S18-04 | форма и разбор фраз |
| 5 | S18-05, S18-06 | Home и Tasks |
| 6 | S18-07, S18-08, S18-09 | Calendar, бот, паттерны |
| 7 | S18-10, S18-11, прогон Sprint DoD | PR; после мержа — миграция на проде |
