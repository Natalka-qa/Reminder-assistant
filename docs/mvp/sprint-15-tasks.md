# Sprint 15 — Команды в Telegram

Источник: план, §18 «V1.3 — Telegram bot»: «Telegram становится дополнительным UI. Один backend и одна база». В Sprint 10 взята только доставка напоминаний, команды сознательно отложены («Не входит»: `/today`, `/done`, `/snooze`, быстрое добавление из чата). Тема выбрана 2026-09-30.

Продолжение [sprint-14-tasks.md](./sprint-14-tasks.md) — Sprint 14, PR [#24](https://github.com/Natalka-qa/Reminder-assistant/pull/24). Ветка `sprint-15-tasks` — от `main` после мержа #24 (`fabc3f0`).

**Цель спринта:** из привязанного чата можно работать с задачами, не открывая приложение.
- Посмотреть день: `/today`, ближайшую задачу: `/next`.
- Отметить напоминание прямо в сообщении: кнопки **Done · Snooze 15 min · Skip**, ниже — **Open**, а у повторяющейся задачи ещё **Remove this one**.
- Добавить задачу обычным сообщением: «Call mom tomorrow at 18» — так же, как фразой в New task, с кнопками **+1 h · Tomorrow**, чтобы сразу поправить время, и **Undo · Open**.
- Под полем ввода всегда есть кнопки **Today · Next** — команду можно не набирать.
- _Добавлено 2026-10-01:_ **утренняя сводка** — в выбранное время бот присылает план дня, у каждой открытой задачи кнопка «✓», нажатие отмечает её и обновляет сводку.
- Всё идёт через те же сервисы и ту же базу, что и веб. Новой таблицы нет; одна миграция — два поля сводки в `User` (только `ADD COLUMN`).

**Sprint Definition of Done** — прогон 2026-10-01 на `dev`, поддельными апдейтами; подробности — в задачах и S15-08.

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит. (Локально зелёные 2026-10-01, тесты 578/578; CI — на PR.)
- [x] `/today` — задачи на сегодня в поясе пользователя: время, название, статус; сверху — сколько просрочено. Пустой день — понятная фраза, не пустое сообщение.
- [x] `/next` — ближайшая невыполненная задача с кнопками Done · Snooze 15 min · Skip и Open.
- [x] Напоминание в Telegram приходит с этими кнопками. Нажатие меняет задачу так же, как кнопка на Home: статус, статистика, отмена или перенос напоминания. Сообщение после нажатия показывает итог («✓ Done»), кнопки исчезают.
- [x] Повторное нажатие или кнопка у уже закрытой задачи — ответ «This one is no longer open» (один текст на оба случая), без ошибки и без второго изменения.
- [x] Текст без команды → задача создаётся по тем же правилам, что и из фразы в New task (дата, время, длительность, повтор, важность; «Default reminder» из настроек). Ответ — что создано и когда, пересечение — строкой «Overlaps with …». Кнопка Undo удаляет только что созданную задачу, Open открывает её в приложении.
- [x] _Добавлено 2026-10-01:_ Open у напоминания, `/next` и новой задачи открывает страницу задачи. У повторяющейся задачи Remove this one убирает только это повторение — как в приложении (S14-10): пропадает из Home, Tasks и Calendar, остальная серия на месте. (Open — ссылка `$AUTH_URL/tasks/<id>` проверена в каждом ответе; открыть её в настоящем Telegram — на проде. Home — после правки в S15-08.)
- [x] _Добавлено 2026-10-01:_ Кнопки Today · Next под полем ввода появляются после привязки и `/help` и работают как `/today`, `/next`. Сообщение «Today» — команда, а не задача с таким названием.
- [ ] `/help` и меню команд в Telegram (`setMyCommands`). Неизвестная команда → подсказка. (`/help` и неизвестная команда — да; `setMyCommands` — после мержа, команда в README.)
- [x] _Добавлено 2026-10-01:_ +1 h под новой задачей сдвигает её на час, Tomorrow — на завтра в то же время; ответ обновляется, Undo и Open остаются. У повторяющейся задачи Tomorrow нет, у задачи без времени и после 23:00 — нет +1 h. Через 10 минут — «Too late to change — open it in the app».
- [x] _Добавлено 2026-10-01:_ «Morning summary» в блоке Telegram на `/settings`: Off / 07:00 / 08:00 / 09:00 / 10:00, по умолчанию Off. Включено → сводка приходит один раз в день, не раньше выбранного времени в поясе пользователя и не позже чем через 2 часа (иначе в этот день не приходит). Пустой день без просроченных — сводки нет.
- [x] _Добавлено 2026-10-01:_ Сводка — тот же текст, что `/today`, и кнопка «✓ 18:00 Gym» у каждой открытой задачи (до 8). Нажатие отмечает задачу и перерисовывает сводку с «✓». Повторный запуск cron в тот же день сводку не дублирует.
- [x] Чат, не привязанный ни к кому, на любое сообщение получает «Connect this chat from Settings», ничего не читает и не меняет. Кнопка с чужим занятием не срабатывает.
- [x] Вебхук всегда отвечает 200 — и на ошибки тоже, иначе Telegram повторяет апдейт.
- [x] Новые тесты — только на чистую логику: разбор апдейта, тексты сообщений, данные кнопок, поля задачи из фразы. Настоящий Telegram не вызывается и не мокается.
- [x] Веб после действий из чата показывает то же, что в базе (Home, Tasks, Calendar).

---

## 1. Стартовое состояние (аудит по факту, 2026-09-30)

| Область | Что нашли |
|---|---|
| **Вебхук** | `app/api/telegram/webhook/route.ts`: проверяет `x-telegram-bot-api-secret-token`, всегда 200. Понимает только `/start <code>` (`parseStartCommand`) — привязка из Sprint 10. Всё остальное молча игнорируется. |
| **Отправка** | `sendTelegramMessage(chatId, text)` — голый `fetch` к `sendMessage`, только текст, без `reply_markup` и `parse_mode`. Других методов Bot API нет (`answerCallbackQuery`, `editMessageText`). |
| **Напоминание** | `sendDueNotifications` → `buildReminderTelegramMessage({ title, timeLabel, durationMinutes, taskUrl })`: «X is scheduled for 18:00 (30 min).» и ссылка. Без кнопок, `occurrenceId` в сообщение не попадает. Шлётся один раз (S14-07). |
| **Пользователь по чату** | `User.telegramChatId` — `@unique`, но метода `findByTelegramChatId` в `userRepository` нет. Есть `findByTelegramLinkCode`, `linkTelegramChat`, `unlinkTelegram`. |
| **Действия с занятием** | `occurrenceService.completeOccurrence` / `skipOccurrence` (`transitionOccurrence`, проверка владельца и статуса), `notificationService.snoozeOccurrence(userId, id, option, timezone, tx)` с вариантами `15m · 30m · 1h · tomorrow`. Server actions (`completeOccurrenceAction` и др.) берут пользователя из сессии — из вебхука их не вызвать, но сервисы под ними — можно. Ошибки: `OccurrenceNotFoundError`, `InvalidOccurrenceTransitionError`. |
| **День** | `dashboardService.getTodayTasks / getOverdueTasks / getUpcomingTasks(userId, timezone)` — то, из чего собран Home. |
| **Фраза → задача** | `parseTask(text, today)` (`lib/parse-task`, en / ru / uk) → `resolveTaskFields(parsed, overrides, defaults)` (`new-task-fields.ts`) → `taskService.createTask(userId, timezone, input)`. Сейчас эта цепочка собрана в клиентском `new-task-form.tsx`. Поиск времени («find an hour tomorrow evening», `parsed.timeSearch`) в форме идёт отдельным `findFreeSlotsAction`. |
| **Где зарегистрирован вебхук** | Один URL на бота — прод (`$AUTH_URL/api/telegram/webhook`, README «Telegram setup»). Локальный `next dev` апдейтов от Telegram не получает. |
| **Паттерн тестов** | Спринты 8–14: тестируется только чистая логика. |

### Расхождения / решения на этот спринт

Все приняты 2026-10-01 по рекомендациям («начинай шаг 1»). 12–14 добавлены 2026-10-01 после обзора кнопок (пункты 1, 4, 5 списка).

1. **Текст без команды = новая задача.** Отдельный `/add` не нужен: быстрое добавление — главный смысл бота, и так оно работает во всех похожих ботах. Защита от случайного сообщения — кнопка Undo в ответе, а не подтверждение перед созданием (лишний шаг на каждой задаче). `/add <фраза>` тоже принимается — на случай, если человек так напишет.
2. **Сообщения бота — на английском**, как весь UI (решение F, 2026-09-25). Фразы задач можно писать по-русски и по-украински — парсер их читает.
3. **Пересечение не блокирует.** Как в New task v2: задача создаётся (`confirmConflicts=true`), в ответе строка «Overlaps with Gym 18:00–19:00». «Free nearby» в чате нет.
4. **Время уже прошло** («call mom at 9» в 11:00): задача создаётся, как в форме, ответ с пометкой «That time has already passed today» (тот же `pastNotice`).
5. **Поиск времени** («find an hour tomorrow evening»): в этом спринте не ищем — задача не создаётся, ответ «Finding a free time is in the app for now» и ссылка на New task. Поиск в чате — отдельная задача.
6. **Действия — через сервисы, пользователь — по `chatId`.** Новый `telegramBotService` находит пользователя по `telegramChatId` и вызывает те же `occurrenceService` / `notificationService` / `taskService` с его `userId` и `timezone`. Проверка владельца — внутри сервисов, как для веба. Server actions не трогаем.
7. **Данные кнопок** — `done:<occurrenceId>`, `snooze15:<occurrenceId>`, `skip:<occurrenceId>`, `undo:<taskId>`. Лимит Telegram — 64 байта, cuid — 25 символов. Чужой id → `OccurrenceNotFoundError` → «This one is no longer open».
8. **Undo — только своя, только что созданная задача.** `undo:<taskId>` удаляет задачу через `taskService.deleteTask`, если она создана не раньше 10 минут назад и из неё ещё ничего не выполнено. Иначе — «Too late to undo — open it in the app».
9. **Snooze в чате — только 15 минут.** Одна кнопка, как самая частая. Остальные варианты — в приложении.
10. **Меню команд** регистрируется один раз `setMyCommands` — командой в README рядом с `setWebhook`, без кода в приложении.
11. **Живая проверка.** Вебхук смотрит на прод, поэтому локально проверяем, отправляя поддельные апдейты в локальный `/api/telegram/webhook` с секретом, на ветке `dev`. Запросы к `api.telegram.org` перехватываются — в настоящий чат ничего не уходит. Проверка с настоящим ботом — после мержа, на проде, в твоём Telegram (это единственное, что нужно от тебя).
12. **Open — кнопка-ссылка** (`url`, не `callback_data`) на `$AUTH_URL/tasks/<taskId>`: Telegram открывает её сам, вебхук не участвует. Голая ссылка из текста напоминания убирается (S15-06) — её заменяет кнопка. Локально `AUTH_URL` — `localhost`; запросы к Telegram на локальной проверке перехвачены, так что это не мешает. На проде — настоящий адрес.
13. **Remove this one** — только у повторяющейся задачи, данные `remove:<occurrenceId>`, сервис — `occurrenceService.removeOccurrence` (S14-10). Итог в сообщении — «Removed this one». У разовой задачи кнопки нет: убрать единственное занятие — это удаление задачи, для него есть приложение.
14. **Today · Next под полем ввода** — обычная клавиатура Telegram (`reply_markup.keyboard`, `is_persistent`), отправляется с ответом на привязку и с `/help`. Нажатие присылает текст «Today» / «Next», `parseUpdate` читает его как команду (только точное слово, без учёта регистра: «Today at 18 gym» — по-прежнему задача).
15. **+1 h · Tomorrow под новой задачей** (пункт 8 списка кнопок, добавлен 2026-10-01). Данные — `later1h:<taskId>`, `tomorrow:<taskId>`. Правка — через `taskService.updateTask` с `confirmConflicts=true`, как форма правки: меняются только время или дата, остальные поля те же. Те же условия, что у Undo: своя задача, не позже 10 минут после создания, ничего не выполнено. После нажатия ответ перерисовывается (`createdMessage` с новыми датой и временем и новыми уведомлениями о пересечении), кнопки остаются — можно нажать ещё раз. Ограничения — в `createdButtons`: +1 h только у задачи со временем раньше 23:00 (позже час переходит в завтра), Tomorrow — только у разовой (дата повторяющейся не меняется, как в форме правки).
16. **Утренняя сводка — без нового cron.** Её отправляет тот же `/api/cron/send-notifications`, который cron-job.org вызывает каждые 5 минут (README, Hobby разрешает только ежедневные cron в `vercel.json`). Значит, сводка может прийти до 5 минут позже выбранного времени.
17. **Настройка — фиксированные варианты, по умолчанию Off.** `User.telegramSummaryMinutes Int?` (минуты от полуночи, `null` — выключено) и `User.telegramSummarySentOn String?` (`YYYY-MM-DD` в поясе пользователя — защита от повтора). Варианты Off / 07:00 / 08:00 / 09:00 / 10:00 — `Select` под «Connected» в блоке Telegram, как «Default reminder». Без привязанного чата настройки не видно. Off по умолчанию — чтобы сводка не пришла неожиданно тем, кто уже привязан.
18. **Окно 2 часа.** Если cron не запускался (сервер лежал), сводка в 13:00 уже не «утренняя» — в этот день её нет. Пустой день без просроченных — тоже без сводки, чтобы не слать «ничего нет» каждое утро.
19. **Кнопки в сводке — «✓ 18:00 Gym»**, по одной строке на открытую задачу, до 8 (остальные — «and 3 more», без кнопок). Данные — `sdone:<occurrenceId>`: отдельное действие, потому что после нажатия перерисовывается вся сводка (`todayMessage` заново), а не дописывается строка, как у напоминания. Snooze и Skip в сводке нет — для них есть напоминание и `/next`.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S15-00 | Предпроверки: #25 смержен, ветка от `main`, `NEON_BRANCH=dev` | 0.25 ч | — |
| S15-01 | Разбор апдейта: команда, текст, нажатие кнопки (+ тесты) | 1 ч | — |
| S15-02 | Тексты сообщений и кнопки: день, ближайшая, создано, итог нажатия, помощь (+ тесты) | 1.5 ч | — |
| S15-03 | Фраза → поля задачи на сервере, общая с формой (+ тесты) | 1.5 ч | — |
| S15-04 | Клиент Bot API: `sendMessage` с кнопками, `answerCallbackQuery`, `editMessageText` | 0.5 ч | — |
| S15-05 | `telegramBotService` и вебхук: `/today`, `/next`, `/help`, текст, кнопки, Undo | 2.5 ч | S15-01…04 |
| S15-06 | Напоминание с кнопками | 0.5 ч | S15-02, S15-04 |
| S15-07 | README: команды, `setMyCommands` | 0.5 ч | S15-05 |
| S15-09 | +1 h · Tomorrow под новой задачей (+ тесты) — добавлено 2026-10-01 | 1 ч | S15-05 |
| S15-10 | Сводка: миграция, «Morning summary» на `/settings`, «пора ли слать» (+ тесты) — добавлено 2026-10-01 | 1.5 ч | — |
| S15-11 | Сводка: отправка из cron, кнопки «✓», перерисовка — добавлено 2026-10-01 | 2 ч | S15-05, S15-10 |
| S15-08 | Живая проверка на `dev` + прогон Sprint DoD | 2 ч | всё выше |

Итого ~14.75 ч (S15-09…11 и +0.5 ч проверки добавлены 2026-10-01).

---

## 3. Задачи

### S15-00 · Предпроверки

**Что сделать**
- PR #25 (контраст и прокрутка Home) смержен; `sprint-15-tasks` — от актуального `main`. Если #25 ещё открыт — ветка от `main` без него, конфликтов нет (другие файлы).
- `.env.local` — `NEON_BRANCH=dev`.

**Acceptance criteria**
- [x] Ветка от `main`; `NEON_BRANCH=dev`. (2026-10-01: `sprint-15-tasks` от `origin/main` = `fabc3f0`. PR #25 ещё открыт — ветка без него, файлы не пересекаются.)
- [x] _Найдено до старта:_ привязка Telegram на проде не работала — у бота не был зарегистрирован вебхук (`getWebhookInfo` → `url: ""`), `/start` никуда не уходил. Секрет из `.env.local` совпадает с продом (запрос с ним → 200). 2026-10-01 вебхук зарегистрирован на `https://reminder-assistant-s63g.vercel.app/api/telegram/webhook`, привязка проверена в настоящем чате.

---

### S15-01 · Разбор апдейта

**Что сделать**
- `lib/telegram/parse-update.ts` вместо `parse-start-command.ts`: `parseUpdate(update)` →
  - `{ kind: "start", chatId, code? }` — `/start` с кодом и без;
  - `{ kind: "command", chatId, name, args }` — `/today`, `/next`, `/help`, `/add …`; `/today@BotName` тоже;
  - `{ kind: "text", chatId, text }` — обычное сообщение;
  - `{ kind: "button", chatId, callbackId, messageId, action, id }` — нажатие (`callback_query`), данные из п.7;
  - `null` — всё прочее (фото, стикер, пустой текст, битые данные кнопки).
- Тесты `parseStartCommand` переходят сюда же.

**Acceptance criteria**
- [x] `/start CODE`, `/start`, `/today`, `/today@bot`, `/add call mom`, «Call mom tomorrow», нажатие `done:…`, неизвестная кнопка `foo:1`, апдейт без текста — каждый даёт ожидаемый результат.

_Реализация (2026-10-01):_
- `src/lib/telegram/parse-update.ts` (бывший `parse-start-command.ts`, тесты переехали в `parse-update.test.ts`, 11 тестов).
- Данные кнопок — отдельно, в `button-data.ts`: `buttonData(action, id)` и `parseButtonData(data)`, ими пользуются и разбор, и кнопки из S15-02.
- **Отступление от плана:** нажатие с непонятными данными — не `null`, а свой вид `unknown-button` с `callbackId`. На каждое нажатие нужно ответить `answerCallbackQuery`, иначе у кнопки крутится индикатор. Неизвестная команда — `unknown-command` (для подсказки из DoD).
- Вебхук пока использует только `start` с кодом — поведение привязки не изменилось. Поддельные апдейты на локальный вебхук: `/start nope`, `/today`, нажатие, не-JSON → все 200; неверный код по-прежнему отвечает «That code isn't valid…» (в несуществующий чат — ошибка в логе, как и раньше).

---

### S15-02 · Тексты и кнопки

**Что сделать**
- `lib/telegram/bot-messages.ts`, без сети и базы:
  - `todayMessage(items, overdueCount)` — «Today · Wed, Sep 30», строки «18:00 · Gym · 1 h» с отметкой статуса (✓ done, · skipped); гибкая без времени — «Anytime»; пустой день — «Nothing planned for today.»;
  - `nextMessage(item)` / «Nothing left for today.»;
  - `createdMessage(fields, notices)` — «Added: Call mom · Thu, Oct 1 · 18:00» + строки «Overlaps with …» и «That time has already passed today»;
  - `buttonResultMessage(action)` — «✓ Done», «Snoozed until 18:15», «Skipped», «Removed»;
  - `helpMessage()`, `notLinkedMessage()`;
  - `occurrenceButtons({ id, taskUrl, recurring })` — Done · Snooze 15 min · Skip, ниже Remove this one (повторяющаяся) и Open; `createdButtons({ id, taskUrl })` — Undo · Open; `replyKeyboard()` — Today · Next (п.12–14).
- В напоминании: `buildReminderTelegramMessage` + `occurrenceButtons`.
- Тесты — в этом же шаге.

**Acceptance criteria**
- [x] Тексты по примерам выше, данные кнопок укладываются в 64 байта. (Самые длинные — `snooze15:` + cuid, 34 байта.)
- [x] Время и дата — в поясе пользователя (передаются готовыми строками).

_Реализация (2026-10-01):_
- `src/lib/telegram/bot-messages.ts`, 8 тестов в `bot-messages.test.ts`. Без Luxon и часов: дата, время, подписи повтора приходят строками.
- Отметки в `/today`: «✓» выполнено, «◐» частично, «· skipped ·» пропущено. Длительность — `formatDuration`, как на Home («1h», «1h 30min»).
- Уведомления в ответе на новую задачу — те же строки, что у формы (`overlapNotice`, `pastNotice`), `createdMessage` их просто перечисляет.
- `tsc`, `lint`, `format:check` — чисто, тесты 546/546.
- _Дополнено 2026-10-01 (п.15):_ `createdButtons({ id, taskUrl, time, recurring })` — +1 h · Tomorrow над Undo · Open, с ограничениями п.15; действия `later1h`, `tomorrow` в `button-data.ts`. Тесты 26/26 в `lib/telegram`.
- _Дополнено 2026-10-01 (п.12–14):_ Open, Remove this one и Today · Next. `remove` — пятое действие в `button-data.ts`. `parseUpdate` читает «Today» / «Next» как команды. `undoButton` заменён на `createdButtons`. +4 теста, всего 550/550.

---

### S15-03 · Фраза → поля задачи на сервере

**Что сделать**
- Вынести из `new-task-form.tsx` сборку `CreateTaskInput` из `parseTask` + `resolveTaskFields` + `newTaskDefaults` в чистую функцию `taskInputFromPhrase(text, { today, nowMinutes, defaultReminderMinutes })`. Форма пользуется той же сборкой — поведение формы не меняется.
- Возвращает `{ status: "ready", input, fields, parsed }`, либо `{ status: "needs-search" }` для фраз с поиском времени (п.5), либо `{ status: "empty" }`, если названия не осталось.
- Тесты — в этом же шаге.

**Acceptance criteria**
- [x] «Call mom tomorrow at 18» → завтра 18:00, FIXED; «Read 30 min» → сегодня, FLEXIBLE, 30 мин; «Позвонить маме в пятницу в 10» → пятница 10:00; «Gym every mon and wed» → еженедельно пн, ср. (В плане было «every Mon Wed» — парсер понимает дни только через «and», «every Mon Wed» даёт название «Gym Wed». Так же и в форме; парсер в этом спринте не меняем.)
- [x] Напоминание — из «Default reminder» пользователя.
- [x] New task на `dev` ведёт себя как до выноса (те же сценарии, что в S12-08).

_Реализация (2026-10-01):_
- `taskInput(title, fields, description)` в `new-task-fields.ts` — во что сохраняется задача: ровно те поля, что форма отдавала скрытыми полями (дни повтора — только у еженедельной, `confirmConflicts` — всегда). Форма теперь строит скрытые поля из неё.
- `taskInputFromPhrase` — в отдельном `features/tasks/phrase-task-input.ts`, а не в `new-task-fields.ts`, как было в плане: так `new-task-fields.ts` по-прежнему не зависит от парсера. 7 тестов.
- **На `dev`, 390 px, со входом:** пять фраз — четыре из критериев и «Find me 30 minutes tomorrow to call the bank» (поиск, первый слот 08:00). Скрытые поля формы сняты до правки (временно возвращён старый `new-task-form.tsx`) и после — **все поля совпадают** у всех пяти. «S15-03 check tomorrow at 7» → «Create task» → задача 02.10 07:00, Normal, напоминание 15 мин; удалена через Delete, страница задачи — 404.
- `tsc`, `lint`, `format:check` — чисто, тесты 558/558.

---

### S15-04 · Клиент Bot API

**Что сделать**
- `lib/telegram/send-telegram-message.ts` → `telegramApi(method, body)` и обёртки `sendMessage(chatId, text, buttons?)`, `answerCallbackQuery(id, text?)`, `editMessageText(chatId, messageId, text)` (без кнопок — они пропадают).
- Тот же голый `fetch`, без SDK.

**Acceptance criteria**
- [x] Старые вызовы (привязка, напоминание) работают как раньше.

_Реализация (2026-10-01):_ файл остался `send-telegram-message.ts`: общий `telegramApi(method, body)`, `sendTelegramMessage(chatId, text, replyMarkup?)` (старые вызовы — без третьего аргумента), `answerTelegramButton(callbackId, text?)`, `editTelegramMessage(chatId, messageId, text, replyMarkup?)`. В `parseUpdate` у нажатия добавлен `messageText` — текст сообщения, к которому дописывается итог.

---

### S15-05 · `telegramBotService` и вебхук

**Что сделать**
- `userRepository.findByTelegramChatId(chatId)`.
- `features/telegram/telegram-bot.service.ts` — `handleUpdate(parsed)`:
  - `start` с кодом — привязка, как сейчас, плюс `replyKeyboard()`; без кода у привязанного — `linkedMessage()` с `replyKeyboard()`;
  - непривязанный чат — `notLinkedMessage()` на всё, кроме `start` с кодом;
  - `/today`, `/next` — через `dashboardService`;
  - текст и `/add` — `taskInputFromPhrase` → `taskService.createTask` → `createdMessage` + Undo; пересечения — тем же `previewOverlaps`, что у формы;
  - кнопки — `completeOccurrence` / `snoozeOccurrence("15m")` / `skipOccurrence` / `removeOccurrence` (п.13) / `deleteTask` (п.8), затем `editMessageText` с итогом и `answerCallbackQuery`; ошибки перехода → «This one is no longer open»;
  - после изменений — `revalidatePath` тех же страниц, что у веб-действий.
- Вебхук: секрет → `parseUpdate` → `handleUpdate`, любая ошибка — лог и 200.

**Acceptance criteria**
- [x] Каждый пункт DoD про команды и кнопки проходит поддельным апдейтом на `dev` (S15-08).

_Реализация (2026-10-01):_
- `features/telegram/telegram-bot.service.ts` — `handleUpdate`; чистые части — `features/telegram/bot-view.ts` (6 тестов): `dayItems` (без `CANCELLED`), `pickNext`, `localNow`, `canFixCreatedTask`.
- `/next` — первая открытая задача **после текущего момента**, а если таких нет — самая ранняя из прошедших неотмеченных. Не правило Home «после 09:00» (`selectUpNext`): в чате «следующая» — от сейчас.
- `later1h` / `tomorrow` пока отвечают «Not available yet.» — это S15-09 (шаг 4).
- Пересечения для ответа — `slotService.previewOverlaps` **до** сохранения, как у формы. Сбой предпросмотра не мешает создать задачу.

_Проверка на `dev` (2026-10-01), локальный сервер:_ отправка в Telegram временно заменена логом (`[tg-fake]`), ни одного запроса к `api.telegram.org`. Двум пользователям `dev` временно привязаны поддельные чаты `900000001` (основной) и `900000002` (test@example.com); после проверки — снова `null`.
- Команды: `/help`, `/start` без кода → помощь с клавиатурой Today · Next; `/today` и «Today» → «Today · Thu, Oct 1 / 7 overdue tasks / 19:00 · English lesson · 40 min / 20:40 · Take Bellara»; `/next` → English lesson с Done · Snooze 15 min · Skip и Remove this one · Open (задача повторяющаяся); `/settings` → «I don't know that command» + помощь; `/add` без текста → подсказка; фраза с поиском → «Finding a free time is in the app for now» и Open New task; чужой чат → «This chat isn't connected…». Все — 200, ошибок в логе нет.
- Задачи из текста (в базе — ровно как из формы, напоминание 15 мин, `PENDING`): «S15 bot check tomorrow at 7» → 02.10 07:00 FIXED; «… today at 19 for 30 min» → «Overlaps with English lesson at 19:00.»; «… every mon and wed at 8» → «Every Mon, Wed», без кнопки Tomorrow; «… today at 9» → «09:00 has already passed today.» (сразу убрана Undo — её напоминание было уже в прошлом и ушло бы письмом).
- Кнопки: Done → `DONE`, напоминание `CANCELLED`, сообщение «✓ Done»; Done ещё раз → «This one is no longer open.»; Snooze 15 min → `SNOOZED`, старое напоминание `CANCELLED`, новое на +15 мин, «Snoozed until 09:42», в Tasks — «Snoozed — next reminder 09:42»; Remove this one → `CANCELLED`, «Removed this one»; Skip → `SKIPPED`; Remove this one у разовой → «no longer open»; Undo после Done → «Too late to undo»; Undo свежей → задача удалена; Done из чужого чата по чужому занятию → «no longer open», задача не изменилась; непривязанный чат → «isn't connected»; непонятные данные → «no longer open». На каждое нажатие — ровно один `answerCallbackQuery`.
- **Поправлено по ходу:** дата в ответе «Tomorrow · Oct 2» сливалась с разделителями строки («Added: X · Tomorrow · Oct 2 · 07:00») — теперь «Tomorrow, Oct 2».
- Временные задачи удалены (осталось 0), `tsc`, `lint`, `format:check` — чисто, тесты 564/564.

---

### S15-06 · Напоминание с кнопками

**Что сделать**
- `sendDueNotifications` шлёт напоминание с `occurrenceButtons({ id, taskUrl, recurring })`. Ссылка из текста напоминания убирается — её заменяет Open (п.12). Остальное (один раз, почта отдельно) — без изменений.

**Acceptance criteria**
- [x] В перехваченном запросе к `sendMessage` есть `reply_markup`: Done · Snooze 15 min · Skip нужного занятия и Open на его задачу; у повторяющейся — ещё Remove this one.

_Реализация (2026-10-01):_ `buildReminderTelegramMessage` больше не принимает и не пишет ссылку: «Workout is scheduled for 19:00 (60 min).» (тесты обновлены). `sendDueNotifications` отправляет его с `occurrenceButtons({ id, taskUrl, recurring })`; остальное — один раз, почта отдельно — без изменений.

_Проверка на `dev`:_ см. S15-09 — общая проверка шага 4.

---

### S15-07 · README

**Что сделать**
- «Telegram setup»: команды бота, кнопки, быстрое добавление; команда `setMyCommands` рядом с `setWebhook`.

_Сделано (2026-10-01):_ в «Telegram setup» — шаг 5 с `setMyCommands` (today, next, help), подсказка «нет ответа на /start → сначала `getWebhookInfo`» (случай 2026-10-01) и как проверять бота локально. Новый раздел «Telegram bot»: задача из сообщения и её кнопки, `/today`, `/next`, клавиатура, кнопки напоминания, утренняя сводка.

---

### S15-09 · +1 h · Tomorrow под новой задачей

**Что сделать**
- Кнопки — уже в `createdButtons` (S15-02, дополнено 2026-10-01).
- В `telegramBotService`: `later1h` / `tomorrow` → проверка «своя, 10 минут, ничего не выполнено» (общая с Undo) → `taskService.updateTask` с новой датой или временем → `editMessageText` с новым `createdMessage` и теми же кнопками.
- Сдвиг даты и времени — чистой функцией рядом с `taskInputFromPhrase` (+ тесты).

**Acceptance criteria**
- [x] 18:00 → +1 h → 19:00, ещё раз → 20:00; Tomorrow → завтра 18:00. В базе меняются только время или дата, напоминание переносится. (На `dev`: 21:00 → 22:00 → 23:00, у 23:00 кнопки +1 h уже нет.)
- [x] Через 10 минут — «Too late to change — open it in the app», задача не меняется.

_Реализация (2026-10-01):_
- `shiftedTaskInput(values, action)` в `bot-view.ts` (4 теста): задача — как её показала бы форма правки (`editTaskValues` по текущему занятию, `pickCurrentOccurrence`), сдвинуты только время или только дата. +1 h делает задачу Fixed — как время, введённое в форме руками; Tomorrow гибкость не трогает. Сохранение — `taskService.updateTask` с `confirmConflicts=true`.
- Ответ «Added: …» и кнопки собираются одной функцией `createdReply` — и при создании, и после сдвига. Пересечения теперь проверяются **после** сохранения, с `excludeTaskId` (S14-02): одна дорога для обоих случаев, результат тот же, что у формы до сохранения.

_Проверка шага 4 на `dev` (2026-10-01):_ отправка в Telegram — в лог, основному пользователю `dev` временно привязан чат `900000001` и выключена почта (чтобы cron не отправил письма); после проверки — чат `null`, почта снова включена. Кроме временных задач, ожидающих напоминаний не было.
- Три задачи из чата: «S15 one-off check today at 21», «… every day at 22», «S15 late check today at 23:15».
- **Напоминания:** двум задачам напоминание сдвинуто на «уже пора», `/api/cron/send-notifications` → `{"sent":2}`. Разовая: «S15 one-off check is scheduled for 21:00.», Done · Snooze 15 min · Skip, ниже Open. Ежедневная — то же плюс Remove this one. Ссылки в тексте нет.
- **+1 h · Tomorrow:** разовая 21:00 → 22:00 → 23:00 (у 23:00 остаётся только Tomorrow); ежедневная +1 h → 23:00 у всех 31 повторения, напоминания перенесены, кнопки Tomorrow нет и нажатие отвечает «no longer open»; «late check» 23:15: +1 h → «no longer open», Tomorrow → «Tomorrow, Oct 2 · 23:15». После Done из напоминания +1 h → «Too late to change»; задача с `createdAt` на 11 минут раньше → «Too late to change», не изменилась.
- **Найдено по ходу:** «S15 daily check every day at 22» → название «S15 check every day»: парсер берёт повтор из «daily», а «every day» остаётся в названии. В форме так же; фраза с обоими словами редкая — в этом спринте не правим.
- Временные задачи удалены (осталось 0), `tsc`, `lint`, `format:check` — чисто, тесты 568/568.

---

### S15-10 · Сводка: настройка

**Что сделать**
- Миграция: `telegramSummaryMinutes Int?`, `telegramSummarySentOn String?` в `User` (п.17), только `ADD COLUMN`, без значений по умолчанию.
- `/settings`, блок Telegram (привязан): «Morning summary» — `Select` Off / 07:00 / 08:00 / 09:00 / 10:00, сохраняется при изменении, тост «Saved», как «Default reminder».
- Чистая функция `isSummaryDue({ now, timezone, summaryMinutes, sentOn })` → `{ due: true, today } | { due: false }` (п.16, п.18) + тесты.

**Acceptance criteria**
- [x] Настройка сохраняется и видна после перезагрузки; без привязки её нет; Disconnect её не сбрасывает, но без чата сводка не шлётся. (Что сводка без чата не уходит — проверка в S15-11.)
- [x] `isSummaryDue`: 07:59 при 08:00 — нет; 08:00…09:59 — да; 10:00 — нет; уже отправлено сегодня — нет; переход на летнее время — по местному времени.

_Реализация (2026-10-01):_
- Миграция `20261001104818_add_telegram_summary`: `ALTER TABLE "User" ADD COLUMN "telegramSummaryMinutes" INTEGER, ADD COLUMN "telegramSummarySentOn" TEXT` — без значений по умолчанию, старый код новых полей не видит. Применена на `dev` (`migrate deploy`); на прод попадёт с превью PR.
- `telegramSummarySchema` и `SUMMARY_MINUTES` (420, 480, 540, 600) в `lib/validation/user.ts` (2 теста): «off» → `null`, иначе только время из списка. `userService.setTelegramSummary`, `updateTelegramSummaryAction(value)`.
- `/settings`, блок Telegram: строка «Morning summary» под «Reminders» — только когда чат привязан. `Select` Off / 07:00 / 08:00 / 09:00 / 10:00, сохраняется при выборе, тост «Morning summary saved», при ошибке значение возвращается. Подсказка: «Today's plan, sent to Telegram each morning» (Off) / «Today's plan, sent at this time».
- `features/telegram/summary-schedule.ts` — `isSummaryDue` (4 теста: окно 2 часа, выключено, уже отправлено, переход на зимнее время в Мадриде 25.10, день по поясу пользователя — Токио).

_Проверка на `dev` (2026-10-01, со входом, 390 px):_ основному пользователю временно привязан чат `900000001`. Строка «Morning summary» — «Off»; выбор 08:00 → тост «Morning summary saved», в базе `telegramSummaryMinutes = 480`; после перезагрузки — 08:00 и подсказка «sent at this time». Disconnect → строки нет, в базе 480 осталось. Вернула как было: чат и время — `null`. Горизонтальной прокрутки нет (`scrollWidth` 390). `tsc`, `lint`, `format:check` — чисто, тесты 574/574.

---

### S15-11 · Сводка: отправка и кнопки

**Что сделать**
- `telegramSummaryService.sendDueSummaries(now)` — пользователи с чатом и включённой сводкой → `isSummaryDue` → `dashboardService` → если есть задачи или просроченные: `todayMessage` + кнопки «✓ …» → `sendMessage` → `telegramSummarySentOn = today`. Отметка ставится **до** отправки (условным обновлением, как `claim` у уведомлений) — повторный запуск cron не дублирует.
- `/api/cron/send-notifications` вызывает её после `sendDueNotifications`, своей `try/catch` — сбой сводки не трогает напоминания.
- `summaryButtons(items)` в `bot-messages.ts` (п.19) + тесты.
- `sdone` в `telegramBotService`: `completeOccurrence` → `todayMessage` заново → `editMessageText`.

**Acceptance criteria**
- [x] Перехваченный `sendMessage`: текст как у `/today`, кнопки только у открытых задач, не больше 8.
- [x] Два запуска cron подряд — одна сводка.
- [x] «✓ 18:00 Gym» → задача выполнена в базе и на Home, сводка перерисована с «✓», у Gym кнопки больше нет. (В базе `DONE`, напоминание `CANCELLED`; Home обновляется тем же `revalidatePath`, что и кнопки напоминания в S15-05.)
- [ ] От тебя: cron-job.org действительно вызывает `send-notifications` каждые 5 минут (история запусков на cron-job.org или логи Vercel) — без него сводка не придёт.

_Реализация (2026-10-01):_
- `features/telegram/telegram-summary.service.ts`: `buildSummary(user, now)` — текст `/today` и `summaryButtons` (или `null` на пустой день без просроченных); `sendDueSummaries(now)` — получатели (`findSummaryRecipients`: есть чат и время) → `isSummaryDue` → `claimSummary` (условный `updateMany`, как `claim` у уведомлений) → отправка. Сбой отправки — в лог, без повтора.
- `/api/cron/send-notifications` — после напоминаний, в своей `try/catch`; ответ теперь `{ sent, summaries }`.
- `summaryButtons` (2 теста) и `openItems` (1 тест). Действие `sdone` — `completeOccurrence`, затем сводка собирается заново и заменяет сообщение.
- **Отступление от п.19:** строки «and 3 more» нет — текст сводки и так перечисляет весь день, ограничены только кнопки (8).
- Старая сводка, нажатая на следующий день, перерисуется уже планом нового дня — сообщение не помнит, за какой день оно. Редкий случай, оставлен.

_Проверка на `dev` (2026-10-01):_ отправка в Telegram — в лог. Основному пользователю — чат `900000001`, время сводки «10 минут назад», почта выключена (ожидающих напоминаний не было); тестовому — чат `900000002` и 00:00 (окно давно прошло). Временная задача «S15 summary check today at 23:30» из чата.
- cron → `{"sent":0,"summaries":1}`: «Today · Thu, Oct 1 / 7 overdue tasks / 19:00 · English lesson · 40 min / 20:40 · Take Bellara / 23:30 · S15 summary check», три кнопки «✓ 19:00 English lesson», «✓ 20:40 Take Bellara», «✓ 23:30 S15 summary check». `telegramSummarySentOn = 2026-10-01`. Тестовому — ничего.
- cron ещё раз → `summaries: 0`.
- «✓» из чата тестового пользователя → «This one is no longer open.», задача не изменилась. Своё «✓» → `DONE`, сводка перерисована: «✓ 23:30 · S15 summary check», кнопок две. Ещё раз → «no longer open».
- Чат отвязан, время осталось, отметка дня сброшена → cron → `summaries: 0`, отметка не появилась.
- Всё вернула: чаты, время сводки и отметка — `null`, почта включена, временных задач 0. `tsc`, `lint`, `format:check` — чисто, тесты 577/577.

---

### S15-08 · Живая проверка и Sprint DoD

**Что сделать**
- На `dev`, локальный сервер: поддельные апдейты от имени привязанного чата и от чужого чата; запросы к `api.telegram.org` перехвачены. Проверить базу до и после, временные задачи удалить.
- Web после действий из чата: Home, Tasks, Calendar.
- После мержа — от тебя: `setMyCommands` на проде и пара команд в настоящем чате.

**Acceptance criteria**
- [x] Сценарии выше пройдены, результат — здесь и в описании PR.
- [ ] После мержа: `setMyCommands`, `/today`, задача из сообщения и кнопка напоминания в настоящем чате.

_Итоговый прогон (2026-10-01, `dev`):_ отправка в Telegram — в лог, основному пользователю временно привязан чат `900000001`. Из чата: «S15 final check today at 22:30» и «S15 series check every day at 23:40». Done у первой, Remove this one у сегодняшнего повторения второй.
- Tasks: обе задачи на месте (вторая — «Daily · 23:40», серия цела). Calendar: сегодняшнего повторения нет, следующие на месте. Home: «S15 final check» зачёркнута (`line-through`).
- **Найдено и исправлено:** Home всё ещё показывал убранное сегодня повторение «S15 series check 23:40» и считал по нему «Free after 23:40». `dashboardService.getTodayTasks` брал занятия без фильтра по статусу; Calendar (`calendar-view.ts`) и Tasks (`task-list-view.ts`) убирают `CANCELLED` сами, а Home — нет. Ошибка из Sprint 14: в проверке S14-10 убирали не сегодняшний день, и её не было видно. Теперь `getTodayTasks` пропускает занятия через `withoutRemoved` (`home-view.ts`, 1 тест) — для Home, `/today`, `/next` и сводки. После правки: на Home повторения нет, «Free after 22:30».
- Временные задачи удалены (осталось 0), чат снова `null`, отправка в Telegram — настоящая.
- `npm run build` (миграция на `dev` уже применена), `typecheck`, `lint`, `format:check`, тесты 578/578 — зелёные.

---

## 4. Не входит в Sprint 15

- Поиск свободного времени из чата (п.5) и «Free nearby» кнопками при пересечении.
- Правка задачи из чата (название, произвольное время) — кроме +1 h · Tomorrow под новой задачей (п.15); удаление старых задач.
- Snooze на 30 мин / 1 ч / завтра из чата (подменю «Snooze ▸»), «Partly» у напоминания.
- Просроченные в `/today` с «Move to today», листание дней.
- Голосовые сообщения.
- Сообщения бота на русском и украинском.
- **Mini App — кандидат на следующий спринт** (понравился больше всего, 2026-10-01): приложение целиком внутри Telegram из кнопки меню. Нужны свой вход (данные `initData` от Telegram вместо Google) и проверка вёрстки во встроенном браузере. Утренняя сводка из этого же обзора взята в Sprint 15 (S15-10, S15-11).
- Своё время сводки (не из списка), вечерняя сводка, сводка на почту.
- Отдельное выключение Telegram-напоминаний (есть «Disconnect»).
- Групповые чаты и несколько чатов на пользователя.

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Случайное сообщение становится задачей | Мусор в списке | Undo в ответе (п.8); в ответе видно, что создано |
| Парсер понял фразу не так | Задача не на то время | Ответ показывает дату и время; Undo; те же правила, что в форме, с тестами |
| Telegram повторяет апдейт | Задача создаётся дважды | Всегда 200; при таймауте — дубль возможен, в логе видно. Если заметим — запоминать `update_id` (отдельная задача) |
| Чужой id в кнопке | Изменение чужой задачи | Проверка владельца в сервисах; тест и живая проверка с чужим чатом |
| Вынос логики из формы сломает New task | Регресс в главной форме | S15-03 отдельно, с проверкой сценариев S12-08 |
| Миграция на проде | PR-превью Vercel мигрирует прод-базу ещё до мержа | Только `ADD COLUMN` без значений по умолчанию (п.17) — старый код новые поля не видит |
| cron-job.org не запущен | Сводка не приходит | Проверка истории запусков в S15-11; напоминания при этом всё равно идут и при открытии Home |
| Сводка дважды | Два одинаковых сообщения утром | Отметка дня условным обновлением до отправки (S15-11) |
| Сводка не вовремя | Сообщение в 13:00 или ночью | Окно 2 часа и время в поясе пользователя (п.18) |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи | Стоп на ревью |
|---|---|---|
| 1 | S15-00, S15-01, S15-02 (+ тесты) | решения 1–11 утверждены; тексты сообщений |
| 2 | S15-03 (+ тесты) | New task не изменилась, фразы из чата дают те же поля |
| 3 | S15-04, S15-05 | команды и кнопки вживую на `dev` поддельными апдейтами |
| 4 | S15-06, S15-09 (+ тесты) | напоминание с кнопками, +1 h · Tomorrow вживую |
| 5 | S15-10 (+ тесты) | миграция на `dev`, настройка на `/settings` |
| 6 | S15-11 (+ тесты), S15-07 | сводка из cron вживую на `dev`, README |
| 7 | S15-08, прогон Sprint DoD | PR |
