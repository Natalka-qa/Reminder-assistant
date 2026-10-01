# Sprint 16 — Mini App: приложение внутри Telegram

Источник: план, §18 «V1.3 — Telegram bot» («Telegram становится дополнительным UI»), и кандидат на следующий спринт из [sprint-15-tasks.md](./sprint-15-tasks.md) «Не входит»: Mini App, отмечен 2026-10-01 как понравившийся больше всего. Тема выбрана 2026-10-01.

Продолжение Sprint 15 — PR [#26](https://github.com/Natalka-qa/Reminder-assistant/pull/26) и доделки [#27](https://github.com/Natalka-qa/Reminder-assistant/pull/27). Ветка `sprint-16-tasks` — от `main` после мержа #27 (`57c2059`).

**Цель спринта:** то же приложение открывается прямо в Telegram — кнопкой меню бота или кнопкой Open под напоминанием — и сразу со входом, без Google и без пароля.

- Вход — по данным, которые Telegram сам передаёт Mini App (`initData`), подписанным токеном бота. Работает только для чата, уже привязанного на `/settings` (Sprint 10).
- Внутри — обычные страницы: Home, Tasks, Calendar, New task, Settings. Отдельной вёрстки нет; добавляется только то, что нужно Telegram: кнопка «Назад» в шапке Telegram, цвета шапки, высота экрана.
- Open под напоминанием, `/next` и новой задачей открывает задачу внутри Telegram, а не во внешнем браузере.
- Новой таблицы и миграции нет: сессия — обычная строка `Session` Auth.js.

**Sprint Definition of Done**

- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит. *(2026-10-01: все пять локально зелёные, 640 тестов; CI — когда будет PR.)*
- [ ] Кнопка меню бота открывает Mini App; привязанный пользователь сразу попадает на Home со входом. Повторное открытие — без повторного входа. *(Локально: `/telegram` с подписанной строкой → Home/`callbackUrl` со входом; повторное открытие с cookie → сразу на страницу, новой сессии нет. Кнопка меню — после мержа, на проде.)*
- [x] Непривязанный Telegram-аккаунт видит «Connect this Telegram account first» и кнопку, открывающую `/settings` во внешнем браузере. Сессия не создаётся, данные не видны. *(S16-03; API — `404`, без `Set-Cookie`. Что `openLink` открывает именно внешний браузер — на телефоне.)*
- [x] `initData` проверяется на сервере: подпись токеном бота, свежесть (`auth_date` не старше 1 часа). Подделанная, старая или чужого бота — 401, сессии нет. *(S16-01 тесты; вживую 2026-10-01 повторно: подделка, 3700 с, чужой бот → `401` без `Set-Cookie`.)*
- [x] Страница `/telegram`, открытая не из Telegram (в обычном браузере), не входит и предлагает обычный вход. *(S16-03.)*
- [x] `/login` внутри Telegram не показывает Google и почту (они там не работают), а сам входит через Telegram. *(S16-04.)*
- [ ] Open под напоминанием, `/next` и новой задачей открывает страницу задачи внутри Telegram, уже со входом. *(Данные кнопок — тесты S16-06; `/telegram?callbackUrl=/tasks/<id>` → задача со входом — вживую. Нажатие настоящей кнопки — на проде.)*
- [ ] На вложенных страницах (задача, правка, New task) в шапке Telegram есть «Назад» — ведёт назад; на Home, Tasks, Calendar, Settings её нет. Шапка и фон Telegram — цвета приложения. *(S16-05: по вызовам SDK — всё так; как это выглядит в настоящей шапке Telegram — на телефоне.)*
- [ ] Home, Tasks, Calendar, New task, Settings внутри Mini App: без горизонтальной прокрутки, нижняя навигация не перекрыта системными полосами, контраст AA. *(Без горизонтальной прокрутки на 390 px — да, все страницы; контраст новых экранов: `--text-secondary` на `--background` 5.07:1, `--text-primary` 14.46:1, белый на burgundy (кнопки) 9.03:1 — AA. Системные полосы — только на телефоне.)*
- [x] Sign out внутри Mini App выходит; следующее открытие снова входит через Telegram. *(S16-04: выход → «You're signed out», сессии нет; «Sign in with Telegram» и новое открытие `/telegram` → вход. На телефоне — ещё раз.)*
- [x] Новые тесты — только на чистую логику: проверка `initData`, выбор «Назад» по пути, данные кнопок. Настоящий Telegram не вызывается и не мокается. *(`init-data`, `telegram-session-cookie` (cookie, `callbackUrl`), `back-target` (`isNestedPath`, `backTarget`, `nextDepth`), `openAppButton` и кнопки — 35 новых тестов, 605 → 640.)*

---

## 1. Стартовое состояние (аудит по факту, 2026-10-01)

| Область | Что нашли |
|---|---|
| **Вход** | Auth.js (`lib/auth/config.ts`): Google и ссылка на почту (Resend), `PrismaAdapter`, `session: { strategy: "database" }` — сессия это строка `Session` (`sessionToken`, `userId`, `expires`) и cookie `authjs.session-token` / `__Secure-authjs.session-token`. Своего провайдера для Telegram нет. |
| **Почему не Google в Telegram** | Google не даёт входить во встроенных браузерах (`disallowed_useragent`), а ссылка из письма откроется во внешнем браузере, не в Mini App — сессия окажется не там. Значит, вход внутри Telegram нужен свой. |
| **`proxy.ts`** | Оптимистичная проверка: нет cookie сессии → редирект на `/login?callbackUrl=…` для `/dashboard`, `/tasks`, `/calendar`, `/settings`, `/progress`. Настоящая проверка — в DAL (`verifySession`). |
| **Привязка Telegram** | `User.telegramChatId` (`@unique`) — после `/start <code>` (Sprint 10). В личном чате с ботом `chat.id` равен `user.id` в Telegram — по нему Mini App и найдёт пользователя. `userService.getUserByTelegramChat` уже есть (Sprint 15). |
| **Бот** | Кнопки Open — обычные ссылки (`url`) на `$AUTH_URL/tasks/<id>`: открываются во внешнем браузере. Кнопки меню нет (только список команд `setMyCommands`). |
| **Вёрстка** | Mobile-first, `BottomNav` — `fixed bottom-0` с `pb-6`; страницы до 620 px. Тема — только светлая (handoff). |
| **Проверка вживую** | Mini App открывается только по публичному `https`: локальный `next dev` и превью PR (за входом Vercel) Telegram не откроет. Проверка в настоящем Telegram — только на проде, после мержа. |
| **Паттерн тестов** | Спринты 8–15: тестируется только чистая логика. |

### Расхождения / решения на этот спринт

Нужны решения — у каждого рекомендация.

1. **Вход по `initData`, не через Google.** Telegram передаёт Mini App подписанную строку с `user.id` и `auth_date`. Сервер проверяет подпись по [документации Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) (`HMAC-SHA256` с ключом из токена бота), находит пользователя по `telegramChatId = user.id` и создаёт обычную сессию Auth.js. Отдельный провайдер Auth.js не нужен: сессия та же, что после Google.
2. **Только уже привязанные аккаунты.** Новый пользователь из Telegram не создаётся: сначала вход в браузере и «Connect» на `/settings`, как сейчас. Иначе появились бы аккаунты без почты, а с ними — напоминания на почту, Google Calendar и т. п.
3. **Свежесть — 1 час.** `auth_date` старше часа — отказ. Telegram выдаёт новую строку при каждом открытии, так что обычному пользователю это не мешает, а утёкшая строка быстро перестаёт работать.
4. **Сессия — 30 дней, как после Google.** Та же строка `Session`, тот же Sign out. Отдельного выхода «только из Telegram» нет.
5. **Cookie для Telegram Web.** В приложениях Telegram (iOS, Android, macOS, Windows) Mini App — отдельный встроенный браузер, cookie работает как обычно. В Telegram Web (`web.telegram.org`) Mini App — `iframe`, и cookie нужен `SameSite=None; Secure`, а браузеры всё чаще режут такие cookie совсем. Рекомендация: полностью поддерживаем приложения Telegram; сессия, созданная из Mini App, ставит cookie с `SameSite=None; Secure` (на `https`), а Telegram Web — «как получится», без отдельных обходов. Сессии из обычного браузера не меняются (`Lax`, как сейчас).
6. **Вход — страница `/telegram`.** Публичная (не в `proxy.ts`): подключает `telegram-web-app.js`, отправляет `initData` на `POST /api/telegram/session`, после успеха — на `callbackUrl` или Home. Кнопка меню бота открывает её (`setChatMenuButton`, один раз, командой в README — как `setWebhook` и `setMyCommands`).
7. **`/login` внутри Telegram** — если страница открыта в Mini App (есть `initData`), она сразу уходит на `/telegram?callbackUrl=…` вместо кнопок Google и почты. Иначе истёкшая сессия внутри Telegram приводила бы на вход, который там не работает.
8. **Open → кнопка Mini App.** Кнопки Open в боте становятся кнопками `web_app` на `/telegram?callbackUrl=/tasks/<id>`: задача открывается внутри Telegram и сразу со входом. В личном чате такие кнопки поддерживаются. Ссылка «Open New task» (поиск времени, Sprint 15 п.5) — тоже.
9. **Оформление — своё, светлое.** Тема Telegram (`themeParams`) не применяется: у приложения только светлая палитра (handoff). Шапке и фону Telegram задаются цвета приложения (`setHeaderColor`, `setBackgroundColor` = `--background`), чтобы не было тёмной полосы над светлой страницей. `ready()` и `expand()` — при загрузке.
10. **Кнопка «Назад» Telegram** — на вложенных страницах (`/tasks/[id]`, `/tasks/[id]/edit`, `/tasks/new`, `/progress`): ведёт `router.back()`. На разделах нижней навигации (Home, Tasks, Calendar, Inbox, Settings) скрыта. Какие пути вложенные — чистая функция.
11. **Высота экрана.** Внутри Telegram нижняя навигация должна стоять над системной полосой: добавляется отступ `env(safe-area-inset-bottom)` (он нужен и в обычном Safari на iPhone). Отдельной логики `viewportStableHeight` не делаем, пока не увидим проблему на устройстве.
12. **Проверка.** Локально — в обычном браузере на 390 px: `initData` подписывается тем же токеном бота скриптом (это наш бот и наш тестовый пользователь на ветке `dev`), подставляется в `/telegram` вместо `telegram-web-app.js`. Проверяем вход, отказы, «Назад», вёрстку. В настоящем Telegram — после мержа, на проде, от тебя: iPhone/Android и, если есть, Telegram Desktop.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S16-00 | Предпроверки: #27 смержен, ветка от `main`, `NEON_BRANCH=dev`; гайды Next по Route Handlers и cookies в `node_modules/next/dist/docs/` | 0.5 ч | — |
| S16-01 | Проверка `initData`: подпись, свежесть, пользователь (+ тесты) | 1 ч | — |
| S16-02 | Сессия из Telegram: `POST /api/telegram/session`, строка `Session`, cookie | 1.5 ч | S16-01 |
| S16-03 | Страница `/telegram`: SDK, вход, непривязанный аккаунт, не из Telegram | 1.5 ч | S16-02 |
| S16-04 | `/login` внутри Telegram → `/telegram` | 0.5 ч | S16-03 |
| S16-05 | Оформление в Telegram: «Назад», цвета шапки, отступ навигации (+ тесты) | 1.5 ч | S16-03 |
| S16-06 | Бот: Open и «Open New task» — кнопки Mini App; кнопка меню | 0.5 ч | S16-03 |
| S16-07 | README: Mini App, `setChatMenuButton` | 0.5 ч | S16-06 |
| S16-08 | Живая проверка на `dev` + прогон Sprint DoD; после мержа — в настоящем Telegram | 1.5 ч | всё выше |

Итого ~9 ч.

---

## 3. Задачи

### S16-00 · Предпроверки

**Что сделать**
- PR #27 смержен; `sprint-16-tasks` — от актуального `main`.
- `.env.local` — `NEON_BRANCH=dev`.
- Прочитать в `node_modules/next/dist/docs/` про Route Handlers, `cookies()` и `next/script` в этой версии Next (AGENTS.md).

**Acceptance criteria**
- [x] Ветка от `main` с #27; `NEON_BRANCH=dev`; заметки по гайдам Next — здесь. *(2026-10-01: `sprint-16-tasks` содержит `origin/main` = `57c2059`; `.env.local` — `NEON_BRANCH=dev`; Next 16.3.4.)*

**Заметки по гайдам Next 16.3.4**
- Route Handler — `app/.../route.ts` с `export async function POST(request: Request)`; не кэшируется (кэшируется только `GET` по выбору). Рядом с `page.tsx` того же сегмента быть не может — поэтому `app/api/telegram/session/route.ts`, а страница — `app/(auth)/telegram/page.tsx`.
- `cookies()` из `next/headers` — **async** (`await cookies()`); `.set(name, value, { httpOnly, secure, sameSite: "none" | "lax", path, expires })` — только в Route Handler или Server Function, не в Server Component. Есть `partitioned` (CHIPS) — пригодится для Telegram Web (п.5), но в этом спринте не включаем.
- `next/script`: `<Script src=… />` в layout/page грузится один раз на клиенте; стратегии `beforeInteractive` / `afterInteractive` (по умолчанию) / `lazyOnload`. Для `telegram-web-app.js` — `afterInteractive` + `onReady`/проверка `window.Telegram` в эффекте.

---

### S16-01 · Проверка `initData`

**Что сделать**
- `lib/telegram/init-data.ts` — `verifyInitData(raw, { botToken, now, maxAgeSeconds })` → `{ ok: true, telegramUserId, authDate } | { ok: false, reason }`:
  - строка разбирается как `URLSearchParams`, `hash` убирается, остальные пары сортируются и склеиваются через `\n`;
  - ключ — `HMAC-SHA256("WebAppData", botToken)`, подпись — `HMAC-SHA256(ключ, строка)` в hex; сравнение — `timingSafeEqual`;
  - `auth_date` старше `maxAgeSeconds` (3600) или из будущего больше чем на минуту — отказ (п.3);
  - `user` — JSON, берётся `id`.
- Тесты — на строках, подписанных в самом тесте тестовым токеном.

**Acceptance criteria**
- [x] Правильная строка → `ok` с `id`; изменённое поле, чужой токен, нет `hash`, старая `auth_date`, битый `user` → отказ с причиной. *(2026-10-01: `src/lib/telegram/init-data.ts` + 17 тестов в `init-data.test.ts`: подпись сверена с алгоритмом из документации, посчитанным в тесте вручную; отказы `bad-hash` (изменённое/добавленное поле, чужой токен, hash не той длины — без исключения), `missing-hash`, `expired` (> 3600 с; ровно 3600 — ещё можно), `from-future` (> 60 с вперёд), `missing-auth-date`, `bad-user` (нет, не JSON, не объект, нет/строковый/нулевой `id`). Подпись вынесена в `signInitData` — её же возьмёт скрипт локальной проверки (п.12). Все 605 тестов, lint, typecheck, format:check — зелёные.)*

---

### S16-02 · Сессия из Telegram

**Что сделать**
- `POST /api/telegram/session` (Route Handler): тело `{ initData }` → `verifyInitData` → `userService.getUserByTelegramChat(String(id))`:
  - нет пользователя → `404 { reason: "not-linked" }`;
  - есть → строка `Session` (случайный `sessionToken`, `expires` +30 дней, п.4) и cookie сессии с тем же именем, что ставит Auth.js (`__Secure-` на `https`), `HttpOnly`, `Path=/`, `SameSite=None; Secure` на `https` (п.5) → `200`.
- Неверная подпись или старая строка → `401`, без подробностей.
- Создание сессии — в `features/user` (сервис → репозиторий), не напрямую из маршрута.

**Acceptance criteria**
- [x] Правильная строка привязанного пользователя → сессия в базе, cookie; `/dashboard` после этого открывается со входом. *(2026-10-01: на `dev` привязанных чатов не было (0 — ветка снята до привязки на проде), поэтому с разрешения временно `telegramChatId = "1"` у своего пользователя; строка для `id: 1` → сессия (`expires` +30 дней, тот же `userId`), `/dashboard` со входом. После проверки — `telegramChatId = null`, сессия удалена через Sign out; сессий у пользователя снова 6, как до проверки.)*
- [x] Чужой Telegram-аккаунт → 404, сессии нет; подделка → 401. *(2026-10-01, `next dev` + `dev`, строки подписаны тем же токеном бота скриптом из scratchpad (`signInitData`): непривязанный id → `404 {"reason":"not-linked"}`; старая (3700 с), чужой бот, изменённое поле → `401 {"reason":"invalid"}`; без тела → `400`. Cookie не ставится.)*

**Как сделано:** `userService.startTelegramSession(telegramUserId)` → `userRepository.findByTelegramChatId` + `createSession` (токен — 32 случайных байта hex, `expires` +30 дней). Cookie — `telegramSessionCookie()` в `lib/auth/telegram-session-cookie.ts` (+ тесты): имя как у Auth.js (`__Secure-` при `https` у запроса — то же правило, что в `@auth/core` `init.js`), `HttpOnly`, `Path=/`, на `https` — `Secure; SameSite=None`, на `http` — `Lax`.

**Замечание к п.5:** Auth.js раз в сутки продлевает сессию и перезаписывает cookie своими опциями (`SameSite=Lax`). В приложениях Telegram это ничего не меняет; в Telegram Web (iframe) вход может «отвалиться» через сутки — в рамках «как получится».

---

### S16-03 · Страница `/telegram`

**Что сделать**
- `app/(auth)/telegram/page.tsx` (публичная) + клиентский компонент:
  - `telegram-web-app.js` через `next/script`;
  - есть `initData` → «Signing you in…» → `POST /api/telegram/session` → `router.replace(callbackUrl ?? "/dashboard")`; `callbackUrl` — только свой путь (начинается с `/`, не `//`);
  - `not-linked` → «Connect this Telegram account first» + кнопка, открывающая `/settings` во внешнем браузере (`Telegram.WebApp.openLink`);
  - нет `initData` (открыто не из Telegram) → «Open this page from the bot in Telegram» и ссылка на обычный вход;
  - ошибка сети или 401 → «Couldn't sign you in — close and open the app again».
- `ready()` и `expand()` при загрузке.

**Acceptance criteria**
- [x] Все четыре исхода — на `dev`, подставленной строкой (п.12). *(2026-10-01, 390 px, Playwright без cookie; строка подставляется в `#tgWebAppData=…` — так её передаёт сам Telegram, и настоящий `telegram-web-app.js` её читает, отдельной подмены в коде нет:*
  - *[x] не из Telegram (без hash) → «Open this page from the bot in Telegram» + «Go to sign in» (`/login`); `initData` пустой;*
  - *[x] непривязанный id → «Connect this Telegram account first» + «Open Settings in the browser»; cookie нет;*
  - *[x] подделанная строка → «Couldn't sign you in — Close the app and open it again from the bot»; cookie нет;*
  - *[x] уже со входом (вкладка с сессией) → `/telegram?callbackUrl=/tasks` сразу на `/tasks`, новая сессия не создаётся;*
  - *[x] привязанный пользователь (временный `telegramChatId = "1"`) → «Signing you in…» → `/tasks` (`callbackUrl`); повторное открытие `/telegram?callbackUrl=/calendar` → сразу `/calendar`, вторая сессия не создана; Sign out на Settings → `/login`, сессии нет (часть DoD «Sign out внутри Mini App» — ещё раз в S16-08);*
  - *без горизонтальной прокрутки на 390 px.)*

**Побочный эффект проверки (учесть в S16-08):** Home на `dev` запускает `sendDueNotifications` для вошедшего — с фиктивным `chatId` бот попробовал отправить просроченное напоминание (16:55) в чат `1` → Telegram «chat not found», никому не доставлено; само напоминание ушло письмом (`SENT`), как ушло бы при любом заходе на Home. В S16-08 — фиктивный chat id ставить только когда нет просроченных напоминаний, или открывать сначала не Home.

**Как сделано:** `app/(auth)/telegram/page.tsx` (сервер: `safeCallbackPath`, уже есть сессия → `redirect`) + `telegram-sign-in.tsx` (клиент). SDK — `lib/telegram/web-app.ts`: типы нужной части `Telegram.WebApp`, `useTelegramWebApp()` (перерисовка после загрузки скрипта) — пригодится в S16-04/05. Один POST на загрузку (`useRef`, иначе dev-режим React создавал бы две сессии). `callbackUrl` — только свой путь: `/x` да; `//x`, `/\x`, `https://…` → `/dashboard` (тесты).

---

### S16-04 · `/login` внутри Telegram

**Что сделать**
- На `/login` клиентская проверка: есть `window.Telegram?.WebApp?.initData` → `router.replace("/telegram?callbackUrl=…")`. SDK подключается и здесь.

**Acceptance criteria**
- [x] Внутри Telegram (подставленная строка) `/login` уходит на `/telegram` и входит; в обычном браузере `/login` как раньше. *(2026-10-01, Playwright без cookie, временный `telegramChatId = "1"` (как в S16-02, перед этим проверено: напоминаний к отправке в ближайшие 30 мин — 0): `/login?callbackUrl=/tasks#tgWebAppData=…` → `/telegram` → `/tasks` со входом, Google/почта не показаны. В обычной вкладке `/login` — почта, Google, подзаголовок; отступ под заголовком 12 px, как до правки.)*

**Добавлено к задаче — Sign out внутри Telegram.** Без этого Sign out ничего бы не делал: `/login` в Telegram сразу входил бы обратно. Sign out теперь ведёт на `/login?signedOut=1`; внутри Telegram с этим параметром — «You're signed out.» + «Sign in with Telegram» (→ `/telegram`), без автоматического входа; в браузере параметр ни на что не влияет. Проверено: Sign out → `/login?signedOut=1`, сессии нет, остаётся на странице; «Sign in with Telegram» → `/dashboard` со входом.

**Как сделано:** `login/telegram-login-gate.tsx` — клиентская обёртка вокруг подзаголовка, формы и подписи про почту; вне Telegram показывает их как есть. Пока скрипт Telegram не загрузился, видна обычная форма — внутри Telegram она может мелькнуть на долю секунды перед переходом; прятать её до загрузки скрипта не стали, чтобы не задерживать обычный вход (и не ломать его, если `telegram.org` недоступен).

---

### S16-05 · Оформление в Telegram

**Что сделать**
- Клиентский `TelegramChrome` в `(app)/layout.tsx`: ничего не делает вне Telegram. Внутри — `setHeaderColor` / `setBackgroundColor` (п.9) и «Назад» (п.10): `isNestedPath(pathname)` (чистая, + тесты) → `BackButton.show()` / `hide()`, нажатие → `router.back()`.
- `BottomNav`: нижний отступ `max(1.5rem, env(safe-area-inset-bottom))` (п.11); `<main>` — запас под него.

**Acceptance criteria**
- [x] `isNestedPath`: `/tasks/abc`, `/tasks/abc/edit`, `/tasks/new`, `/progress` — да; `/dashboard`, `/tasks`, `/calendar`, `/inbox`, `/settings` — нет. *(2026-10-01: `lib/telegram/back-target.ts` + 20 тестов. Вживую, по вызовам SDK (вне Telegram он пишет их в консоль, `BackButton.isVisible`): «Назад» видна на `/tasks/<id>`, `/tasks/<id>/edit`, `/tasks/new`, `/progress`; скрыта на `/dashboard`, `/tasks`, `/calendar`, `/inbox`, `/settings`. `setHeaderColor` / `setBackgroundColor` = `#f7f6f3` (`--background`), `ready()` и `expand()` — вызываются. Нигде нет горизонтальной прокрутки на 390 px.)*
- [x] Вне Telegram ничего не меняется (Home, Tasks на 390 px — как до спринта). *(2026-10-01: у `BottomNav` нижний отступ 24 px, у `<main>` — 96 px, как было `pb-6` / `pb-24`; Home на скриншоте — без изменений; `initData` пустой, Telegram ничего не вызывается.)*

**Поправка к п.10 — куда ведёт «Назад».** `router.back()` — только если внутри приложения есть куда возвращаться. Mini App, открытый кнопкой Open, стоит сразу на `/tasks/<id>` без истории, и `router.back()` вывел бы из приложения. Тогда «Назад» ведёт на родителя: правка → задача, задача → Tasks, New task → Home, Progress → Settings (`backTarget`). Есть ли история — приложение считает само (`nextDepth`: переход +1, `popstate` −1), потому что `history.length` включает то, что было в webview до приложения: так и нашлась ошибка в проверке — в новой вкладке Playwright `history.length` = 2 и «Назад» уводила на `about:blank`. Проверено: открыт сразу на правке → «Назад» → задача → «Назад» → `/tasks`, из приложения не выходит; с историей (Tasks → задача) → «Назад» → `/tasks` через `router.back()`.

**Отступ навигации (п.11):** `BottomNav` — `pb-[max(1.5rem,env(safe-area-inset-bottom))]`, `<main>` — `calc(4.5rem + того же)`; в корневом layout `viewport-fit=cover` — без него `env(safe-area-inset-*)` на iPhone всегда 0. Побочно: в горизонтальной ориентации iPhone контент может зайти под вырез сбоку (у страниц `px-6`) — проверить на телефоне в S16-08.

---

### S16-06 · Бот: кнопки Mini App и меню

**Что сделать**
- `occurrenceButtons`, `createdButtons` и «Open New task»: `{ text: "Open", web_app: { url } }` на `$AUTH_URL/telegram?callbackUrl=…` (п.8). Тип кнопки в `bot-messages.ts` — плюс `web_app`; тесты кнопок обновить.
- Кнопка меню — `setChatMenuButton` с `{ type: "web_app", text: "Open app", web_app: { url: "$AUTH_URL/telegram" } }`, один раз, из README.

**Acceptance criteria**
- [x] В перехваченных сообщениях бота Open — `web_app` с правильным `callbackUrl`. *(2026-10-01: проверено тестами на сами данные кнопок, а не перехватом вживую. Локально `AUTH_URL` — `http://localhost:3000`, а Telegram принимает Mini App только по `https`, поэтому на `http` Open намеренно остаётся обычной ссылкой (иначе Telegram отклонил бы всё сообщение вместе с напоминанием). Перехват через локальный вебхук ушёл бы в настоящий Telegram, а на фиктивный чат — с ошибкой, и показал бы только ссылку. Настоящий `web_app` — на проде после мержа (S16-08).)*

**Как сделано:** `openAppButton(text, appUrl, path)` в `bot-messages.ts` (+ 3 теста): на `https` → `{ web_app: { url: "$AUTH_URL/telegram?callbackUrl=<path>" } }`, на `http` → `{ url: "$AUTH_URL<path>" }`. `occurrenceButtons` и `createdButtons` теперь принимают `appUrl` (+ `taskId` у напоминания) вместо готового `taskUrl`; вызовы — напоминание (`notification.service.ts`), `/next` и новая задача (`telegram-bot.service.ts`), «Open New task» — тоже через `openAppButton`. Ссылка в письме-напоминании — обычная, как была. Ожидания в тестах кнопок переписаны на `web_app`; 640 тестов зелёные.
- Кнопка меню — шаг 6 в README «Telegram setup» (`setChatMenuButton`, `web_app` на `$AUTH_URL/telegram`, текст «Open app»); откат — тот же вызов с `{"type": "default"}`. Не запускалась: только после мержа, на прод-URL (S16-08).

---

### S16-07 · README

**Что сделать**
- «Telegram setup»: шаг с `setChatMenuButton`; раздел «Telegram bot» — Mini App: вход, кто может войти, что открывается.

**Сделано (2026-10-01):** «Telegram setup» — новый шаг 6 (`setChatMenuButton` и откат), «Connect» стал шагом 7; в «Telegram bot» — подраздел «Mini App»: откуда открывается, как входит (`initData`, подпись, 1 час, 30-дневная сессия), только привязанные, `/login` и Sign out внутри Telegram, «Назад» и цвета, `/telegram` в обычном браузере, Telegram Web — «может не работать», `http` → обычные ссылки, локальная проверка через `#tgWebAppData=…`. Тело `curl` проверено как JSON.

---

### S16-08 · Живая проверка и Sprint DoD

**Что сделать**
- На `dev`, 390 px, подставленной строкой: вход привязанного пользователя, непривязанный, подделка, старая строка, не из Telegram, `/login` в Telegram, «Назад», Sign out. Все экраны — без горизонтальной прокрутки. Временные сессии удалить.
- После мержа — от тебя: `setChatMenuButton` (или я, с твоего разрешения), открыть Mini App на телефоне: Home, задача из Open под напоминанием, New task, «Назад», Sign out.

**Локальный прогон (2026-10-01):** `build`, `lint`, `typecheck`, `test` (640), `format:check` — зелёные. На `dev` повторно: отказы (`404` непривязанный, `401` подделка / старая / чужой бот, без `Set-Cookie`); вход привязанного (временный `telegramChatId = "1"`, перед этим — напоминаний к отправке в ближайшие 30 мин 0; без захода на Home) → `200`, `Set-Cookie: authjs.session-token; HttpOnly; SameSite=lax` (локально `http`), `/tasks` с ней — `200`, без неё — `307 → /login`; `/telegram` с cookie → сразу `callbackUrl`, `callbackUrl=//evil.example` → `/dashboard`. Тестовая сессия удалена, `telegramChatId = null`, сессий у пользователя 6 — как до спринта. Временные файлы и `.playwright-mcp/` удалены.

**Осталось — только на проде, после мержа (чек-лист для телефона):**
- [ ] `setChatMenuButton` (README «Telegram setup» шаг 6) → кнопка «Open app» у бота.
- [ ] «Open app» → Home со входом; закрыть и открыть снова — без повторного входа.
- [ ] Шапка Telegram светлая, без тёмной полосы; нижняя навигация над полосой «домой».
- [ ] Open под напоминанием (или `/next`) → задача внутри Telegram; «Назад» → Tasks, не закрывает приложение.
- [ ] New task → «Назад» есть; на Home, Calendar, Inbox, Settings — нет.
- [ ] Sign out → «You're signed out»; «Sign in with Telegram» → снова вход.
- [ ] Горизонтальная ориентация iPhone: контент не уходит под вырез (`viewport-fit=cover`).
- [ ] Если есть — Telegram Desktop; Telegram Web — «как получится».
- [ ] Непривязанный аккаунт (другой Telegram, если есть) → «Connect this Telegram account first», кнопка открывает внешний браузер.

---

## 4. Не входит в Sprint 16

- Вход в Telegram для аккаунта, не привязанного заранее; создание аккаунта из Telegram.
- Тёмная тема и цвета из темы Telegram.
- Полная поддержка Telegram Web (`iframe`, сторонние cookie) — «как получится» (п.5).
- Нативные элементы Telegram: `MainButton`, haptics, `CloudStorage`, ссылки `t.me/<bot>/app`.
- Голосовой ввод внутри Mini App — работает, если работает во встроенном браузере; отдельно не проверяем.
- Из Sprint 15: подменю Snooze, Partly, просроченные с «Move to today», «Free nearby» и поиск времени в чате.
- Предупреждение о пересечении для фразы «разные дни с разным временем» (PR #27).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| Ошибка в проверке подписи | Вход в чужой аккаунт | Строго по документации Telegram, `timingSafeEqual`, тесты на подделку и чужой токен; только привязанные аккаунты |
| Утечка `initData` | Вход по чужой строке | Свежесть 1 час (п.3); строка подписана токеном нашего бота и годится только для него |
| `SameSite=None` на cookie | Слабее защита от CSRF | Только у сессий из Mini App; server actions Next проверяют Origin; маршруты Auth.js — со своим CSRF-токеном |
| Telegram Web режет cookie | Не входит в браузерном Telegram | Приложения Telegram — основной путь (п.5); в README честно «Telegram Web — может не работать» |
| Не проверить до мержа | Ошибка видна только на проде | Локальная проверка подставленной строкой (п.12); на проде — сразу после мержа, откат — убрать кнопку меню |
| Вёрстка в встроенном браузере | Навигация под системной полосой | `safe-area-inset-bottom` (п.11); проверка на телефоне после мержа |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи | Стоп на ревью |
|---|---|---|
| 1 | S16-00, S16-01 (+ тесты) | решения 1–12 утверждены; проверка подписи |
| 2 | S16-02, S16-03 | вход подставленной строкой на `dev`, все исходы |
| 3 | S16-04, S16-05 (+ тесты) | `/login` в Telegram, «Назад», вёрстка на 390 px |
| 4 | S16-06, S16-07 | кнопки бота, README |
| 5 | S16-08, прогон Sprint DoD | PR; после мержа — проверка в настоящем Telegram |
