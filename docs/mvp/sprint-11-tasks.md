# Sprint 11 — V1.4: Google Calendar (busy intervals, read-only)

Источник: [nextjs-personal-scheduling-assistant-mvp-plan.md](./nextjs-personal-scheduling-assistant-mvp-plan.md), §18, **V1.4 — Google Calendar**:

```text
Сначала только чтение busy intervals.
```

Одна строка в плане, как и у V1.3. Продолжение [sprint-10-tasks.md](./sprint-10-tasks.md) — Sprint 10 смержен (PR [#11](https://github.com/Natalka-qa/Reminder-assistant/pull/11)), его последний открытый пункт S10-08 (тест TTL кода привязки) закрыт PR [#15](https://github.com/Natalka-qa/Reminder-assistant/pull/15). Между спринтами в `main` также вошли Tasks v2 ([#13](https://github.com/Natalka-qa/Reminder-assistant/pull/13)) и удаление мёртвых `OccurrenceList`/`OccurrenceActions` ([#14](https://github.com/Natalka-qa/Reminder-assistant/pull/14)). Ветка `sprint-11-tasks` ответвляется от актуального `main`.

**Цель спринта:** при создании и редактировании задачи учитывать, что пользователь уже **занят в своём Google Calendar**, и предупреждать о пересечении так же, как о пересечении с другой задачей. Из Google читаются только интервалы «занят» (`freeBusy`), без названий, описаний и участников событий. Пользователь подключает календарь на `/settings` и может отключить его там же. Никакой записи в Google Calendar и никакого отображения чужих событий в интерфейсе — только проверка конфликтов (см. «Расхождения» п.1–2).

**Sprint Definition of Done**

- [x] `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check` зелёные; CI на PR проходит. (2026-09-25 локально — все пять зелёные, 190 тестов, `npm run build` против ветки `dev`, миграций нет; CI на PR [#16](https://github.com/Natalka-qa/Reminder-assistant/pull/16) — зелёный, смержен.)
- [x] Без `GOOGLE_CALENDAR_ENABLED=true` вся фича невидима: на `/settings` нет блока «Google Calendar», провайдер `google-calendar` не зарегистрирован, проверка конфликтов работает как раньше (тот же принцип, что `ANTHROPIC_API_KEY` в Sprint 8 и `TELEGRAM_*` в Sprint 10). (2026-09-25: блока нет — скриншот пользователя; `/api/auth/providers` без `google-calendar`, signin → `error=Configuration`; 0 запросов к Google.)
- [ ] С флагом: на `/settings` блок «Google Calendar» — не подключён → «Connect Google Calendar» (OAuth-согласие Google с правом `calendar.freebusy`); подключён → «Connected» + «Disconnect». Работает и для пользователя, вошедшего через Google, и для вошедшего по email-ссылке. (Блок, Connect, Disconnect, повторный Connect — проверены. Вход по email-ссылке → Connect вживую не подтверждён: локально Resend-sandbox доставляет письма только на адрес уже существующего пользователя, и 2026-09-25 его `emailVerified` не обновился — вход был не по ссылке. По коду путь тот же: Auth.js привязывает аккаунт к текущей сессии независимо от способа входа, `handle-login.js`.)
- [x] Создание/редактирование разовой задачи, пересекающейся с занятым интервалом в основном календаре Google, показывает этот интервал в существующем диалоге конфликта («Busy in Google Calendar · 14:00–15:00»); «Create anyway» сохраняет задачу. (Вживую — шаги 3–4; строка — «Google Calendar · Busy · Monday, September 28, 18:00–20:00».)
- [x] Повторяющаяся задача проверяется по всему окну генерации (30 дней) **одним** запросом к Google, а не запросом на каждое повторение. (31 повторение — 1 запрос `freeBusy`.)
- [x] Истёкший access token обновляется автоматически; отозванный доступ (`invalid_grant`) переводит подключение в «не подключено», а не в ошибку. (S11-03.)
- [x] Сбой или таймаут Google не блокирует создание задачи: задача сохраняется без этой проверки, пользователь видит об этом сообщение. (Toast на `/tasks/[id]` — подтверждён пользователем.)
- [x] Названия и детали событий не запрашиваются и не хранятся — только `start`/`end` занятых интервалов, и только на время проверки.
- [x] OAuth-приложение в Google Cloud — **In production** (S11-12) до того, как `GOOGLE_CALENDAR_ENABLED=true` появится в Vercel; до этого на проде флаг не включается. (2026-09-25: Branding заполнен → Publish app → затем флаг в Vercel Production + redeploy.)
- [x] Новые тесты только на чистую логику (решение об обновлении токена, разбор ответа `freeBusy`, пересечения, окно запроса для повторяющейся задачи) — реальный Google API не вызывается и не мокается (см. «Расхождения» п.10).

---

## 1. Стартовое состояние (аудит по факту)

| Область | Что нашли |
|---|---|
| **Вход через Google** | `src/lib/auth/config.ts` — `Google({ clientId, clientSecret })` без своих `authorization.params`: только `openid email profile`, без `access_type=offline`. Второй провайдер — `Resend` (email-ссылка). `session: { strategy: "database" }`, `PrismaAdapter`. Версии: `next-auth@5.0.0-beta.32`, `@auth/core@0.41.3`. |
| **Хранение токенов** | Модель `Account` (Auth.js) уже содержит `access_token`, `refresh_token`, `expires_at` (секунды, Int), `scope`, `token_type`, `id_token`; уникальность — `@@unique([provider, providerAccountId])`, так что второй провайдер с тем же Google-аккаунтом (`provider: "google-calendar"`) ложится отдельной строкой без конфликта. |
| **Данные на проде (2026-09-23)** | 2 пользователя. У одного есть `Account` `google` (`type: oidc`, scope `userinfo.profile openid userinfo.email`, **`refresh_token` нет**), второй входит только по email-ссылке (ни одного `Account`). Доступа к календарю нет ни у кого. |
| **Привязка аккаунтов в Auth.js** | `node_modules/@auth/core/lib/actions/callback/handle-login.js`: если пользователь **уже вошёл** и логинится новым OAuth-аккаунтом, тот привязывается к текущему пользователю (`linkAccount`, строки ~131–133 и ~207–209). Без сессии и с совпадающим email — `OAuthAccountNotLinked` (строка ~188). Если аккаунт уже привязан — «we don't need to do anything» (строки ~98, ~181): **токены при повторном входе не обновляются**. |
| **Проверка конфликтов** | `conflictService.findConflicts` (DB-запрос пересечений, `occurrence.repository.findOverlapping`). Вызывается в `task.service.createTask` (разовая — внутри `runInTransaction`, до вставки), `task.service.updateTask` (разовая — внутри транзакции), `occurrence.service.createOccurrencesForTask` (повторяющаяся — цикл по кандидатам внутри той же транзакции). Результат — `ScheduleConflictError(conflicts: ScheduleConflict[])` → `summarizeConflicts` в `features/tasks/actions.ts` → `ConflictSummary[]` → диалог в `task-form.tsx` (строки «Existing» с `title/timeLabel/priority/flexibility`), «Create anyway» пересабмитит с `confirmConflicts=true`. У повторяющейся задачи дата/время/повтор при редактировании заблокированы — повторная проверка по календарю при edit не нужна. |
| **Генерация дат повторений** | `generateOccurrenceDates(rule, anchorDate, fromDate, toDate, zone)` (`features/recurrence/occurrence-dates.ts`) — чистая, экспортируется; `buildCandidates` (время/длительность → интервалы) — приватная в `occurrence.service.ts`. |
| **Паттерн внешнего API-клиента** | Голый `fetch` без SDK: `lib/email/send-email.ts` (Resend), `lib/telegram/send-telegram-message.ts` (Telegram). Тот же подход подходит для Google (`oauth2.googleapis.com/token`, `googleapis.com/calendar/v3/freeBusy`) — SDK `googleapis` не нужен. |
| **Паттерн опциональных фич** | `ANTHROPIC_API_KEY` (Sprint 8), `TELEGRAM_*` + `isTelegramEnabled()` (Sprint 10): `z.string().optional()` в `env.ts`, UI просто не рендерится. |
| **Settings** | `settings/page.tsx`: `SettingsForm` (timezone), `TelegramConnect` под `isTelegramEnabled()`, статистика, выход. Блок «Google Calendar» — по образцу `TelegramConnect`. |
| **Google Cloud (проект OAuth-клиента входа)** | 2026-09-23: Google Calendar API включён, scope `calendar.freebusy` добавлен в Data access. Категория scope (sensitive / non-sensitive) — **не подтверждена**, нужна для «Расхождения» п.8. Redirect URI для `localhost:3000` отсутствовал (вход через Google локально давал `redirect_uri_mismatch`). **2026-09-24 (S11-00):** `calendar.freebusy` — **non-sensitive**; redirect URI `localhost:3000/api/auth/callback/google`, `localhost:3000/api/auth/callback/google-calendar`, `reminder-assistant-s63g.vercel.app/api/auth/callback/google-calendar` добавлены. **2026-09-25:** Publishing status фактически остался **Testing** — «Publish app» неактивна: «To publish your app, you must complete your configuration on the Branding page». Для External-приложения в production Google требует Homepage, Privacy Policy и Terms of Service URL на authorized domain; страниц политики и условий в приложении нет. В Testing запрос `calendar.freebusy` от пользователя не из Test users → «Access blocked… Error 403: access_denied» (вход с одними `openid email profile` этим не блокируется). **Позже 2026-09-25 (S11-12):** Branding заполнен, приложение опубликовано — **In production**. |
| **Локальное окружение** | `.env.local` смотрит в **production**-ветку Neon (`NEON_BRANCH=production`, проект `reminder_assistant`). Локальный `npm run build` выполняет `prisma migrate deploy` против прода. Для этого спринта (реальный OAuth + запись токенов) нужна отдельная dev-ветка — S11-00. **2026-09-23 (S11-00):** создана ветка `dev` (`br-silent-mud-b1dvyexr`, полная копия `production`), `.env.local` переключён на неё, прод-значения оставлены закомментированными. В `dev` — копии реальных пользователей и их привязок Telegram: локально не вызывать cron-роут напоминаний. |
| **Google API (документация)** | `freebusy.query` принимает любой из scope: `calendar.readonly`, `calendar`, `calendar.events.freebusy`, `calendar.freebusy`. Запрос: `timeMin`, `timeMax` (RFC3339), `items: [{ id }]`, опц. `timeZone`. Ответ: `calendars[id].busy[] = { start (включительно), end (исключительно) }`, возможны `calendars[id].errors`. Refresh token: в режиме **Testing** (external) выдаётся **на 7 дней**, если запрошены scope сверх name/email/profile; также инвалидируется при отзыве доступа, 6 месяцах неиспользования, лимите 100 refresh-токенов на клиента и аккаунт. |

### Расхождения плана / решения на этот спринт

1. **Только `freeBusy`, без событий.** План говорит «только чтение busy intervals» — ровно это: scope `https://www.googleapis.com/auth/calendar.freebusy` (самый узкий из подходящих), запрос `freeBusy.query`. Названия, описания, участники событий не запрашиваются вообще — и приватнее, и меньше доверия нужно от пользователя на экране согласия.
2. **Где используется: только проверка конфликтов при создании/редактировании.** Отображение занятых блоков на Calendar/Home — отдельная UI-работа без дизайна (в handoff её нет) и с вопросами кэширования; для первого шага ценность — не создать задачу поверх встречи. Показ busy-блоков — следующий спринт.
3. **Подключение — второй провайдер Auth.js `google-calendar`, токены в `Account`, без миграции.** Не расширяем scope основного входа через Google: (а) Auth.js не обновляет токены при повторном входе уже привязанным аккаунтом (см. аудит), так что новый `refresh_token` просто не сохранился бы; (б) вход должен оставаться с минимальными правами, а календарь — отдельное явное действие. Отдельный провайдер с тем же `GOOGLE_CLIENT_ID` создаёт свою строку `Account` (`provider: "google-calendar"`) при привязке; OAuth-флоу, `state`/PKCE и обмен кода делает Auth.js. Работает и для email-пользователей: Auth.js привязывает новый аккаунт к текущей сессии. Альтернатива (свой OAuth-флоу + своя таблица) даёт полный контроль, но добавляет security-чувствительный код (state, CSRF, обмен кода) без выигрыша на этом масштабе.
4. **Флаг `GOOGLE_CALENDAR_ENABLED`, а не «есть ключи — включено».** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` уже обязательны для входа, но календарь требует отдельной настройки Google Cloud (API, scope, redirect URI). Без явного флага фича появилась бы у всех окружений и падала бы на `redirect_uri_mismatch`. `isGoogleCalendarEnabled()` — `true` только при `GOOGLE_CALENDAR_ENABLED === "true"`.
5. **Пересечение с Google — предупреждение, не запрет.** Тот же диалог конфликта и тот же «Create anyway» (`confirmConflicts` пропускает обе проверки) — поведение, которое пользователь уже знает по пересечениям задач.
6. **Google вызывается до транзакции БД; сбой не блокирует сохранение.** Сетевой вызов внутри `runInTransaction` держал бы транзакцию открытой на время ответа Google. Поэтому занятость запрашивается до транзакции, а внутри неё объединяется с DB-конфликтами в один `ScheduleConflictError`. Таймаут 5 секунд; при сбое/таймауте/ошибке календаря задача создаётся без этой проверки, и после редиректа на `/tasks/[id]` показывается toast «Couldn't check Google Calendar — saved without that check».
7. **Повторяющаяся задача — один запрос на всё окно.** Кандидаты (30 дней, `RECURRENCE_WINDOW_DAYS`) считаются заранее той же чистой логикой, что и при генерации; к Google уходит один `freeBusy` с `timeMin` = первый старт, `timeMax` = последний конец, пересечения считаются локально. Никаких N запросов на N повторений.
8. **Publishing status OAuth-приложения — «In production».** В режиме Testing refresh token живёт 7 дней — подключение пришлось бы повторять каждую неделю. «In production» без верификации: если `calendar.freebusy` окажется sensitive — экран «Google hasn't verified this app» (проходится) и лимит 100 пользователей, что приемлемо для текущих двух; если non-sensitive — без предупреждения. **2026-09-24 (S11-00):** scope non-sensitive — экрана «unverified app» и лимита пользователей в production не будет, верификация не нужна. **2026-09-25:** переключить статус не удалось — Branding требует Homepage/Privacy Policy/Terms of Service URL (см. аудит, «Google Cloud»). На время разработки — Testing + аккаунт разработчика в Test users (refresh token 7 дней, для `dev` приемлемо); публикация — до включения флага на проде. **2026-09-25 (S11-12):** страницы `/privacy` и `/terms` задеплоены, Branding заполнен, приложение опубликовано — **In production**. Подключения, сделанные ещё в Testing (локальный `dev`), сохраняют 7-дневный refresh token — после его истечения один раз переподключить.
9. **Только основной календарь (`primary`).** Выбор календарей (рабочий/личный/общие) — отдельный UI и хранение выбора; вне этого спринта.
10. **Реальный Google API не тестируется.** Та же причина, что Anthropic (Sprint 8), распознавание речи (Sprint 9), Telegram (Sprint 10): сеть и реальные токены; мок всего HTTP-контракта тестирует мок. Тестируется чистая логика; живая проверка — вручную на dev-ветке (S11-11).
11. **Токены хранятся как их хранит Auth.js — открытым текстом в `Account`.** Так уже хранятся токены входа; шифрование токенов при хранении — отдельная задача для всех провайдеров сразу, не в этом спринте (отмечено в «Рисках»).
12. **Отдельная dev-ветка Neon — предусловие спринта.** Проверка требует реального OAuth-согласия и записи токенов; делать это на production-базе (текущий `.env.local`) нельзя. S11-00 создаёт ветку `dev` от `production` и переключает на неё локальное окружение.

---

## 2. Обзор задач

| ID | Задача | Оценка | Зависит от |
|---|---|---|---|
| S11-00 | Dev-окружение (ветка Neon `dev`) + завершение настройки Google Cloud | 0.5 ч | — |
| S11-01 | `GOOGLE_CALENDAR_ENABLED` в `env.ts`/`.env.example`, `isGoogleCalendarEnabled()` | 0.5 ч | — |
| S11-02 | Провайдер Auth.js `google-calendar` (scope `calendar.freebusy`, offline) | 1.5 ч | S11-00, S11-01 |
| S11-03 | Токены: получение валидного access token, refresh, `invalid_grant` → отключение | 1.5 ч | S11-02 |
| S11-04 | Клиент `freeBusy` + разбор ответа | 1 ч | S11-03 |
| S11-05 | Чистая логика пересечений кандидатов с busy-интервалами | 0.5 ч | — |
| S11-06 | Встраивание в проверку конфликтов (create/update, разовая и повторяющаяся), деградация при сбое | 2 ч | S11-04, S11-05 |
| S11-07 | Диалог конфликта: строки «Busy in Google Calendar» | 1 ч | S11-06 |
| S11-08 | UI на `/settings`: блок «Google Calendar» (Connect/Connected/Disconnect) | 1.5 ч | S11-02, S11-03 |
| S11-09 | Тесты чистой логики | 1 ч | S11-03, S11-04, S11-05, S11-06 |
| S11-10 | README/`.env.example`: настройка Google Cloud | 0.5 ч | S11-02 |
| S11-11 | Живая проверка на dev-ветке + прогон Sprint DoD | 1 ч | всё выше |
| S11-12 | Страницы Privacy Policy / Terms of Service + Branding и публикация OAuth-приложения | 1.5 ч | — (публикация — после деплоя страниц) |

Итого ~14 ч.

---

## 3. Задачи

### S11-00 · Dev-окружение и Google Cloud

**Что сделать**
- Neon: ветка `dev` от `production` (проект `reminder_assistant`). Локальный `.env.local`: `DATABASE_URL`/`DATABASE_URL_UNPOOLED` → строки подключения ветки `dev`, `NEON_BRANCH=dev`; прежние значения сохранить закомментированными рядом. `prisma migrate deploy` локально теперь идёт в `dev`.
- Google Cloud Console → Google Auth Platform → **Clients** → web-клиент входа → **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`, `http://localhost:3000/api/auth/callback/google-calendar`, `https://reminder-assistant-s63g.vercel.app/api/auth/callback/google-calendar`.
- **Data access**: зафиксировать категорию `calendar.freebusy` (sensitive / non-sensitive) в этом документе → решение по «Расхождения» п.8 → **Audience → Publishing status**.

**Acceptance criteria**
- [x] Локальный dev-сервер и `prisma` работают с веткой `dev`; production-данные не меняются ни одним локальным действием этого спринта. (`prisma migrate status` → хост `ep-rapid-wave-…` ветки `dev`, «up to date».)
- [x] Локальный вход через Google работает (нет `redirect_uri_mismatch`). (2026-09-24: `/api/auth/signin/google` → страница входа Google, не ошибка; callback-URI `google-calendar` проверяется в S11-02.)

---

### S11-01 · Флаг

**Что сделать**
- `src/lib/env.ts` — `GOOGLE_CALENDAR_ENABLED: z.string().optional()`; `.env.example` — переменная с комментарием (что включает, что нужно настроить в Google Cloud, ссылка на README).
- `src/lib/google-calendar/google-calendar.config.ts` — `isGoogleCalendarEnabled()`: `env.GOOGLE_CALENDAR_ENABLED === "true"`.

**Acceptance criteria**
- [ ] Без переменной (или с любым значением, кроме `true`) приложение работает как до спринта; `isGoogleCalendarEnabled()` — `false`.

---

### S11-02 · Провайдер `google-calendar`

**Что сделать**
- `src/lib/auth/config.ts` — при `isGoogleCalendarEnabled()` добавить второй `Google({ id: "google-calendar", name: "Google Calendar", clientId, clientSecret, authorization: { params: { scope: "openid email profile https://www.googleapis.com/auth/calendar.freebusy", access_type: "offline", prompt: "consent" } } })`. Проверить, что переопределение `id` поддерживается этой версией Auth.js и callback идёт на `/api/auth/callback/google-calendar`.
- Server action `connectGoogleCalendarAction` (`features/user/actions.ts` или новый `features/google-calendar/actions.ts`) — только для вошедшего пользователя: `signIn("google-calendar", { redirectTo: "/settings" })`.
- Проверить сценарий «`/api/auth/signin/google-calendar` без сессии»: при совпадении email с существующим пользователем Auth.js даёт `OAuthAccountNotLinked` (безопасно); при новом email — создаёт пользователя, как обычный вход через Google. Если это нежелательно — закрыть в `callbacks.signIn` (например, отклонять `google-calendar`, если по аккаунту/email не находится существующий пользователь).
- Учесть granular consent Google: пользователь может снять галочку календаря на экране согласия. Подключение считается активным, только если `Account.scope` содержит `calendar.freebusy`; иначе — «не подключено» с пояснением на `/settings`.

**Acceptance criteria**
- [ ] После «Connect» у текущего пользователя появляется `Account` с `provider = "google-calendar"`, `refresh_token` не `null`, `scope` содержит `calendar.freebusy` — и для пользователя со входом через Google, и для входа по email. (2026-09-25, `dev`: для пользователя со входом через Google — да, та же сессия, новый пользователь не создан; для email-пользователя — в S11-11.)
- [x] Основной вход через Google не меняется: те же scope, тот же экран согласия. (`/api/auth/signin/google` → `scope=openid profile email`, без `access_type`/`prompt`.)

_Реализация (2026-09-25):_ сверх плана — `callbacks.signIn` отклоняет `google-calendar` без текущей сессии (иначе провайдер работал бы как вход/регистрация, см. `handle-login.js`); `prepareConnect` удаляет неиспользуемую строку («needs-reconnect») перед повторным Connect.

---

### S11-03 · Токены

**Что сделать**
- `features/google-calendar/google-calendar.repository.ts` — чтение/обновление/удаление `Account` с `provider = "google-calendar"` для `userId` (Prisma остаётся только в репозиториях, ADR-001).
- `features/google-calendar/google-calendar.service.ts` — `getAccessToken(userId)`: если `expires_at` дальше, чем через 60 секунд, — текущий `access_token`; иначе `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`) голым `fetch`, обновить `access_token`/`expires_at` (и `refresh_token`, если Google вернул новый). Ответ `invalid_grant` → удалить подключение, вернуть «не подключено».
- Чистая функция `needsTokenRefresh(expiresAtSeconds, now)` — отдельно, ради тестов (S11-09).

**Acceptance criteria**
- [x] Истёкший access token обновляется без участия пользователя, следующий запрос использует новый. (2026-09-25, `dev`: `expires_at` в прошлое → `getAccessToken` = `ok` с новым токеном, `expires_at` +1 ч, `refresh_token` прежний; второй вызов — без обновления.)
- [x] Отозванный в Google доступ (`invalid_grant`) → подключение удалено, `/settings` показывает «не подключено», создание задач работает дальше. (2026-09-25, `dev`: свежий access token → `revoke` у Google → создание задачи: `freeBusy` 401 → принудительный refresh → `invalid_grant` → строка удалена, задача сохранена без toast; статус — `not-connected`; следующая задача — 0 запросов к Google.)

---

### S11-04 · Клиент `freeBusy`

**Что сделать**
- `lib/google-calendar/query-free-busy.ts` — `queryFreeBusy(accessToken, timeMin, timeMax)`: `POST https://www.googleapis.com/calendar/v3/freeBusy`, `items: [{ id: "primary" }]`, `AbortSignal.timeout(5000)`.
- Чистая `parseFreeBusyResponse(json)` → `{ status: "ok"; busy: { start: Date; end: Date }[] } | { status: "unavailable" }`: ошибки в `calendars.primary.errors` или отсутствие `primary` → `unavailable`.
- `googleCalendarService.getBusyIntervals(userId, timeMin, timeMax)` → `not-connected | unavailable | ok(busy)`; любые сетевые ошибки/таймаут → `unavailable` (без исключения наружу).

**Acceptance criteria**
- [x] Ни при каком ответе/сбое Google `getBusyIntervals` не бросает исключение. (Весь вызов в `try/catch` → `unavailable`; 2026-09-25 на `dev` — подставленный сбой сети → задача сохранена.)
- [x] Из ответа используются только `start`/`end`. (zod отбрасывает прочие поля; тест.)

_Реализация (2026-09-25):_ сверх плана — ответ `401` на `freeBusy` (доступ отозван раньше, чем истёк access token) → один принудительный refresh: `invalid_grant` → «не подключено», иначе повтор запроса. Ответ с ключом `calendars.primary` подтверждён на реальном календаре.

---

### S11-05 · Логика пересечений

**Что сделать**
- Чистая функция (например, `features/scheduling/external-busy.ts`) `findBusyOverlaps(candidates: { start; end }[], busy: { start; end }[])` → занятые интервалы, пересекающиеся хотя бы с одним кандидатом, без дублей, по возрастанию. Предикат — существующий `hasOverlap` (строгое неравенство: касание краями не пересечение — согласуется с `end` исключительно у Google).
- `busyQueryWindow(candidates)` → `{ timeMin, timeMax }` (минимальный старт, максимальный конец) — для одного запроса по окну повторяющейся задачи.
- _Уточнение 2026-09-25:_ окно расширено на сутки в обе стороны (`BUSY_QUERY_PADDING_MS`). Google **обрезает** busy-интервалы по границам запроса: запрос ровно по интервалу задачи 18:30–19:00 вернул встречу 18:00–20:00 как 18:30–19:00 — диалог показал бы неверное время встречи. На само пересечение отступ не влияет; запрос по-прежнему один.

**Acceptance criteria**
- [x] Встреча 14:00–15:00 и задача 15:00–15:30 — не пересечение; 14:30–15:30 — пересечение. (Тесты; вживую 2026-09-25 — встреча 18:00–20:00: задачи 20:00 и 17:30 сохранены без конфликта, 18:30 — конфликт.)

---

### S11-06 · Проверка конфликтов

**Что сделать**
- `task.service.createTask` / `updateTask` (разовая задача): если календарь включён и подключён и нет `confirmConflicts` — **до** `runInTransaction` посчитать интервал задачи и запросить `getBusyIntervals`; внутри транзакции объединить `findBusyOverlaps` с результатом `conflictService.findConflicts` и бросить один `ScheduleConflictError`, если непусто хоть одно.
- Повторяющаяся (`createTask` с правилом): кандидаты — теми же `generateOccurrenceDates` + логикой `buildCandidates` (вынести её в чистую экспортируемую функцию, не дублировать), один запрос по `busyQueryWindow`, пересечения — внутри существующего цикла `createOccurrencesForTask` вместе с DB-конфликтами.
- `ScheduleConflictError` — новое поле `externalBusy: { start: Date; end: Date }[]` (по умолчанию `[]`); `TaskActionState` — `busy?: { timeLabel: string }[]` (`summarizeConflicts` форматирует в таймзоне пользователя).
- Деградация («Расхождения» п.6): `getBusyIntervals` вернул `unavailable` → задача сохраняется по обычному пути; `createTaskAction`/`updateTaskAction` редиректят на `/tasks/[id]?calendarCheck=unavailable`, страница задачи показывает toast и не хранит этот параметр дальше.

**Acceptance criteria**
- [x] Ни одна транзакция БД не ждёт ответа Google. (`conflictService.findExternalBusy` вызывается до `runInTransaction` в `createTask`/`updateTask`; внутри транзакции — только объединение с DB-конфликтами.)
- [x] `confirmConflicts=true` («Create anyway») пропускает и DB-, и Google-проверку. (Вживую: create и edit с `confirmConflicts` — 0 запросов к Google, сохранено.)
- [x] Без подключения/флага — ровно прежнее поведение, ни одного запроса к Google. (Вживую с `GOOGLE_CALENDAR_ENABLED=false` — 0 запросов; с выключенным флагом не выполняется и чтение задачи/токенов — `candidates` ленивый.)

_Живая проверка 2026-09-25 (`dev`, встреча в Google 28.09 18:00–20:00):_ разовая 18:30 → конфликт (Google 18:00–20:00 + реальная задача пользователя в это время), ничего не сохранено; ежедневная с 26.09 19:00 (31 повторение) → конфликт, **1** запрос `freeBusy`, ничего не сохранено; перенос существующей задачи на 19:00 → конфликт, с «Create anyway» — сохранено; Google «упал» → сохранено, `calendarUnavailable=true`. Тестовые задачи удалены.

---

### S11-07 · Диалог конфликта

**Что сделать**
- `task-form.tsx` — после строк «Existing» строки с меткой «Google Calendar» и текстом «Busy · 14:00–15:00» (без названий — их нет по «Расхождения» п.1).
- Заголовок учитывает оба источника. Предлагаемые тексты (финальные — на ревью): только задачи — как сейчас; только Google — «{title} overlaps with your Google Calendar»; оба — «{title} overlaps with N existing task(s) and your Google Calendar».

**Acceptance criteria**
- [x] «Change the time» и «Create anyway» работают как раньше; «Create anyway» сохраняет задачу при пересечении только с Google. (Create anyway с `confirmConflicts` проверен вживую в шаге 3; диалог — на временной фикстуре без БД, desktop и 375 px, фикстура удалена.)

_Реализация (2026-09-25):_ строка — метка «Google Calendar», текст «Busy», под ним дата и время (та же раскладка, что у строк «Existing»; если интервал переходит через полночь — у конца своя дата). Заголовок: только задачи — без изменений («… overlaps with N existing task(s)»); только Google — «{title} overlaps with your Google Calendar»; оба — «{title} overlaps with N existing task(s) and your Google Calendar». По ревью: новая задача вынесена в отдельную карточку (`bg-blue-tint`, текст в цветах `InsightCard` — `text-secondary` на этом фоне 3.98:1, ниже AA; `blue-ink-body` — 5.4:1), конфликты — во второй карточке под ней. Попутно исправлено (было и до спринта): у `AlertDialogFooter` базовый `sm:flex-row` перебивал `flex-col`, и от 640 px кнопка «Change the time» вылезала за диалог влево — добавлен `sm:flex-col`.

---

### S11-08 · UI на `/settings`

**Что сделать**
- _Перенесено в шаг 2 по решению 2026-09-25 (для живой проверки подключения нужна кнопка)._
- `settings/google-calendar-connect.tsx` (по образцу `telegram-connect.tsx`), рендерится только при `isGoogleCalendarEnabled()`. Не подключено: «Connect Google Calendar» → `connectGoogleCalendarAction` + строка о приватности («We only see when you're busy — never event details.», текст на ревью). Подключено: «Connected» + «Disconnect». Подключено без права календаря (granular consent) — пояснение и «Connect» снова.
- `disconnectGoogleCalendarAction` — best-effort `POST https://oauth2.googleapis.com/revoke?token=…`, затем удаление `Account` `google-calendar`; сбой revoke не мешает удалению.

**Acceptance criteria**
- [x] Без флага блока нет вообще. (2026-09-25, скриншот пользователя.)
- [x] После «Disconnect» проверка конфликтов больше не обращается к Google; повторный «Connect» создаёт новое подключение с новым `refresh_token`. (2026-09-25, `dev`, пользователь в Chrome: Disconnect → Connect — отпечаток `refresh_token` сменился; без строки подключения — 0 запросов к Google.)

---

### S11-09 · Тесты

**Что сделать**
- `needsTokenRefresh` — до/на границе/после (запас 60 с), `null`.
- `parseFreeBusyResponse` — busy-интервалы, пустой `busy`, `errors` у `primary`, отсутствие `primary`, мусорный JSON.
- `findBusyOverlaps` — пересечение, касание краями, несколько busy на одного кандидата, один busy на несколько кандидатов (без дублей), пустые входы.
- `busyQueryWindow` — окно по кандидатам повторяющейся задачи (min старт, max конец).
- Вынесенная чистая функция построения кандидатов — те же интервалы, что сейчас строит `buildCandidates`.

**Acceptance criteria**
- [x] Ни один новый тест не обращается к реальному Google API или реальной БД. (2026-09-25: `google-calendar-connection`, `refresh-access-token`, `query-free-busy`, `external-busy`, `occurrence-candidates`, `lib/format` — только чистые функции; сверх списка — `formatIntervalLabel`, подпись busy-интервала с переходом через полночь.)

---

### S11-10 · Документация

**Что сделать**
- README — секция «Google Calendar setup»: включить Calendar API, добавить scope `calendar.freebusy`, redirect URI (`/api/auth/callback/google-calendar` для localhost и прода), Publishing status (Testing = 7-дневные refresh-токены), `GOOGLE_CALENDAR_ENABLED=true` в Vercel.
- `.env.example` — комментарий к флагу.

**Acceptance criteria**
- [x] Новый разработчик по README включает фичу локально и на проде без дополнительных вопросов. (README → «Google Calendar setup»: Calendar API, scope, redirect URI, Branding, Publish/Testing, флаг; упоминания в «Local setup» и «Deployment».)

---

### S11-11 · Живая проверка и Sprint DoD

**Что сделать** (на ветке `dev`, не на проде)
- Подключить календарь пользователем со входом через Google и пользователем со входом по email.
- Создать разовую задачу поверх занятого слота → строка «Busy in Google Calendar» в диалоге → «Create anyway» → задача сохранена; задача рядом со слотом (касание) → без диалога.
- Повторяющаяся задача, у которой одно из повторений попадает на занятый слот → предупреждение, в логах — один запрос `freeBusy`.
- Обновление токена: в dev-базе выставить `expires_at` в прошлое → следующая проверка проходит, токен обновлён.
- Отозвать доступ в https://myaccount.google.com/permissions → следующая проверка → «не подключено» на `/settings`, задача создаётся.
- Прогон всех пунктов Sprint DoD.

**Acceptance criteria**
- [ ] Все сценарии выше пройдены, результат записан в описание PR. (Записан в описание PR [#16](https://github.com/Natalka-qa/Reminder-assistant/pull/16); все, кроме подключения после входа по email-ссылке — см. Sprint DoD.)

_Итог 2026-09-25 (`dev`):_
- подключение пользователем со входом через Google — да; со входом по email-ссылке — не подтверждено (см. Sprint DoD);
- задача поверх встречи → конфликт с «Google Calendar · Busy»; касание краями → без диалога; «Create anyway» → сохранено;
- повторяющаяся (31 повторение), одно попадает на встречу → конфликт, 1 запрос `freeBusy`;
- `expires_at` в прошлое → токен обновлён (шаг 2);
- отзыв доступа (эндпоинт `revoke` у Google — то же, что удаление в myaccount) → следующая задача сохраняется, подключение удалено, `/settings` — «Not connected»;
- Disconnect → Connect → новый `refresh_token`; без флага — блока нет.

---

### S11-12 · Privacy Policy, Terms of Service и публикация OAuth-приложения

Добавлена 2026-09-25. «Publish app» в Google Cloud неактивна: для External-приложения в production Google требует на странице **Branding** ссылки Homepage, Privacy Policy и Terms of Service на authorized domain («These links are required for all external production apps»). Без публикации приложение остаётся в Testing: календарь подключают только аккаунты из Test users, а их refresh token живёт 7 дней (см. аудит, «Google Cloud», и «Расхождения» п.8).

**Что сделать**
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` — статичные публичные страницы вне `(app)` (без входа; `src/proxy.ts` их не матчит), в стиле `/login`.
- Privacy Policy: какие данные хранятся (имя, email, аватар из Google; задачи и напоминания; часовой пояс; Telegram chat id), что читается из Google Calendar (только `start`/`end` занятых интервалов основного календаря, на время проверки, не хранится; OAuth-токены календаря — в БД), кому передаётся (Resend — письма, Telegram — сообщения, Anthropic — текст «Fill from text», Neon/Vercel — хостинг), как отключить календарь (Disconnect на `/settings`, https://myaccount.google.com/permissions) и удалить данные (запрос на контактный email), заявление о соответствии Google API Services User Data Policy (Limited Use). Terms — короткие условия использования. Тексты — черновик на ревью владельцу.
- Ссылки на обе страницы с `/` и `/login` (футер).
- После деплоя страниц на прод — Google Cloud → **Branding**: Homepage `https://reminder-assistant-s63g.vercel.app`, Privacy Policy `…/privacy`, Terms of Service `…/terms`, Authorized domains `reminder-assistant-s63g.vercel.app` → **Audience → Publish app → Confirm**.
- Только после этого — `GOOGLE_CALENDAR_ENABLED=true` в Vercel (production), redeploy.

**Acceptance criteria**
- [x] `/privacy` и `/terms` открываются на проде без входа. (2026-09-25: статические страницы вне `(app)`, ссылки в футере `/` и `/login`, контакт — techremindy@gmail.com; на проде — `200` без входа через ~70 с после мержа PR #16.)
- [x] Publishing status — **In production**; аккаунт не из Test users подключает календарь без «Access blocked» (scope non-sensitive — экрана «unverified app» тоже нет). (2026-09-25: опубликовано. Отдельно аккаунтом не из Test users не проверялось — после публикации список Test users не применяется.)
- [x] Флаг на проде включён только после этого. (2026-09-25: `GOOGLE_CALENDAR_ENABLED=true` в Vercel Production; переменная действует только на деплои после её сохранения — понадобился Redeploy. На проде: провайдер `google-calendar` зарегистрирован, оба Google-флоу без `redirect_uri_mismatch`, обычный вход — по-прежнему `openid profile email`; пользователь подключил календарь, задача 28.09 19:00 → диалог с «МК Кампанар» и «Google Calendar · Busy · 18:00–20:00».)

---

## 4. Не входит в Sprint 11

Запись/создание событий в Google Calendar; чтение названий, описаний, участников событий; двусторонняя синхронизация задач с календарём; выбор календарей помимо `primary`; отображение занятых блоков на Calendar/Home (следующий шаг, см. «Расхождения» п.2); учёт занятости при отправке напоминаний; поиск свободных окон («Найди завтра вечером час» — это V1.5 Smart scheduling); шифрование OAuth-токенов при хранении (для всех провайдеров сразу, см. «Расхождения» п.11); верификация приложения Google (не нужна: scope non-sensitive, см. «Расхождения» п.8).

---

## 5. Риски

| Риск | Влияние | Что делаем |
|---|---|---|
| ~~Режим Testing в Google Cloud~~ | — | Снят 2026-09-25: приложение опубликовано (S11-12); подключения, сделанные в Testing, переподключить один раз после истечения 7-дневного токена |
| ~~`calendar.freebusy` окажется sensitive~~ | — | Снят 2026-09-24: scope non-sensitive (S11-00) |
| Auth.js не обновляет токены при повторной привязке | «Reconnect» без отключения не даст нового `refresh_token` | Переподключение = Disconnect (удаление `Account`) + Connect; так и устроен `/settings` |
| Пользователь снял галочку календаря (granular consent) | `Account` есть, а права нет → `freeBusy` отвечает ошибкой | Проверка `scope` при подключении и в `getBusyIntervals`; понятное состояние на `/settings` |
| Медленный/недоступный Google при сохранении задачи | Задержка или ошибка создания | Таймаут 5 с, запрос до транзакции, деградация с сообщением («Расхождения» п.6) |
| Токены в `Account` открытым текстом | Утечка БД раскрывает доступ к занятости календаря | Scope минимальный (только free/busy); шифрование — отдельная задача («Расхождения» п.11) |
| Локальная работа по production-базе | Тестовые подключения/задачи в реальных данных | S11-00 — dev-ветка Neon до любых изменений кода |
| Лимит 100 refresh-токенов на клиента и Google-аккаунт | Старые токены инвалидируются при частых переподключениях | Не критично при ручном подключении; `invalid_grant` обрабатывается штатно (S11-03) |

---

## 6. Предлагаемый порядок работы

| Шаг | Задачи | Стоп на ревью |
|---|---|---|
| 1 | S11-00 | dev-ветка работает, Google Cloud настроен, решение по п.8 принято |
| 2 | S11-01, S11-02, S11-03, S11-08 (перенесён 2026-09-25) | подключение календаря и обновление токена проверены вживую на `dev` |
| 3 | S11-04, S11-05, S11-06 (+ их тесты из S11-09) | конфликты с Google в create/update, деградация |
| 4 | S11-07 | диалог, тексты диалога и `/settings` утверждены |
| 5 | S11-09, S11-10, S11-11, страницы из S11-12, прогон Sprint DoD | PR |
| 6 | S11-12: после мержа — Branding, Publish app, флаг в Vercel | флаг на проде включён — ✅ 2026-09-25 |
