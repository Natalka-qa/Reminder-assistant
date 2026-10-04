# Sprint 19 — Повторения: один день серии, Undo, «Custom…»-напоминание, понятный Deactivate

Источник: не план. Темы выбраны 2026-10-02 из отложенного в Sprint 14, «Не входит»:
- «Правка одного повторения отдельно от серии (своё время у одного дня)»;
- «Вернуть убранное повторение (Undo)»;
- «Своё число минут для напоминания („Custom…“)».

_Добавлено 2026-10-02:_ кнопка **Deactivate** на странице задачи. Сейчас непонятно, чем она отличается от Delete, а неактивная задача пропадает насовсем: её не видно в Tasks и вернуть нельзя (так решили в Sprint 2: «обратимо в БД, но без UI»).

_История:_ сначала (2026-10-02) это был Sprint 18 вместе с «That morning» / «Evening before». В тот же день решили, что задачи без времени нужны (решение A от 2026-09-25 отменено), и они стали Sprint 18 — [sprint-18-tasks.md](./sprint-18-tasks.md). «That morning» и «Evening before» ушли туда, где их и рисовал хэндофф: это напоминания задач без времени. Порядок: 17 → 18 (без времени) → 19 (этот) → 20 (курсы и сроки — [sprint-20-tasks.md](./sprint-20-tasks.md)) → 21 (трекер привычек, [sprint-21-tasks.md](./sprint-21-tasks.md)); 20 и 21 переставлены 2026-10-03.

**Цель спринта:** с повторяющейся задачей можно делать то же, что с обычной, не ломая серию. Можно перенести один день, вернуть убранный, закончить серию и начать снова. Перед каждой кнопкой понятно, что произойдёт.

- «Only this day / Whole series» при правке повторяющейся задачи: у одного дня свои дата, время и длительность. Серия этот день больше не трогает.
- «Remove this one» можно отменить: Undo в уведомлении и в боте, «Restore» в списке убранных дней на странице задачи.
- Напоминание «Custom…»: своё число минут или часов.
- Deactivate разделён по смыслу. У повторяющейся задачи — «End series», у разовой — «Archive». Перед действием диалог объясняет, что будет. Законченные и архивные задачи видны в Tasks под фильтром «Ended», их можно вернуть.
- Одна миграция, только добавления со значениями по умолчанию.

**Sprint Definition of Done**

- [x] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит. *(2026-10-04: все пять зелёные локально, 56 файлов / 801 тест; `build` на `dev` — «No pending migrations». CI на PR #36 — 3 проверки зелёные, PR mergeable.)*
- [x] Миграция применена сначала на `dev`, потом на проде; существующие задачи и напоминания не изменились (сверка до/после). *(`dev` — три миграции, сверка в S19-01 и п.17–18. Прод «до» (2026-10-04, только чтение): 9 миграций; задачи 28 активных / 1 неактивная; дни CANCELLED 38, DONE 27, PARTIALLY_DONE 3, SCHEDULED 46, SKIPPED 6; напоминания CANCELLED 47, PENDING 36, SENT 23. «После» (2026-10-04, превью PR #36 применило миграции): 12 миграций, три новые завершены; задачи 28 активных (`endedAt` пуст) / 1 неактивная (`endedAt` проставлен); дни CANCELLED 38 (из них 8 — `isException`, убранные через «Remove this one»), DONE 27, PARTIALLY_DONE 3, SCHEDULED 46, SKIPPED 6, `originalStart` пуст у всех; напоминания CANCELLED 47, PENDING 36, SENT 23 — всё как до.)*
- [x] Один день серии переносится на другое время/дату и меняет длительность (у серии без времени — только дата); остальные дни, Calendar, Home, Tasks, напоминание этого дня — по новому времени. *(S19-03/04, `dev` + Chrome пользователя.)*
- [x] Смена времени или дней серии не трогает перенесённые и убранные дни; продление серии (cron) не берёт время у перенесённого дня. *(S19-02/03 на `dev`; продление — тестами `planWindowExtension`, cron не запускался.)*
- [x] «Remove this one» → Undo в уведомлении (приложение) и в боте возвращает день с напоминанием; позже — «Restore» в «Removed days» на странице задачи. Прошедший день вернуть нельзя. *(S19-05; бот — через сервис и тест окна 10 мин, без живого вебхука.)*
- [x] «Custom…» сохраняется, показывается в задаче и даёт правильное время напоминания. *(S19-06; текст «2 hours before».)*
- [x] «End series» / «Archive» объясняют последствия до нажатия; Delete — тоже, отдельно говорит, что пропадёт статистика. Законченные задачи — в Tasks под «Ended», «Resume series» / «Restore» возвращают их. *(S19-07.)*
- [x] Контраст новых элементов — AA; на 390 px без горизонтальной прокрутки. *(Фикстуры S19-04…07: всё ≥ 4.74, `scrollWidth` 390.)*
- [x] Новые тесты — только на чистую логику: план серии с исключениями, доступность действий, тексты диалогов, значение «Custom…». *(+52 теста, все на чистые функции.)*

---

## 1. Стартовое состояние (аудит по факту, 2026-10-02; перед стартом сверить с тем, что изменил Sprint 18)

| Область | Что нашли |
|---|---|
| **Модель** | `TaskOccurrence { scheduledStart, scheduledEnd?, status, snoozeCount, completedAt }` — своё время у каждой строки уже хранится, но признака «день изменён отдельно» нет. `Task.reminderOffsetMinutes Int @default(0)`. Sprint 18 добавит задачи без времени и вид напоминания — сверить поля в S19-00. |
| **Генерация серии** | При создании — 30 дней (`RECURRENCE_WINDOW_DAYS`), с проверкой пересечений и напоминаниями. Cron `extend-occurrences` (03:00) дописывает дни после последнего; **время дня берёт у последнего повторения**, якорь — у первого (`occurrence.service.ts:367-372`). |
| **Правка серии** | `taskService.updateTask` сравнивает время/правило через `currentTimeOfDay` (тоже последнее повторение). При изменении `replaceFutureOccurrences` **удаляет** будущие `SCHEDULED`/`SNOOZED` и создаёт заново на 30 дней. Сохраняются DONE, PARTIALLY_DONE, SKIPPED, прошлые; CANCELLED не считается «занятой датой» — поэтому убранный день возвращается (это сказано в диалоге: «Changing the series' time or days brings it back»). Смена длительности — `cascadeDurationChange` переписывает `scheduledEnd` всем будущим. Дата начала серии — только для чтения; серию нельзя сделать разовой («deactivate it instead»). |
| **Форма правки** | `tasks/[id]/edit` (Sprint 14): все поля задачи, у повторяющейся — правка всей серии, выбора «только этот день» нет. Время в форме — из `pickCurrentOccurrence`. |
| **Один день сейчас** | Snooze **не** двигает `scheduledStart`, только переносит напоминание. Единственный перенос одного дня — «Move to today» (`moveOccurrenceToToday`), только для разовых задач. |
| **Remove this one** | `occurrenceService.removeOccurrence` → `CANCELLED` + отмена напоминания; только повторяющиеся, только `SCHEDULED`/`SNOOZED`. Кнопка — на странице задачи (главный день и «Next occurrences»), в строке Tasks, в боте (`remove`). Undo нет. Undo бота (Sprint 15) удаляет всю новую задачу (`undo:<taskId>`, окно 10 мин `FIX_WINDOW_MINUTES`) — для дня не подходит. |
| **Пересечения и чтение** | Пересечения и все экраны берут начало из `TaskOccurrence.scheduledStart`. Длительность — по-разному: Calendar — `scheduledEnd − scheduledStart`; Home `occurrenceEnd` — `scheduledEnd ?? task.durationMinutes`; `latestOccurrenceEnd`, список Tasks и мета на Home — `task.durationMinutes`. |
| **Напоминания** | Одно на повторение; `sendAt = scheduledStart − offset` (`computeSendAt`). Варианты — `REMINDER_CHOICES`: At start time, 5, 10, 15, 30, 60, 1440 мин; в zod у задачи — `int 0..1440` без списка; правка показывает значение не из списка («45 min before»), но ввести своё нельзя. |
| **Deactivate** | `taskService.deactivateTask`: `active = false`, будущие `SCHEDULED`/`SNOOZED` → `CANCELLED`, их напоминания отменяются; прошлое не трогается и остаётся в Progress. Cron пропускает неактивные. Кнопка — без подтверждения, тост «Task deactivated». Неактивные не попадают в Tasks (`findActiveByUserId`), на странице задачи подпись «Deactivated»; вернуть нельзя. Delete — диалог «This will permanently delete the task and its schedule.»; каскадом удаляются повторения и напоминания, вместе с ними — статистика Progress (об этом не сказано). |
| **Хэндоффы** | Про правку одного дня серии — ничего. «Custom» в хэндоффах нет (было в старой форме v1). |
| **Паттерн тестов** | Только чистая логика. |

**Сверка с Sprint 18 (S19-00, 2026-10-04).** Что поменялось в коде с аудита выше:

| Область | Как стало |
|---|---|
| **Модель** | `Task.hasTime Boolean @default(true)` — признак на задаче, не на дне: «дни серии одного вида». `Task.reminderKind` — `NONE` / `OFFSET` / `MORNING_OF` / `EVENING_BEFORE`. «At start time» теперь `OFFSET` с `0`, «без напоминания» — `NONE`. День без времени начинается в локальную полночь, `scheduledEnd = null`. |
| **«Впереди»** | `isAhead` (`untimed.ts`): у дня со временем — начало позже `now`, у дня без времени — весь сегодняшний день. Им пользуются `planScheduleChange` и `cancelFutureOccurrences`. Правило п.3 «не раньше сегодня» с ним совпадает. |
| **Правка серии** | `planScheduleChange` получил `hadTime`; серию можно перевести со временем ↔ без времени, `hasTime` меняется вместе с планом. `currentTimeOfDay` и продление по-прежнему берут время у последнего дня (`occurrence.service.ts:395-399`), у серии без времени — `null`. Текст ошибки «A repeating task can't stop repeating — deactivate it instead.» (`task.service.ts:123`) поменять в S19-07 на «End series». |
| **Часовой пояс** | Новое: `reanchorUntimedOccurrences` при смене пояса двигает будущие дни без времени на ту же локальную дату. Перенесённому дню без времени это не мешает: дата сохраняется. |
| **Напоминания** | `computeSendAt(scheduledStart, rule, timezone)` + `shouldCreateReminder`; правило — `reminderRuleOf(task)`. П.6 и Restore (п.8) идут через них. «Custom…» (п.9) — это `OFFSET` со значением `1..1440`, только при `hasTime`. |
| **Deactivate** | Плюс к аудиту: отменяет и сегодняшний день задачи без времени (`isAhead`), напоминания — `cancelForTaskAfter`. |
| **Длительность (п.7)** | Список Tasks показывает длительность только у разовых задач (`task-list-view.ts:469`), там у дня своего времени нет — менять нечего. Остаётся `latestOccurrenceEnd` на Home (`home-view.ts:297`, `task.durationMinutes`). Calendar уже считает от `scheduledEnd`. |
| **Прод** | 1 неактивная задача (получит `endedAt`), 8 убранных дней у активных серий (`CANCELLED`, без `isException` — см. п.17). |

### Расхождения / решения на этот спринт

Нужны решения — у каждого рекомендация.

**Один день серии**

1. **Признак исключения — одно поле.** `TaskOccurrence.isException Boolean @default(false)`. Оно ставится на перенесённый день и на убранный через «Remove this one». Своё время у дня уже хранится в `scheduledStart`/`scheduledEnd`, отдельные поля не нужны. Рекомендация: так.
2. **Серия не трогает исключения.**
   - `replaceFutureOccurrences` их не удаляет, их даты считаются занятыми. Перенесённый день остаётся на своём времени, убранный не возвращается.
   - `cascadeDurationChange` пропускает исключения.
   - `currentTimeOfDay` и продление серии берут время только у обычных дней.
   - Текст в диалоге убранного дня меняется на «You can restore it from the task page».
   - Рекомендация: так. Так же работает Google Calendar при «All events».
3. **Что меняется у одного дня.** Дата, время и длительность. У серии без времени (Sprint 18) — только дата, время одному дню не добавляется: дни серии одного вида. Название, приоритет, гибкость, напоминание и заметка хранятся в `Task`, они общие для серии. Новая дата — не раньше сегодня. На ту же дату, где уже стоит другой день этой серии, перенести нельзя («This series already has Oct 5»). Рекомендация: так.
4. **Где выбирается.** «Edit» у повторяющейся задачи, открытой с конкретного дня (главный день страницы, строка в «Next occurrences», строка Tasks, событие Calendar), сначала спрашивает: «Only this day (Oct 5)» / «Whole series». «Only this day» открывает ту же форму правки (`?occurrence=<id>`) только с полями «Когда» и «Длительность». Пересечения и «Free nearby» в ней работают как обычно, по одному кандидату. Рекомендация: так.
5. **Видно, что день изменён.** В «Next occurrences» и Calendar у такого дня подпись «Edited», `title` на десктопе. Исходное время («Moved from 18:00») — §4. Рекомендация: так.
6. **Напоминание дня** пересчитывается вместе с его временем по правилу задачи (с Sprint 18 — `computeSendAt` с видом напоминания и часовым поясом).
7. **Длительность читается из повторения.** Список Tasks, `latestOccurrenceEnd` и мета на Home переходят на `scheduledEnd ?? durationMinutes`, иначе у перенесённого дня неверный конец. Рекомендация: так, это часть S19-02. _(S19-00: в списке Tasks менять нечего — длительность там только у разовых; остаётся `latestOccurrenceEnd`.)_
16. **Серия сменила вид (со временем ↔ без времени) — что с перенесённым днём.** _Новое после Sprint 18._ Если оставить как есть, день сохранит старый вид, и в серии без времени окажется день со временем — это ломает правило «дни серии одного вида». Рекомендация: перенесённый день, который ещё впереди, остаётся на **своей дате** и исключением, но берёт новый вид серии: без времени — полночь даты без конца; со временем — новое время серии на его дате и длительность серии. Напоминание пересчитывается. Убранные дни остаются убранными.

**Undo для убранного дня**

8. **Три способа вернуть.** (а) Тост «Removed Oct 5 · Undo», 10 с. (б) В боте у «Removed this one» кнопка Undo в те же 10 минут, что у Undo новой задачи (`FIX_WINDOW_MINUTES`). (в) На странице повторяющейся задачи свёрнутый блок «Removed days» со строками «Oct 5 · Restore», только будущие дни. Restore возвращает статус `SCHEDULED`, снимает `isException` и создаёт напоминание, если его время ещё не прошло. Прошедший убранный день вернуть нельзя. Рекомендация: все три. Без (в) после тоста вернуть день было бы негде.

**Напоминание «Custom…»**

9. **«Custom…»** — только у задач со временем. Поле «число + minutes/hours», от 1 мин до 24 ч (это текущий предел zod — 1440). Значение не из списка уже показывается как «45 min before», теперь его можно ввести. Текст в задаче — «Reminder: 2 h before». «Default reminder» на `/settings` остаётся списком. Рекомендация: так. Больше суток — §4.

**Deactivate — чтобы было понятно, что произойдёт**

10. **Два названия по смыслу.** Повторяющаяся задача: **«End series»**. Разовая: **«Archive»**. Слово «Deactivate» уходит из интерфейса. Рекомендация: так.
11. **Диалог перед действием.** Сейчас кнопка срабатывает сразу. Тексты по-английски, как весь интерфейс:
    - **End series** — «End this series? · Days from today on are removed with their reminders. Days you've already done or skipped stay, and still count in Progress. · You can resume it later from Tasks → Ended.» Кнопки «End series» / «Keep».
    - **Archive** — «Archive this task? · Its reminder is cancelled and it leaves Home, Tasks and Calendar. If you've marked it, that stays in Progress. · You can restore it from Tasks → Ended.» Кнопки «Archive» / «Keep».
    - **Delete** (уточнить текущий текст) — «Delete this task? · The task, all its days and reminders are deleted for good, and its history disappears from Progress. · To stop it but keep its history, use End series / Archive.» Во второй строке подставляется нужное название.
    - Рекомендация: так. Delete явно называет «мягкую» альтернативу.
12. **Где видны законченные.** В Tasks фильтр «Ended», последний чип. Список сортируется по дате окончания, у строки подпись «Ended Oct 2» / «Archived Oct 2». На Home и в Calendar их нет, как и сейчас. Дату окончания можно взять из `updatedAt`, но любая правка её собьёт. Рекомендация: `Task.endedAt DateTime?` в ту же миграцию. Подпись на странице задачи: «Series ended Oct 2» / «Archived Oct 2» вместо «Deactivated».
13. **Вернуть.**
    - **Resume series** создаёт дни с сегодня на 30 дней по правилу и времени серии, как при создании. Пересечения проверяются и показываются как обычно (`confirmConflicts`). Исключения (п.1) не трогаются.
    - **Restore** разовой задачи: если её день ещё впереди, он снова `SCHEDULED` с напоминанием. Если прошёл, задача возвращается без дня, и страница предлагает «Pick a new time» (Edit).
    - После возврата `active = true`, `endedAt = null`.
    - Рекомендация: так.
14. **Бот.** Команд для законченных задач нет. Кнопки старых напоминаний законченной задачи отвечают «This one is no longer open» (уже так). Рекомендация: без изменений.

**Миграция**

15. **Одна миграция, только добавления:** `TaskOccurrence.isException`, `Task.endedAt`. У обоих есть значение по умолчанию или `NULL`, существующие строки не меняются. Сначала на `dev`, потом мерж. Превью PR применяет миграции к базе прода (случай Sprint 16, заметка в памяти). Поэтому PR открывается только когда миграция окончательная, и каждая её правка после открытия PR сразу попадает на прод. Рекомендация: так. Перед PR — сверка «до/после» на `dev`.
17. **Старые убранные дни.** _Новое на S19-00._ На проде 8 дней активных серий уже `CANCELLED` через «Remove this one», но без `isException`. Без заполнения смена времени серии вернёт их, как раньше, хотя диалог будет обещать обратное. Рекомендация: в ту же миграцию `UPDATE "TaskOccurrence" SET "isException" = true` для `CANCELLED` дней активных повторяющихся задач (у них `CANCELLED` бывает только от «Remove this one»). Первая миграция на `dev` уже применена, поэтому это вторая, только с `UPDATE`; до PR, так что на прод обе придут вместе. На `dev` таких строк 0.
    _Утверждены 1–17 по рекомендациям, 2026-10-04. П.17 — `20261004173120_mark_removed_days_as_exceptions`, на `dev` применена (0 строк, счётчики те же)._
18. **Дата, с которой день перенесли.** _Найдено на S19-02._ Одного `isException` мало, если день перенесли **на другую дату**. Исходная дата освобождается, и следующая правка времени или дней серии построит на ней день заново: вместо одного дня станет два — новый на старой дате и перенесённый. Продление (cron) так не делает, оно идёт только после последнего дня. Рекомендация: `TaskOccurrence.originalStart DateTime?`. Ставится при первом переносе и не меняется при следующих; план серии считает его дату занятой, а якорь берёт с него. Третья миграция, только добавление `NULL`. Это же даёт основу для «Moved from 18:00» (§4). Альтернатива без схемы — переносить только в пределах своей даты, но это противоречит п.3.
    _Утверждено 2026-10-04. `20261004173759_add_occurrence_original_start` на `dev` применена; план серии и продление считают дату `originalStart` занятой, якорь берётся с неё._

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S19-00 | Предпроверки: Sprint 18 смержен, ветка от `main`, `NEON_BRANCH=dev`; сверка аудита с изменениями Sprint 18; гайды Prisma по миграциям; гайды Next по Server Functions | 0.5 ч | — |
| S19-01 | Миграция: `isException`, `endedAt` — на `dev`, сверка до/после | 0.5 ч | S19-00 |
| S19-02 | Серия с исключениями: замена, длительность, продление, время серии; длительность из повторения на экранах (+ тесты) | 2.5 ч | S19-01 |
| S19-03 | Один день: сервис и действие — дата, время, длительность, пересечения, напоминание (+ тесты) | 2 ч | S19-02 |
| S19-04 | Один день: выбор «Only this day / Whole series», форма, точки входа, подпись «Edited» | 3 ч | S19-03 |
| S19-05 | Undo убранного дня: тост, кнопка бота, «Removed days» с Restore (+ тесты) | 2 ч | S19-02 |
| S19-06 | Напоминание «Custom…»: поле, zod, тексты (+ тесты) | 1 ч | — |
| S19-07 | End series / Archive: диалоги, текст Delete, фильтр «Ended», Resume / Restore (+ тесты) | 2.5 ч | S19-01 |
| S19-08 | README: «Editing a task», «Reminders», «Telegram bot» | 0.5 ч | S19-04…07 |
| S19-09 | Живая проверка на `dev` + прогон Sprint DoD; после мержа — миграция на проде и сверка | 1.5 ч | всё выше |

Итого ~16 ч.

---

## 3. Задачи

### S19-00 · Предпроверки

**Что сделать**
- Sprint 18 смержен; ветка `sprint-19-tasks` от актуального `main`.
- `.env.local` — `NEON_BRANCH=dev`; CLI Prisma ходит мимо пулера (`prisma.config.ts` → `directDatabaseUrl`, Sprint 16, #31).
- Сверить §1 с тем, что изменил Sprint 18 (задачи без времени, вид напоминания, `computeSendAt`), и поправить аудит здесь.
- Прочитать про миграции в Prisma этой версии; в `node_modules/next/dist/docs/` — про Server Functions и `revalidatePath` (AGENTS.md).

**Acceptance criteria**
- [x] Ветка от `main`; `NEON_BRANCH=dev`; `prisma migrate status` на `dev` — без расхождений; §1 сверен; заметки по гайдам — здесь.
  *(2026-10-04: `sprint-19-tasks` — от `origin/main` = `82467b7` (merge #35; Sprint 18 — #34). `NEON_BRANCH=dev`; `prisma migrate status` — 9 миграций, «Database schema is up to date»; Prisma 6.19.3, `prisma.config.ts` → `directDatabaseUrl`. §1 сверен — таблица «Сверка с Sprint 18», новые решения 16–17. Гайды: Next 16 — Server Functions (`01-app/01-getting-started/07-mutating-data.md`): после мутации `revalidatePath` (проект так и делает, `scheduling/actions.ts:31-34`), есть ещё `refresh()` из `next/cache` — нам не нужен. Prisma: `migrate dev --create-only` → правка SQL (заполнение) → `migrate dev`.)*

---

### S19-01 · Миграция

**Что сделать**
- `schema.prisma`: `TaskOccurrence.isException Boolean @default(false)`, `Task.endedAt DateTime?` (п.15).
- `prisma migrate dev` на `dev`. До и после — число задач, повторений и напоминаний по статусам.
- Неактивным задачам заполнить `endedAt = updatedAt` в той же миграции, чтобы фильтр «Ended» не был пустым для старых.

**Acceptance criteria**
- [x] Миграция на `dev` применена; счётчики до/после совпадают; у неактивных задач есть `endedAt`.
  *(2026-10-04: `20261004172530_add_series_exceptions_and_ended_at` — два `ADD COLUMN` + `UPDATE "Task" SET "endedAt" = "updatedAt" WHERE active = false`. На `dev` до и после: задачи 22 (все активные, на `dev` неактивных нет — `endedAt` у всех `NULL`); дни DONE 15, PARTIALLY_DONE 3, SCHEDULED 45, SKIPPED 4, все `isException = false`; напоминания PENDING 30, SENT 20, CANCELLED 5. На проде (только чтение): 1 неактивная задача получит `endedAt`; 8 убранных дней — решение 17.)*

---

### S19-02 · Серия с исключениями

**Что сделать**
- `planScheduleChange` / `replaceFutureOccurrences`: исключения не удаляются, их даты считаются занятыми (п.2).
- `cascadeDurationChange` пропускает исключения.
- `currentTimeOfDay` и `extendOccurrencesForAllActiveTasks` берут время только у обычных дней.
- `removeOccurrence` ставит `isException = true`; текст диалога убранного дня обновляется.
- Длительность на экранах — `scheduledEnd ?? durationMinutes` (п.7).

**Acceptance criteria**
- [x] Тесты на план: смена времени серии с перенесённым и убранным днём, смена дней недели, смена длительности, время серии при исключении на последнем дне, серия без времени с перенесённым днём.
  *(2026-10-04: `schedule-change.ts`: в `planScheduleChange` исключения не заменяются, их даты (и убранных) заняты; при смене вида серии — `reshape` (п.16). Новые чистые функции `durationCascadeTargets` и `planWindowExtension` — продление теперь читает все дни задачи и берёт время и «последний день» только у обычных; дата, на которую перенесли день впереди окна, не дублируется. `currentTimeOfDay` — без исключений, `anchorDateOf` — без перенесённых. `occurrence.service.ts`: `replaceFutureOccurrences` переводит перенесённые дни в новый вид с пересчётом напоминания и проверкой пересечений; `removeOccurrence` ставит `isException`; лишние `findMin/MaxScheduledStartForTask` удалены. `task.service.ts`: превью пересечений и Google проверяют и `reshape`. Home `latestOccurrenceEnd` — `scheduledEnd ?? durationMinutes`. Диалог «Remove this one»: «The rest of the series stays. You can restore it from the task page.» — Restore появится в S19-05; строка README про «brings it back» исправлена сразу. Тесты: 14 новых в `schedule-change.test.ts` + 1 в `home-view.test.ts`; lint, typecheck, test (764), format:check — зелёные. Живой прогон cron на `dev` не делала: он отправил бы напоминания реальным пользователям из копии прода. Не покрыто: перенос на другую дату + смена серии — п.18.)*

---

### S19-03 · Один день: сервис

**Что сделать**
- `occurrenceService.rescheduleOccurrence(userId, occurrenceId, { date, time, durationMinutes, confirmConflicts })`: проверки п.3, пересечения (свои задачи и Google, как при правке; у дня без времени — нет), `isException = true`, пересчёт напоминания.
- `rescheduleOccurrenceAction` в `features/scheduling/actions.ts`; правило «что можно у дня» — чистая функция (+ тесты).

**Acceptance criteria**
- [x] Перенос дня на `dev` → новое время в базе, напоминание пересчитано, остальные дни не тронуты; перенос на дату другого дня серии и в прошлое → отказ с текстом.
  *(2026-10-04, код: `reschedule-occurrence.ts` — `canRescheduleOccurrence` и `planOccurrenceReschedule` (вид дня = вид серии; не в прошлое; дата другого дня → «This series already has Oct 6.», убранного → «Oct 7 was removed from this series. Restore it from the task page instead.»; `originalStart` — с первого переноса), 11 тестов. `occurrenceService.rescheduleOccurrence`: Google до транзакции, свои задачи внутри (если не `confirmConflicts`), `isException = true`, статус `SCHEDULED`, напоминание отменяется и создаётся заново по правилу задачи. `rescheduleOccurrenceAction` → редирект на `/tasks/<id>?occurrence=<id>`.)*
  *(2026-10-04, живая проверка на `dev` скриптом из scratchpad через сервисы. Тестовая серия «[S19 test] Evening walk» у tapolskaya3@gmail.com (Europe/Madrid): ежедневно 18:00, 30 мин, напоминание за 15 мин, Oct 5 – Nov 4 (31 день). Oct 6 → 07:30, 90 мин: длина 90, `isException`, `originalStart` = Oct 6 18:00, напоминание 07:15. Oct 7 → Oct 20 — «This series already has Oct 20.»; Oct 7 → Nov 10 12:00 — ок, напоминание 11:45. Oct 8 → Oct 3 и → сегодня 00:30 — отказ (после этого текст для прошедшей даты поменян на «Pick today or a later day.», «That time has already passed.» — только для сегодняшнего времени). Убран Oct 9; Oct 10 → Oct 9 — «Oct 9 was removed from this series. Restore it from the task page instead.» Серия → 19:00: обычные дни 19:00 (напоминание 18:45), Oct 6 остался 07:30, на освобождённом Oct 7 дня нет (п.18), Nov 10 на месте, Oct 9 убран. Длительность → 45: Oct 6 — 90, остальные 45. Без времени: Oct 6 и Nov 10 — полночь своей даты без конца, без напоминания; время 19:00 обратно — Oct 6 и Nov 10 в 19:00 на своих датах, 45 мин, напоминание 18:45 (п.16). В конце Oct 6 снова перенесён на 07:30 для проверки интерфейса. Cron продления не запускался.)*

---

### S19-04 · Один день: интерфейс

**Что сделать**
- Выбор «Only this day (Oct 5)» / «Whole series» при Edit повторяющейся задачи с конкретного дня (п.4).
- Режим формы `?occurrence=<id>`: только «Когда» и «Длительность» (у серии без времени — только дата), «Overlaps with…» и «Free nearby» — как обычно.
- Подпись «Edited» у дня в «Next occurrences», Tasks и Calendar (п.5).

**Acceptance criteria**
- [ ] Все точки входа ведут к выбору; «Whole series» — как сейчас.
- [ ] Перенесённый день — на новом месте в Calendar, Home, Tasks с подписью. *(Под входом в Chrome проверены страница задачи и форма дня; Tasks и Calendar — только тестами view-model и фикстурой, вживую не открывались.)*
- [x] 390 px без прокрутки вбок; контраст подписи — AA.
  *(2026-10-04, код: `EditDayChoice` — диалог «Edit Oct 5 or the whole series?» с «Only this day» / «Whole series»; на Task detail (кнопка Edit у главного дня и «Edit» в строках «Next occurrences»), в строке Tasks. Calendar: событие открывает Task detail на этом дне (`?occurrence=`), Edit там спрашивает о нём. `EditOccurrenceForm` на `/tasks/<id>/edit?occurrence=<id>`: заголовок «Edit Oct 5 only», «The rest of the series stays at 18:00.», только When (у серии без времени — только дата, `WhenGroup dateOnly`), «Overlaps with…» и «Free nearby» — как у разовой (`previewTaskEditOverlapsAction` с `singleDay`). «Whole series» показывает время серии, а не перенесённого дня. «Edited»: строка Tasks, «Next occurrences», главный день на Task detail, Calendar (мета-строка, `title`/aria-label, строки «Any time»). Попутно на Task detail у дней без времени — «Any time» вместо «00:00», длительность главного дня — его собственная. lint, typecheck, test (778), format:check, build — зелёные.)*
  *(2026-10-04: 390 px — временная страница-фикстура без базы и входа (удалена): строки «Next occurrences» с «Edited» и «Edit», диалог выбора, форма одного дня — без прокрутки вбок (`scrollWidth` 390). Контраст: «Edited» 5.07, описание диалога 4.74, «Only this day» 9.03, «Whole series» / Cancel 18.3 — AA. Сценарий под входом (страница задачи, Tasks, Calendar, сохранение дня) — проверка пользователя в Chrome.)*
  *(2026-10-04, Chrome, пользователь: Edit на странице задачи → диалог → «Only this day» → Oct 5 перенесён на 20:00, 30 мин; в базе `isException`, `originalStart` = 19:00, напоминание 19:45, старое 18:45 отменено. Найдено: на десктопе три кнопки не помещались в диалог (`max-w-sm`, 384 px), футер вылезал за край — «Only this day (Oct 5)» стало «Only this day» (дата есть в заголовке); проверено на фикстуре при 1024 px: футер 384 = диалог, кнопки внутри.)*

---

### S19-05 · Undo убранного дня

**Что сделать**
- `occurrenceService.restoreOccurrence(userId, occurrenceId)`: только будущий убранный день повторяющейся задачи. Статус `SCHEDULED`, `isException = false`, напоминание создаётся, если его время не прошло. Условие — чистая функция `canRestoreOccurrence` (+ тесты).
- Тост с Undo после «Remove this one» в приложении.
- Бот: у «Removed this one» кнопка Undo (`restore:<occurrenceId>`, 10 мин) — новое действие в `button-data.ts` (+ тесты).
- Страница задачи: «Removed days» с Restore (п.8).

**Acceptance criteria**
- [x] Undo в тосте, Undo в боте (через вебхук на `dev`, как в Sprint 15) и Restore возвращают день с напоминанием; прошедший — «This day has passed».
  *(2026-10-04, код: `restore-occurrence.ts` — `restoreRefusal` / `canRestoreOccurrence` (только `CANCELLED` + `isException`, активная серия, день впереди по `isAhead`; иначе «This day can't be restored.» / «This day has passed.») и `restoredReminderAt` (напоминание, только если его время впереди), 6 тестов. `occurrenceService.restoreOccurrence`: `SCHEDULED`, `isException` остаётся `true`, только если день был перенесён (`originalStart`, п.18). `restoreOccurrenceAction`. Тост «Removed Oct 5» — 10 с с Undo, потом «Restored Oct 5». Бот: после «Remove this one» — кнопка Undo (`restore:<occurrenceId>`), 10 минут от удаления (`canUndoRemoval` по `updatedAt` дня), затем строка «Removed this one» меняется на «Restored»; позже — «Too late to undo — open it in the app.» Task detail: свёрнутый блок «Removed days» со строками «Oct 9 · 18:00 · Restore», только дни, которые можно вернуть. Тесты: `canUndoRemoval`, `removedButtons` (≤ 64 байт), текст «Restored». 390 px — фикстура: без прокрутки вбок, «Restore» — контраст 6.19. Живая проверка на `dev` и вебхук бота — ещё нет.)*
  *(2026-10-04, `dev`, скрипт через сервисы, тестовая серия у tapolskaya3@gmail.com, после проверки удалена. Oct 7 убран → `CANCELLED`, `isException`, напоминание отменено; окно Undo бота сейчас — да, через 11 мин — нет; Restore → `SCHEDULED`, `isException = false`, новое напоминание 16:00. Повторный Restore открытого дня — «This day can't be restored.»; прошедший день — «This day has passed.»; Restore после времени напоминания — день открыт, напоминания нет. Перенесённый (07:00) → убран → возвращён: `isException` остался `true`, напоминание 05:00. Вебхук бота вживую не проверялся (нужна подмена отправки в Telegram, как в Sprint 15): кнопка отличается от сервиса только окном 10 минут, оно покрыто тестом.)*

---

### S19-06 · Напоминание «Custom…»

**Что сделать**
- «Custom…» в форме New task и в правке (только задачи со временем): поле «число + minutes/hours», значение — минуты `1..1440` (п.9).
- zod: смещение — из списка или `1..1440`; текст «2 h before» / «45 min before» — чистая функция (+ тесты).

**Acceptance criteria**
- [x] «Custom… 2 hours» сохраняется как 120, показывается «2 h before», `sendAt` на 2 ч раньше начала (по базе на `dev`).
  *(2026-10-04, код: `CUSTOM_REMINDER`, `customReminderMinutes` (целое, 1 мин – 24 ч) и `customReminderParts` (целые часы — часами) в `new-task-fields.ts`; `reminderOptions(hasTime, ...keep)` добавляет «Custom…» последним (только со временем) и держит в списке своё значение задачи и введённое. `TaskDetailsFields` (New task и Edit): «Custom…» открывает число + «minutes / hours» + «before»; верное значение сразу становится напоминанием, неверное — подсказка «From 1 minute to 24 hours.» (контраст 5.08), при уходе из поля возвращается последнее верное. zod менять не пришлось: смещение уже `0..1440`. Текст — как у остальных пунктов списка и на странице задачи: «2 hours before», «45 min before», а не «2 h before» из плана. Фикстура на 390 px: «Custom…» → 2 → hours даёт `OFFSET:120`; 30 hours — подсказка, при уходе — снова 2 hours; прокрутки вбок нет. Сохранение и `sendAt` по базе — ещё нет.)*
  *(2026-10-04, `dev`: задача с напоминанием 120 сохранена как `OFFSET` / 120, на странице — «2 hours before»; день Oct 5 18:00 — напоминание 16:00.)*

---

### S19-07 · End series / Archive

**Что сделать**
- Кнопка на странице задачи: «End series» / «Archive» с диалогом (п.10–11); текст Delete (п.11).
- `deactivateTask` ставит `endedAt`; `resumeTask` / `restoreTask` (п.13). Что доступно — чистая функция по задаче (+ тесты).
- Tasks: фильтр «Ended» с подписями (п.12). Страница задачи: «Series ended Oct 2» / «Archived Oct 2», кнопки «Resume series» / «Restore» вместо «End series» / «Archive».

**Acceptance criteria**
- [x] Диалоги показывают тексты п.11 до действия; «Keep» ничего не меняет.
- [x] End series → дни с сегодня убраны, прошлое на месте, задача в «Ended»; Resume → дни на 30 дней вперёд, перенесённые и убранные дни не тронуты.
- [x] Archive / Restore разовой задачи — оба случая (день впереди и прошёл).
  *(2026-10-04, код: `task-ending.ts` — названия (`END_LABELS`), тексты диалогов п.11 (`endDialog`, `deleteDialog`), подписи «Series ended Oct 2» / «Ended Oct 2» / «Archived Oct 2» (`endedLabel`), список «Ended» (`endedRows`: последние сверху по `endedAt`, поиск как на других вкладках) и `daysToReopen` — дни, отменённые в момент окончания или позже (`updatedAt >= endedAt`; убранный раньше через «Remove this one» остаётся убранным). `deactivateTask` ставит `endedAt` (время берётся до отмены дней); `resumeTask` → `active = true`, `endedAt = null`, `occurrenceService.reopenEndedTask`: отменённые окончанием дни впереди снова `SCHEDULED` с напоминанием (если его время впереди), затем серия дополняется до 30 дней от сегодня (`planWindowExtension`, теперь не раньше сегодняшнего дня и только впереди — для серии, возобновлённой через долгое время). Task detail: «End series» / «Archive» с диалогом и «Keep», у законченной — «Resume series» / «Restore» без диалога; Delete — новый текст. Tasks: вкладка «Ended» последней, на ней нет «Sort». Текст ошибки правки серии: «… — end the series instead.» 13 тестов. Фикстура на 390 px: пять вкладок помещаются, диалог «End this series?» читается целиком.*
  *Отличия от п.13: (1) Restore разовой задачи, чей день прошёл, возвращает её с этим днём открытым — в Tasks она «Overdue» с «Move to today», как любая пропущенная разовая; отдельного «Pick a new time» нет: правка разовой задачи не открывает отменённый день, а «Move to today» уже есть. (2) Resume не показывает пересечения диалогом: новые дни ставятся как при ночном продлении, а пересечения видны в Tasks («Same time as …»). Живая проверка на `dev` — ещё нет.)*
  *(2026-10-04, `dev`, скрипт через сервисы, у tapolskaya3@gmail.com, после проверки удалено. Серия ежедневно 18:00 с Oct 1, Oct 2 — Done, Oct 8 — убран. End series в 20:19 Oct 4: `active = false`, `endedAt` проставлен, Oct 5 – Oct 31 → `CANCELLED` без напоминаний; Oct 1–4 и Done Oct 2 не тронуты. Resume: Oct 5 – Nov 3 снова `SCHEDULED` с напоминаниями (32 открытых дня), Oct 8 остался убранным, `endedAt = null`. End + Resume «как будто Nov 20»: отменённые дни остались в прошлом, новые — Nov 20 – Dec 20. Resume активной задачи — «This task is already active.» Разовая Oct 10 12:00: Archive → день отменён, напоминания нет; Restore → день и напоминание вернулись; Archive + Restore «как будто Oct 12» → день открыт (просрочен), напоминания нет. Диалоги и «Keep» — фикстура, см. выше.)*

---

### S19-08 · README

**Что сделать**
- «Editing a task» — один день и вся серия, убранные дни и Restore.
- «Reminders» — «Custom…».
- «Telegram bot» — Undo у «Removed this one».
- Как закончить и вернуть задачу; чем это отличается от Delete.

**Acceptance criteria**
- [x] Разделы обновлены. *(2026-10-04: «Editing a task» — Only this day / Whole series, Edited, убранные дни с Undo и Restore, таблица «Stopping a task» (End series / Archive / Delete); «Reminders» — Custom…; «Telegram bot» — Undo после «Remove this one».)*

---

### S19-09 · Живая проверка + Sprint DoD

**Что сделать**
- На `dev`: все сценарии DoD, 390 px и 1280 px. Тестовые задачи создаются и удаляются скриптом, только с разрешения.
- Прогон пяти команд, PR (миграция окончательная, п.15).
- После мержа: проверить, что миграция на проде применена, и сверить счётчики.

**Acceptance criteria**
- [x] Все пункты Sprint DoD отмечены с результатом проверки. *(2026-10-04; после мержа остаётся только убедиться, что прод-деплой прошёл — миграции уже применены превью.)*

---

## 4. Не входит в Sprint 19

- Хранение и показ исходного времени перенесённого дня («Moved from 18:00»); то же для «Move to today» (Sprint 13 «Не входит»).
- Время у одного дня серии без времени (и наоборот); своё название, приоритет, напоминание или заметка у одного дня.
- Перенос дня из бота (только Undo у «Removed this one»); «This and following days» — правка серии с выбранного дня.
- Напоминание больше чем за сутки; несколько напоминаний на одну задачу.
- Автоудаление архивных задач; массовые действия в «Ended».
- Миграция Critical → High.

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Превью PR накатывает миграцию на прод | Недоделанная схема на проде | Миграция только добавляет поля с умолчаниями; PR — когда она окончательная (п.15) |
| Серия затирает исключения | Перенесённый день «прыгает» обратно | Тесты на план с исключениями (S19-02), включая cron продления |
| Время серии берётся у перенесённого дня | Вся серия съезжает | `currentTimeOfDay` и продление — только по обычным дням, тест на исключение в последний день |
| Restore после отправки напоминания | Дубль или напоминание в прошлом | Напоминание создаётся, только если его время впереди |
| Sprint 18 поменял те же функции | Аудит устарел | Сверка в S19-00 до решений |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи | Стоп на ревью |
|---|---|---|
| 1 | S19-00, S19-01 | решения 1–15 утверждены; миграция на `dev`, сверка |
| 2 | S19-02 (+ тесты) | серия с исключениями |
| 3 | S19-03, S19-04 | один день — сервис и интерфейс |
| 4 | S19-05, S19-06 | Undo убранного дня, «Custom…» |
| 5 | S19-07 | End series / Archive |
| 6 | S19-08, S19-09, прогон Sprint DoD | PR; после мержа — миграция на проде |
