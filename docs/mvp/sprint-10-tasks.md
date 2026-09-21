# Sprint 10 — V1.3: Telegram notifications

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), §18, **V1.3 — Telegram bot**:

```text
Telegram становится дополнительным UI.
Один backend и одна база.
```

Единственная строка в плане, без диаграммы и без деталей (в отличие от V1.1/V1.2). Продолжение [sprint-9-tasks.md](./sprint-9-tasks.md) — Sprint 9 смержен (PR [#10](https://github.com/Natalka-qa/Reminder-assistant/pull/10), в `main`), ветка `sprint-10-tasks` ответвляется от актуального `main`.

**Цель спринта:** Telegram — **второй канал доставки напоминаний**, наравне с email, а не второй интерфейс управления задачами. Пользователь привязывает свой Telegram-аккаунт на `/settings`, и `sendDueNotifications` (Sprint 6) отправляет то же напоминание в Telegram, если аккаунт привязан — в дополнение к email, не вместо него. Никаких bot-команд для управления задачами (`/today`, `/done`, quick-add через чат) — это отдельный, более крупный кусок плана, сознательно не входящий в этот спринт (см. «Расхождения» п.1).

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит.
- [ ] Без `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`TELEGRAM_BOT_USERNAME` — вся фича невидима: на `/settings` нет блока «Telegram», `env.ts` не падает, остальное приложение и CI работают как обычно (тот же принцип, что `ANTHROPIC_API_KEY` в Sprint 8).
- [ ] С заполненными тремя переменными: на `/settings` есть блок «Telegram» — не привязан → кнопка «Connect», генерирующая одноразовый код и ссылку `https://t.me/<bot>?start=<code>`; привязан → «Connected» + «Disconnect».
- [ ] Пользователь открывает ссылку, Telegram отправляет боту `/start <code>`; наш webhook (`/api/telegram/webhook`) находит пользователя по коду, привязывает `chatId`, шлёт в Telegram подтверждение. Код одноразовый и истекает через 10 минут.
- [ ] `notificationService.sendDueNotifications` отправляет то же напоминание в Telegram (если `telegramChatId` привязан), в дополнение к email. Сбой отправки в Telegram не блокирует и не откатывает email-путь — они независимы.
- [ ] Webhook проверяет секрет (`X-Telegram-Bot-Api-Secret-Token`), отклоняет запросы без него; всегда отвечает `200`, даже на «код не найден/истёк» (Telegram иначе будет ретраить update).
- [ ] Новые тесты только на чистую логику (форматирование сообщения, генерация/проверка срока действия кода, парсинг `/start <code>` из тела апдейта) — реальный вызов Telegram Bot API не мокается и не тестируется (см. «Расхождения» п.6).

---

## 1. Стартовое состояние (аудит по факту)

| Область | Что нашли |
|---|---|
| **Доставка напоминаний сейчас** | `notificationService.sendDueNotifications` (Sprint 6) — единственный канал: email через `sendEmail` (`lib/email/send-email.ts`, обёртка над Resend REST API) + in-app toast (`DueNotificationsToast`). Notification-строка одна на occurrence, её `status`/`attemptCount`/retry-логика (`markSent`/`markFailedOrRetry`) целиком завязана на успех/неуспех **email**-отправки. |
| **User модель** | `id`, `email`, `emailVerified`, `name`, `image`, `timezone`, `timezoneConfirmedAt` — ни одного поля под внешние мессенджеры. |
| **Паттерн внешнего API-клиента** | `lib/email/send-email.ts` — голый `fetch` к REST API провайдера (Resend), без SDK, только для одного call site. Тот же подход подходит для Telegram Bot API (`https://api.telegram.org/bot<token>/sendMessage`) — простой POST, SDK не нужен. |
| **Паттерн секретных эндпоинтов** | `/api/cron/*` — `Authorization: Bearer ${CRON_SECRET}`, сравнение строкой, `401` при несовпадении. Telegram использует свой собственный, штатный механизм для той же цели — заголовок `X-Telegram-Bot-Api-Secret-Token`, который Telegram присылает на каждый webhook-вызов, если секрет был задан при регистрации через `setWebhook`. Тот же принцип (сравнение shared secret), другой заголовок — потому что это требование самого Telegram Bot API, не наше изобретение. |
| **Паттерн опциональных секретов** | `ANTHROPIC_API_KEY` (Sprint 8) — единственный пример: `z.string().optional()` в `env.ts`, `isTaskDraftEnabled()` в сервисе, элемент UI просто не рендерится без ключа. Тот же паттерн подходит для Telegram — только тут три переменные должны быть заданы вместе (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`), а не одна. |
| **Settings-форма сейчас** | `SettingsForm` (после редизайна, PR #9) — `GroupedRows` с Timezone (реальный, сохраняемый) + 4 задизейбленных плейсхолдера «Coming in a later sprint». Blueprint для нового блока «Telegram» — реальная, интерактивная `GroupedRow`/секция, не плейсхолдер. |
| **Vercel Cron** | `vercel.json` — два `crons` входа, дергают `/api/cron/*` по расписанию. Webhook Telegram — не cron: Telegram сам вызывает наш URL при каждом сообщении, регистрируется один раз через `setWebhook` (см. «Расхождения» п.5), в `vercel.json` ничего добавлять не нужно. |

### Расхождения плана / решения на этот спринт

1. **Только канал уведомлений, не второй UI для управления задачами.** План говорит буквально «Telegram становится дополнительным UI» — но без единой детали (в отличие от V1.1/V1.2, у которых хотя бы диаграмма). Полноценные bot-команды (`/today`, `/done`, quick-add через чат) — это по объёму отдельный спринт (парсинг команд, зеркалирование web-действий, свой конфликт/валидационный флоу в контексте чата), а не естественное продолжение существующей `notificationService`. Notifications-only даёт пользователю реальную ценность (напоминания туда, где он их не пропустит) почти без нового поверхностного слоя — расширяет уже работающий канал, а не строит новый.
2. **Привязка аккаунта — одноразовый код + deep link, не логин через Telegram.** Простейший безопасный способ связать `User.id` с Telegram `chatId` без OAuth-подобного флоу: `/settings` генерирует случайный код с TTL 10 минут, показывает ссылку `https://t.me/<bot>?start=<code>` (Telegram сам поддерживает `?start=` как способ передать параметр боту при первом открытии диалога) → пользователь просто нажимает на ссылку → Telegram отправляет боту `/start <code>` → наш webhook находит юзера по коду и привязывает `chatId`. Код одноразовый (обнуляется сразу после использования), истекает — предотвращает угадывание/устаревшую ссылку, привязывающую не того пользователя.
3. **Три переменные окружения обязательны вместе, не по отдельности.** `TELEGRAM_BOT_TOKEN` (отправка сообщений и обработка апдейтов), `TELEGRAM_WEBHOOK_SECRET` (проверка, что вебхук реально от Telegram), `TELEGRAM_BOT_USERNAME` (нужен для deep-link на `/settings` — без него нечего показывать пользователю). Фича включена (`isTelegramEnabled()`), когда заданы все три — частичная настройка (например, только токен без username) не имеет смысла и не покрывается отдельным случаем.
4. **Сбой Telegram-отправки не трогает существующую retry-логику email.** `Notification.status`/`attemptCount`/`markFailedOrRetry` уже целиком описывают жизненный цикл **email**-доставки (Sprint 6). Дублировать эту машину состояний под второй канал — сложность, которая не нужна для «дополнительного, best-effort» канала: Telegram-отправка — отдельный `try/catch` внутри того же цикла `sendDueNotifications`, её сбой просто логируется и не влияет на то, будет ли email ретраиться.
5. **Webhook регистрируется вручную один раз (`setWebhook` через `curl`/README-инструкцию), не через код приложения.** Регистрация webhook-URL у Telegram — одноразовая операция при заведении бота (а не то, что должно происходить при каждом деплое или холодном старте). README получает инструкцию с готовым `curl`-вызовом `setWebhook` (использует те же `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/сам URL) — разработчик выполняет её один раз после того, как задеплоил `/api/telegram/webhook` и завёл бота.
6. **Реальный вызов Telegram Bot API не тестируется.** Та же причина, что и для Anthropic (Sprint 8) и голосового распознавания (Sprint 9): сеть, нужен реальный токен, мокать весь HTTP-контракт — тестировать мок, не фичу. Тестируется только чистая логика: форматирование текста сообщения, генерация/проверка TTL кода, парсинг `/start <code>` из тела Telegram-апдейта.
7. **`telegramLinkCode`/`telegramLinkCodeExpiresAt` — поля на `User`, не отдельная таблица.** Одному пользователю нужен максимум один активный код одновременно (повторная генерация просто перезаписывает старый) — отдельная таблица с её собственной моделью/репозиторием была бы сложностью без необходимости на этом масштабе.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S10-01 | Схема: `telegramChatId`/`telegramLinkCode`/`telegramLinkCodeExpiresAt` на `User`, миграция | 0.5 ч | — |
| S10-02 | `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`TELEGRAM_BOT_USERNAME` в `env.ts`/`.env.example`, `isTelegramEnabled()` | 0.5 ч | S10-01 |
| S10-03 | `lib/telegram/send-telegram-message.ts` + `lib/telegram/reminder-telegram-message.ts` (чистое форматирование) | 1 ч | S10-02 |
| S10-04 | `user.service`/`user.repository`: генерация кода, привязка/отвязка chatId | 1 ч | S10-01 |
| S10-05 | `/api/telegram/webhook` route — проверка секрета, парсинг апдейта, привязка | 1.5 ч | S10-03, S10-04 |
| S10-06 | `notificationService.sendDueNotifications` — Telegram-отправка рядом с email | 1 ч | S10-03, S10-04 |
| S10-07 | UI на `/settings`: блок «Telegram» (Connect/Connected/Disconnect) | 1.5 ч | S10-04 |
| S10-08 | Тесты чистой логики (форматирование, TTL, парсинг апдейта) | 1 ч | S10-03, S10-04, S10-05 |
| S10-09 | README/`.env.example`: секреты + инструкция по `setWebhook` | 0.5 ч | S10-05 |

**Итого:** ≈ 8.5 ч.

---

## 3. Задачи

### S10-01 · Схема

**Что сделать**
- `prisma/schema.prisma`, модель `User`: `telegramChatId String? @unique`, `telegramLinkCode String? @unique`, `telegramLinkCodeExpiresAt DateTime?`.
- `prisma migrate dev` — новая миграция.

**Acceptance criteria**
- [ ] Существующие пользователи (все три поля `null`) не ломаются — миграция не требует бэкфилла.

---

### S10-02 · Переменные окружения

**Что сделать**
- `.env.example`/`src/lib/env.ts` — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, все `z.string().optional()`.
- `src/lib/telegram/telegram.config.ts` (или прямо в `send-telegram-message.ts`) — `isTelegramEnabled()`: `true`, только если заданы все три.

**Acceptance criteria**
- [ ] Запуск без всех трёх переменных проходит нормально; с частично заданными (например, только токен) `isTelegramEnabled()` всё равно `false`.

---

### S10-03 · Telegram API клиент

**Что сделать**
- `lib/telegram/send-telegram-message.ts` — `sendTelegramMessage(chatId, text)`: голый `fetch` к `https://api.telegram.org/bot${TOKEN}/sendMessage`, по образцу `send-email.ts`.
- `lib/telegram/reminder-telegram-message.ts` — `buildReminderTelegramMessage({ title, timeLabel, durationMinutes, taskUrl })`: чистая функция, возвращает текст сообщения (без сети — тестируема так же, как `buildReminderEmail`).

**Acceptance criteria**
- [ ] `buildReminderTelegramMessage` не делает сетевых вызовов, покрыта юнит-тестом.

---

### S10-04 · Привязка аккаунта (сервис)

**Что сделать**
- `user.repository.ts`: `findByTelegramLinkCode(code)`, `setTelegramLinkCode(userId, code, expiresAt)`, `linkTelegramChat(userId, chatId)`, `unlinkTelegram(userId)`.
- `user.service.ts`: `generateTelegramLinkCode(userId)` — случайный код (например, 8 символов, `crypto.randomBytes`), TTL 10 минут, возвращает `{ code, expiresAt }`; `disconnectTelegram(userId)`; `linkTelegramFromCode(code, chatId)` — ищет юзера по коду, проверяет `expiresAt > now`, если ок — привязывает и обнуляет код, иначе — explicit failure (не исключение).

**Acceptance criteria**
- [ ] Просроченный или несуществующий код не привязывает `chatId` ни к какому пользователю.
- [ ] Успешная привязка обнуляет `telegramLinkCode`/`telegramLinkCodeExpiresAt` — код одноразовый, повторное использование того же кода не находит юзера.

---

### S10-05 · Webhook

**Что сделать**
- `src/app/api/telegram/webhook/route.ts` — `POST`: проверяет заголовок `X-Telegram-Bot-Api-Secret-Token` (`401`, если не совпадает или Telegram не настроен); парсит тело (Telegram Update) на `message.text` (`/start <code>`) + `message.chat.id`; вызывает `userService.linkTelegramFromCode`; шлёт в Telegram подтверждение или сообщение об ошибке через `sendTelegramMessage`; всегда отвечает `200` (даже на «код не найден») — не пробрасывает ошибку наружу, чтобы Telegram не ретраил апдейт бесконечно.
- Чистая функция парсинга апдейта (`parseStartCommand(update): { code: string; chatId: number } | null`) — вынесена отдельно ради тестируемости (S10-08), сам route — тонкая обвязка над ней.

**Acceptance criteria**
- [ ] Запрос без верного секрета — `401`, без вызова `userService`.
- [ ] Апдейт без `/start <code>` (любое другое сообщение) — `200`, ничего не привязывается, ответное сообщение не шлётся.

---

### S10-06 · Доставка через Telegram

**Что сделать**
- `notificationService.sendDueNotifications` — рядом с существующей email-отправкой (внутри того же `try` за email, или в соседнем `try/catch`, не блокирующем его): если `user.telegramChatId` задан и `isTelegramEnabled()`, собрать `buildReminderTelegramMessage(...)` и `sendTelegramMessage(user.telegramChatId, text)`. Сбой — `console.error`, не бросается наружу, не меняет `notificationRepository.markSent`/`markFailedOrRetry` (те остаются целиком про email, см. «Расхождения» п.4).

**Acceptance criteria**
- [ ] Пользователь без привязанного `telegramChatId` — поведение не меняется вообще (только email, как раньше).
- [ ] Сбой Telegram-отправки не помечает email-уведомление как проваленное и не блокирует его retry-логику.

---

### S10-07 · UI на `/settings`

**Что сделать**
- Новый компонент (например, `settings/telegram-connect.tsx`, client) — рендерится только когда `isTelegramEnabled()` (проп со страницы). Не привязан: кнопка «Connect Telegram» → server action `generateTelegramLinkCodeAction` → показывает ссылку/кнопку `https://t.me/<bot>?start=<code>` (открывается в Telegram) + инструкцию. Привязан (`telegramChatId` есть): «Connected» + кнопка «Disconnect» → `disconnectTelegramAction`.
- `settings/actions.ts` (или в существующий `features/user/actions.ts`) — оба server action, тот же `{ status, message? }` паттерн, что и `updateTimezoneAction`.

**Acceptance criteria**
- [ ] Без всех трёх переменных окружения — блока «Telegram» на `/settings` нет вообще.
- [ ] Сгенерированный код и ссылка видны сразу после клика «Connect», без перезагрузки страницы.

---

### S10-08 · Тесты

**Что сделать**
- `reminder-telegram-message.test.ts` — форматирование сообщения (по образцу `reminder-email.test.ts`).
- `user.service.test.ts` (или рядом с существующими) — генерация кода (длина/формат), TTL-проверка (просроченный код не проходит), не задевая реальную БД — на чистых функциях, где это возможно; там, где логика неотделима от `prisma`, тест не пишется (см. «Расхождения» п.6 — общий принцип «не тестируем сеть/внешние сайд-эффекты» распространяется и на слой, который сразу делает запрос в БД без промежуточной чистой функции).
- Парсинг апдейта (`parseStartCommand`) — юнит-тест на разные формы входного апдейта (валидный `/start CODE`, отсутствие текста, другая команда).

**Acceptance criteria**
- [ ] Ни один новый тест не обращается к реальному Telegram API или реальной БД.

---

### S10-09 · Документация

**Что сделать**
- `.env.example` — комментарии для всех трёх переменных: где взять токен (`@BotFather`), как узнать username бота, как сгенерировать `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 32`, по образцу `CRON_SECRET`).
- README — секция с готовым `curl`-вызовом `setWebhook` (одноразовая настройка после первого деплоя, см. «Расхождения» п.5).

**Acceptance criteria**
- [ ] Новый разработчик, следуя README, может завести бота, задеплоить и зарегистрировать webhook без дополнительных вопросов.

---

## 4. Не входит в Sprint 10

Bot-команды для управления задачами (`/today`, `/done`, `/snooze`, quick-add через чат — это следующий, отдельный кусок «Telegram как UI», не эта сессия); групповые чаты/несколько chatId на пользователя; локализация сообщений бота (только английский, как и весь остальной UI); настройка «включить/выключить Telegram-уведомления отдельно от email» (пока бинарно: привязан — получаешь оба канала); реальный end-to-end тест с живым ботом (нет доступа к токену на момент разработки — см. «Расхождения» п.1 в sprint-9-tasks.md о том же ограничении для Anthropic).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Кто-то узнаёт/перебирает код привязки | Чужой Telegram-аккаунт мог бы привязаться к аккаунту пользователя | Код — случайный (криптографически стойкий генератор), короткий TTL (10 минут), одноразовый (обнуляется сразу после использования) |
| Webhook вызывается не от Telegram (спуфинг) | Кто угодно мог бы дёргать `/api/telegram/webhook` напрямую | Обязательная проверка `X-Telegram-Bot-Api-Secret-Token` — запрос без верного секрета получает `401` до какой-либо бизнес-логики |
| `TELEGRAM_BOT_TOKEN` не настроен в проде при первом деплое после спринта | Не критично — вся фича просто невидима | Тот же паттерн, что уже работает для `ANTHROPIC_API_KEY`: явно опционально, ничего не падает, README/`.env.example` объясняют, как включить |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи |
|---|---|
| 1 | S10-01, S10-02, S10-03 |
| 2 | S10-04, S10-05 |
| 3 | S10-06, S10-07 |
| 4 | S10-08, S10-09, прогон Sprint DoD |
