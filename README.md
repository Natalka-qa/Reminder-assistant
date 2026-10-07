# Reminder

A personal scheduling assistant.

## Stack

- [Next.js](https://nextjs.org) 16.3.4 — App Router, Turbopack, TypeScript strict
- [React](https://react.dev) 19.2.8
- [Tailwind CSS](https://tailwindcss.com) v4 (CSS-first config via `@theme`)
- [Prisma](https://www.prisma.io) + PostgreSQL ([Neon](https://neon.tech))
- [Auth.js](https://authjs.dev) (`next-auth` v5) — Google OAuth + email magic link (off unless `EMAIL_SIGN_IN_ENABLED=true`)
- [Luxon](https://moment.github.io/luxon/) for timezone-aware date handling
- [shadcn/ui](https://ui.shadcn.com) + [Lucide](https://lucide.dev) icons
- [Telegram Bot API](https://core.telegram.org/bots/api) — optional second reminder-delivery channel alongside email

See `docs/adr/` for the architectural decisions behind the project structure and date/time library choice.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values (see comments in the file for where to get each one — Neon connection string, Google OAuth credentials, Resend API key). `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`TELEGRAM_BOT_USERNAME` are optional — leave all three blank to skip the Telegram section on `/settings`; see "Telegram setup" below if you want it. `GOOGLE_CALENDAR_ENABLED` is optional as well — anything but `true` leaves Google Calendar off; see "Google Calendar setup" below.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Apply database migrations:

   ```bash
   npm run db:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                      | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Start the dev server (Turbopack)                            |
| `npm run build`             | Applies pending migrations, then production build           |
| `npm run start`             | Start the production server                                 |
| `npm run lint`              | ESLint                                                      |
| `npm run typecheck`         | `tsc --noEmit`                                              |
| `npm run format`            | Prettier                                                    |
| `npm run test`              | Vitest                                                      |
| `npm run db:migrate`        | Apply migrations locally (`prisma migrate dev`)             |
| `npm run db:migrate:deploy` | Apply migrations in CI/production (`prisma migrate deploy`) |
| `npm run db:studio`         | Open Prisma Studio                                          |
| `npm run db:reset`          | Reset the database and re-seed (`prisma migrate reset`)     |

## Deployment

The app is designed to deploy to [Vercel](https://vercel.com):

1. Import the repository as a new Vercel project (Vercel dashboard → Add New → Project).
2. Set every variable from `.env.example` in the project's Vercel dashboard (Settings → Environment Variables) — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. The three `TELEGRAM_*` variables and `GOOGLE_CALENDAR_ENABLED` are optional — add them to enable Telegram notifications / the Google Calendar busy check in production, or leave them out. `EMAIL_SIGN_IN_ENABLED=true` adds "Email me a link" to `/login` — only once `EMAIL_FROM` is a sender on a domain verified in Resend (the sandbox `onboarding@resend.dev` delivers only to the Resend account's owner); without it `/login` offers Google only.
3. Set `AUTH_URL` to the app's real production domain (not `http://localhost:3000`), and add that domain's `/api/auth/callback/google` as an authorized redirect URI in the Google Cloud Console.
4. Deploy. `npm run build` (Vercel's default build command) runs `prisma migrate deploy` before `next build`, so pending migrations are applied automatically on every deploy — no separate migration step needed.

`vercel.json` registers the daily `/api/cron/extend-occurrences` job; Vercel schedules it automatically once the project is deployed. `/api/cron/send-notifications` needs to run every 5 minutes, which the Vercel Hobby plan doesn't allow (daily crons only), so it's triggered by an external scheduler instead:

1. Sign up at [cron-job.org](https://cron-job.org) (free) → Create cronjob.
2. URL: `https://<your-domain>/api/cron/send-notifications`, schedule: every 5 minutes, method: `GET`.
3. Advanced → Headers → add `Authorization` with value `Bearer <your CRON_SECRET>`.
4. Save, then use "Test run" — a working setup returns `200` with `{"sent": N}`; `401` means the header doesn't match `CRON_SECRET` in Vercel.

On the Vercel Pro plan you can instead add `{ "path": "/api/cron/send-notifications", "schedule": "*/5 * * * *" }` back to `vercel.json` and skip the external scheduler.

`GET /api/health` (no auth) does a lightweight database ping — point an external uptime monitor at it.

### Telegram setup

Skip this entirely if you don't want the Telegram notification channel — the three `TELEGRAM_*` variables are optional and the `/settings` page just won't show that section without them.

1. Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, follow the prompts. It gives you a token (`TELEGRAM_BOT_TOKEN`) and you choose the bot's `@username` (`TELEGRAM_BOT_USERNAME`, without the `@`).
2. Generate a webhook secret: `openssl rand -hex 32` → `TELEGRAM_WEBHOOK_SECRET`.
3. Set all three in `.env.local` (or Vercel's environment variables) and deploy/restart.
4. Register the webhook once — Telegram doesn't know your URL until you tell it:

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"$AUTH_URL/api/telegram/webhook\", \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\"}"
   ```

   Only needs to be re-run if the token, secret, or deployment URL changes.

5. Register the command menu once, the same way (the "/" button next to the message box):

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMyCommands" \
     -H "Content-Type: application/json" \
     -d '{"commands": [{"command": "today", "description": "What is planned for today"}, {"command": "next", "description": "The next task"}, {"command": "help", "description": "What I can do"}]}'
   ```

6. Register the Mini App menu button once (the button left of the message box that opens the app inside Telegram):

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setChatMenuButton" \
     -H "Content-Type: application/json" \
     -d "{\"menu_button\": {\"type\": \"web_app\", \"text\": \"Open app\", \"web_app\": {\"url\": \"$AUTH_URL/telegram\"}}}"
   ```

   `$AUTH_URL` must be the public `https` URL. To take it back: the same call with `{"menu_button": {"type": "default"}}`.

7. On `/settings`, click "Connect" and open the resulting `t.me/...` link — Telegram sends the bot `/start <code>`, which the webhook uses to link your account.

If `/start` gets no answer, check `getWebhookInfo` first (`curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`): an empty `url` means step 4 hasn't been run for this bot.

The webhook only reaches a public URL, so a local `next dev` never gets updates from Telegram; to try the bot locally, POST updates to `/api/telegram/webhook` yourself with the `x-telegram-bot-api-secret-token` header.

### Google Calendar setup

Skip this if you don't need it — without `GOOGLE_CALENDAR_ENABLED=true` there's no "Google Calendar" section on `/settings`, no request ever goes to Google, and conflict checks and free-time suggestions only look at your own tasks.

With it, a connected user's **primary** calendar is checked for busy times whenever they create or edit a task, and an overlap shows up the same way an overlapping task does — in the overlap notice of the New task and Edit task forms; either way the task can still be saved. Free-time suggestions skip those busy times too (see "Finding free time"), and the busy times are drawn where the day is planned:

- **Calendar, Week** — grey hatched "Busy" blocks under the tasks, at their hours (on a phone, in the selected day). A day busy from start to end (an all-day event) gets "Busy" in an "All day" row under the day strip instead of a block over the whole grid; on a phone, "Busy all day · Google Calendar" under the day's heading. Busy time is cut to the hours the grid shows and never widens it. A legend "Busy — from your Google Calendar" appears when there's busy time on screen. Month shows no busy time.
- **Home, "The rest of your day"** — "16:00 Busy until 17:30 · Google Calendar" rows between the tasks (busy time already over isn't shown; a day busy all day is one "Busy all day" row). "Free after" and "Your evening is free after…" come after the busy time, and "A small suggestion" never moves a task into it.

Both pages render the tasks first and fill the busy time in when Google answers — Google is never waited for, one free/busy request per page (the visible week, or today). If Google doesn't answer, there's one line, "Google Calendar didn't respond — busy time isn't shown."; if the connection can no longer be used, "Reconnect Google Calendar in Settings". With the flag off or nothing connected, both pages look as they did and ask Google nothing. There are no titles anywhere, because free/busy has none. Only free/busy is read — scope `calendar.freebusy`, never event titles or details — and the busy times aren't stored. The connection is a second Auth.js provider, `google-calendar`, on the same OAuth client as "Sign in with Google"; its tokens live in the `Account` row with `provider = "google-calendar"`. Connecting writes real OAuth tokens, so test it locally against a Neon dev branch, not production.

In the Google Cloud project that owns `GOOGLE_CLIENT_ID`:

1. **APIs & Services → Library → Google Calendar API → Enable.**
2. **Google Auth Platform → Data access → Add or remove scopes:** add `https://www.googleapis.com/auth/calendar.freebusy` (non-sensitive), save.
3. **Clients →** the web client **→ Authorized redirect URIs:** add `http://localhost:3000/api/auth/callback/google-calendar` and `https://<your-domain>/api/auth/callback/google-calendar`.
4. **Branding:** Homepage `https://<your-domain>`, Privacy policy `https://<your-domain>/privacy`, Terms of service `https://<your-domain>/terms`, and `<your-domain>` under Authorized domains. Use the contact address from `src/app/(legal)/legal.tsx` (`LEGAL_CONTACT_EMAIL`) as the User support email. Google requires these links before an external app can be published.
5. **Audience → Publish app → Confirm** ("In production"). Until then the app is in **Testing**: only accounts under **Audience → Test users** can connect — everyone else gets "Access blocked … Error 403: access_denied" — and refresh tokens expire after 7 days, so the connection drops to "Not connected" every week. Testing plus your own account as a test user is fine for local development; production needs "In production" before the flag is turned on.
6. Set `GOOGLE_CALENDAR_ENABLED=true` in `.env.local` (or Vercel's environment variables) and restart/redeploy.
7. On `/settings`, click "Connect" under Google Calendar and keep the calendar box ticked on Google's consent screen — if it's unticked, `/settings` says so and offers "Connect" again. "Disconnect" revokes the access at Google and deletes the tokens.

## First run

A new account starts at `/onboarding` (the app sends it there until the setup is finished or skipped — `User.onboardedAt`; accounts from before it were marked done by its migration). Three steps, each skippable, and **Skip setup** at the top ends it at any point; "You can change any of this in Settings at any time." is under each.

1. **Welcome** — what to call you (prefilled from Google; for the greeting on Home, optional) and your timezone: the one this device reports, shown with **Change** for another. Either name a browser gives a zone ("Europe/Kyiv" or "Europe/Kiev") is accepted and stored as the one Settings lists.
2. **Your day** — when the day starts and ends, work days and hours, and the default reminder, already at the usual values: **Looks right** or **Skip this step**.
3. **Add tasks your way** — four sentences (a task, every week, a course, by a time) in the browser's language (English, Russian or Ukrainian); each opens New task with it typed in. **Connect** Telegram here if the bot is set up. **Go to my day** finishes.

The name is also a row in Settings. An empty Home shows the same example sentences under "Add a task".

**Before sharing the app**, the sign-in has to reach other people: the magic-link email needs a verified sender domain in Resend (`EMAIL_FROM`; `onboarding@resend.dev` only delivers to the Resend account's owner), and Google sign-in needs the OAuth consent screen published, or each person added under Test users (see "Google Calendar setup").

## Finding free time

The app suggests free times in three places. It only fills in a date and time — nothing is saved until you press "Create task" or save the edit.

- **New task, from a phrase.** "Find me an hour tomorrow evening for a workout", "Найди завтра вечером час для тренировки", "Знайди завтра ввечері годину для тренування". The first free slot becomes the task's date and time (the task stays Flexible — the app picked the time, you didn't), and up to two more are offered under When. Nothing free: "No free hour tomorrow evening." and the rest of the form is filled as usual.
- **New task or Edit task, from an overlap.** When the chosen time overlaps a task or a Google Calendar busy time, the notice adds "Free nearby: 17:30 · 20:45" — up to two slots closest to it, one on each side where there's room.
- **Home, "A small suggestion".** When a flexible task sits at the same time as another one, the card suggests moving it to the first free time today after the other ends. No free time left today — no card.

**Your hours** are on `/settings`, each user's own:

| Setting                   | Default             | What it does                                                                                                       |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Start of day / End of day | 08:00 / 21:00       | Nothing is suggested outside them. Morning is start of day–12:00, afternoon 12:00–18:00, evening 18:00–end of day. |
| Work hours                | Mon–Fri 09:00–17:00 | Busy for suggestions, unless the task can be done during work. No days picked — no work hours.                     |
| Workouts start by         | 20:00               | The latest a workout may **start** (a one-hour workout can be 20:00–21:00). "No limit" turns it off.               |

**What counts as busy:**

- Your open tasks (Scheduled or Snoozed), checked the same way the overlap notice checks them — touching isn't overlapping. A slot you're offered never shows up as an overlap.
- Your Google Calendar's busy times, if `GOOGLE_CALENDAR_ENABLED=true` and you've connected it: **one** free/busy request per search, however many days it covers. "Free nearby" asks nothing extra — it reuses the overlap check's request. Home's suggestion uses the request Home already makes for its busy rows (see "Google Calendar setup").
- Work hours, unless "Can do during work hours" is on. The switch appears under When during a search or with "Free nearby", and starts on for tasks whose title reads as remote.

**What a task is** comes from words in its title, in all three languages — nothing is stored:

- _Workout:_ workout, gym, run, yoga, swim… / тренировка, зал, бег, йога, бассейн… / тренування, зал, біг, йога, басейн…
- _Remote_ (can be done during work): call, email, pay, order, book, zoom… / позвонить, написать, оплатить, созвон… / зателефонувати, написати, оплатити…

A title with both reads as a workout ("Pay for the gym"); the switch is there to say otherwise.

**Why "Google Calendar wasn't checked":** Google was asked and didn't answer — it's down, or the connection has expired (in Google's Testing mode, every 7 days; see "Google Calendar setup"). The slots are still free of your own tasks, but a meeting may be in the way. With the flag off or no calendar connected, the search uses your tasks alone, sends nothing to Google and shows no note.

**Phrases the parser reads as a search** — a request word, then any of date, part of day and length, in any order:

|            | Request                                                       | Part of day                          | Length                             |
| ---------- | ------------------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| English    | find / look for / search for (me) (a free) time, slot, window | morning, afternoon, evening, tonight | an hour, 30 minutes, half an hour… |
| Русский    | найди / подбери / поищи (мне) (свободное) время, окно, слот   | утром, днём, после обеда, вечером    | час, полчаса, на 30 минут…         |
| Українська | знайди / підбери / пошукай (мені) (вільний) час, вікно, слот  | вранці, вдень, по обіді, ввечері     | годину, півгодини, на 30 хвилин…   |

- In Russian a bare «час» is an hour («Найди час» — 60 min). In Ukrainian «час» is _time_, so «Знайди час ввечері» has no length.
- No length named — 30 minutes. No date — the next 7 days. No part of day — the whole day.
- A time in the phrase wins: "Find time tomorrow at 7pm" is just 19:00, no search.
- The rest is the title, in the case it was written in: «для тренировки» → «Тренировки». The parser is rules, not a model — it doesn't change word forms.

Suggested times start on :00, :15, :30 or :45 of your local time, never in the past, and the ones offered never overlap each other.

**Your habits** (from "Your patterns", the last 30 days) shape suggestions in two small ways:

- **Usual workout time.** With at least **4** workouts done (or partly done) in the 30 days and at least half of them within an hour of their median start, that median — rounded to 15 minutes — is your usual workout time (shown on `/progress`). A search for a workout then starts from it: day by day, the free slots closest to it first, so the one filled in is the one that fits. Other tasks, "Free nearby" and Home keep their order.
- **Notes.** A workout slot within 30 minutes of the usual time says "19:00 — matches your usual workout time"; otherwise a slot in the part of the day you finish the most in (when it stands out — see "Your patterns") says "09:00 — you usually finish morning tasks". One line under the slots for the first one with a note; every slot's button carries its note for screen readers.

## Tasks without a time

A task can have no time — "Buy groceries", "Plan the trip" — and just belong to a day. In New task that's the default: with nothing typed the date is today and the time reads **Any time**; a time in the sentence ("at 18") or one picked sets it, and the **×** beside it ("Remove time") takes it off again. "Take vitamins every morning" is every day without a time.

- **Always Flexible.** Fixed can't be picked ("Tasks without a time are flexible.").
- **It holds no time.** It never overlaps anything — no "Overlaps with…", no "N at the same time", no "Same time as…" — and free-time search, "Free nearby" and Home's suggestion don't treat it as busy. A duration can still be set; it's shown, but doesn't make an interval.
- **Where it shows:** Home — an "Any time" block after the timed tasks (Up next only picks it once nothing with a time is left open: "Any time · today"); Tasks — last in its day, "Flexible" instead of the time, "Any time" in Today's time column; Calendar — the "Any time" row above the week's timeline (with "Busy" under a day Google has busy all day), a block above the day's timeline on a phone, last in a Month day's summary; Telegram — "Anytime" in `/today` and the morning summary, after the timed tasks.
- **Overdue** only once its day is over ("Overdue since Oct 1", no time). "Move to today" keeps it without a time.
- **Stored** as an occurrence at the first instant of its local day with no end, and `Task.hasTime = false`. Changing your timezone in Settings moves such days still ahead to the same date in the new zone, so they stay on their day.
- **Patterns** ("Your patterns") count it overall and on weekdays/weekends, but not in a part of the day — midnight isn't "after 20:00".

## Courses and deadlines

**A series can end and skip days.** Under Repeat: **Every few days** ("Every 2 days", up to 30, counted from the first day), and **Ends** — Never, On a date (the last day, inclusive) or After a number of times (saved as the date of the last one; "Last day Oct 15" shows under it). The task reads "↻ Every 2 days until Nov 2" on the task page, in Tasks and in Calendar. The nightly run creates no day past the last one, and the day after it ends the series by itself — it moves to Tasks → Ended like one ended by hand. **Resume series** on a series that ran to its end carries it on with no end. Editing offers Never / On a date.

**In a sentence** (New task and the bot, en / ru / uk): "every other day", "every 3 days", "через день", "каждые 3 дня", "кожні 3 дні"; "for a month", "for 2 weeks", "for 10 days", "на месяц", "в течение 2 недель", "на місяць", "протягом місяця" — counted from the task's date, so "for a month" from Oct 6 ends on Nov 5; "until Nov 3", "until 03/11", "до 3 ноября", "до 3 листопада". Only with a repeat — "Vacation for 2 weeks" stays the title.

**A course** — "Pills twice a day for a month", "Таблетки 2 раза в день утром и вечером на месяц", "Ліки вранці та ввечері протягом 2 тижнів" — is one task per dose ("Таблетки — утро" at 09:00, "Таблетки — вечер" at 20:00; three a day adds 14:00), listed under "Will be added as 2 tasks", each with the same repeat and end. One dose — "через день вечером в течение месяца" — is one task at that time. The time is a default: the task is Flexible and reminded at its start. Only for a course (it says how long or every N days); "every morning" alone is still a task without a time.

**A deadline** — "Send the report by 12", "by noon", "до 12", "до 12:30", "до 12-ї", or **No deadline → by 12:00** in the When row — on a task without a time. It stays in "Any time" and reads "by 12:00" on Home, in Tasks, in Calendar, on the task page and in the bot. Its reminder defaults to **30 min before deadline** (also 15 min, 1 or 2 hours), which Done or Skip cancels like any other; one already past isn't sent. Once the deadline passes and it's still open, it's overdue — "Overdue since 12:00" on Home, red in Calendar, under Overdue in Tasks — not only after the day ends. Stored as `Task.dueMinutes` (720) with `reminderKind = BEFORE_DUE`.

**A usual length.** When the sentence names no duration, the title's words suggest one, shown in Duration with "Usually 1 hour for this — change it if needed." (a length given in the text, or picked, wins): dance, a workout, massage, a lesson, the pool, shopping and chores — 1 hour; a doctor's visit — 30 min; papers (apply, renew a passport, visa, insurance) — 15 min; pay a bill, a loan, a subscription, or call / write to someone — 5 min; a film — 2 hours; pills and vitamins — none. What you do counts before what it's about: "Купить таблетки" is shopping, "Позвонить врачу" a call. The bot uses the same guess.

**Several days, each with its own time** — "Танцы по средам 19 и пятницам в 20" (the hour right after the day counts, without "в"), "Dance every Wed at 19 and Fri at 20" — is one task per day; New task shows a **Duration** row for all of them (the When row isn't shown — their days and times come from the sentence).

**Dates in digits** are day/month: "03/10", "3/10", "03/10/2026", "03.10.26" is October 3 (without a year — this year's, or next year's once it has passed). With a dot only with a year: "03.10" alone is still the time 03:10, as in "в 9.30".

## Editing a task

`/tasks/[id]/edit` is built from the same parts as New task (`components/tasks/task-fields/`), with what editing needs instead of the sentence:

- **The title is a plain field.** It isn't read as a sentence — a saved "Call mom tomorrow" doesn't move the task when you touch it. Date, time and the rest are set with the same controls as in New task.
- **Saving untouched changes nothing.** Every field starts at the task's own value. A **Critical** task keeps Critical among its choices (New task offers Low / Normal / High only), and a reminder outside the list — say 45 min, set with "Custom…" — stays as its own choice.
- **Overlaps are a notice, never a dialog**, and the task never overlaps itself. A one-off task gets "Free nearby", like New task.
- **The time can be removed or added** (× / the time picker). On a repeating task that's a change of schedule, like changing its time: the days ahead are replaced. The reminder follows: a minutes-before one becomes "No reminder" without a time; a fixed-hour one becomes minutes before with one.
- **A repeating task** keeps its start date and can't stop repeating (end the series instead, see below). Changing its time or days replaces the occurrences still ahead; the notice checks every new day in the next 30 days — "Overlaps on 2 days: Oct 3 with Dentist at 07:30, …" — with one Google request, and offers no "Free nearby" (a time free on every day isn't looked for).
- Clearing the note clears it.

**Only this day or the whole series.** Edit on a day of a repeating task — the task page's Edit, "Edit" next to each of its next days, a Tasks row's Edit, or a Calendar event (it opens the task page on that day) — asks first: **Only this day** or **Whole series**. Only this day (`/tasks/[id]/edit?occurrence=<id>`) changes that day's date, time and length (a series without a time: only its date), with the same overlap notice and "Free nearby" as a one-off task. Not into the past, and not onto a date that already has a day of the series. The day is marked **Edited** on the task page, in Tasks and in Calendar, and its reminder moves with it. Title, reminder, repeat and note belong to the whole series. Changing the series' time, days or length later leaves a day changed on its own as it is (if the series gains or loses its time, the day stays on its date and takes the series' kind), and never puts a second day on the date it was moved from.

**One day of a repeating task** — "Remove this one" on the task's page (and "Remove" next to each of its next days), or in a Tasks row's `···` actions:

|                 | What happens                                                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skip            | The day stays, marked Skipped. It counts as not done in "How it's going".                                                                                                                                                                                                                    |
| Remove this one | The day goes — from Home, Tasks and Calendar — with its reminder. It isn't counted anywhere. Changing the series' time or days later leaves it removed. **Undo** in the toast (10 s) brings it back; later, **Restore** under "Removed days" on the task page, while the day is still ahead. |

**Stopping a task** — on the task page, each with a dialog that says what happens first:

|                        | What happens                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End series (repeating) | Every day from today on goes, with its reminders. Days done or skipped stay and still count in Progress. The task moves to **Tasks → Ended** ("Ended Oct 2"). **Resume series** brings back the days still ahead and fills the next 30 days again; days moved or removed on their own stay as they were. |
| Archive (one-off)      | Its reminder is cancelled and it leaves Home, Tasks and Calendar; a mark it has stays in Progress. **Restore** brings it back — if its day has passed, as an overdue task with "Move to today".                                                                                                          |
| Delete                 | The task, all its days and reminders go for good, and its history leaves Progress.                                                                                                                                                                                                                       |

## Calendar: add and move by hand

In **Week** (sprint-22-tasks.md):

- **Tap an empty place** to add a task there — asked first ("Add a task for tomorrow at 14:00?", **Add task** / **Cancel**), so a stray tap opens nothing; then New task opens on that day at the half hour tapped (14:20 → 14:00; inside the half hour running now — the next one), with the time counted as chosen (Fixed). A sentence that names another day or time still wins. After saving it's back to Calendar on that day. On a computer the mouse shows "+ 14:00" first. Past time does nothing.
- **Drag a task** to another time or day of the shown week: open tasks with a time only (not Done / Skipped, not "Any time"), in 15-minute steps, keeping their length, to a moment still ahead; the past days are veiled while dragging and "Can't go here" shows where it can't land. On a computer press and drag; on a phone **hold about half a second**, then move — up and down, or to the screen's edge to go to the next or previous day (the page doesn't scroll while a task is held; a quick swipe still changes the day).
- A day of a **repeating task** moves on its own (like Only this day — marked **Edited**; back to its series' time it isn't any more); a **one-off** task takes the new day and time. The reminder moves with it.
- **Asked first** when the move is to **another day**, or onto **other tasks** or **busy time in Google Calendar**: "Move Gym to Thu 15:30?" with what's at stake ("It moves to another day — only this day of the series; the rest stay.", "It overlaps Call mom.", "It overlaps busy time in your Google Calendar.") — **Move** or **Cancel**; the block waits where it was dropped until you answer. A shift within the same day onto free time just moves.
- Every move ends with a toast "Moved to Thu 15:30" and **Undo** (10 s; works for 5 minutes after the move, even to a time since passed), which puts the task back on screen and says "Moved back to Today 19:00".

## Reminders

Two settings on `/settings`, each user's own:

| Setting          | Default       | What it does                                                                                                                                   |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Default reminder | 15 min before | Where a new task's reminder starts: at start time, 5 / 10 / 15 / 30 min, 1 hour or 1 day before. Each task can still have its own.             |
| Email reminders  | On            | Off: no reminder emails. Telegram (if connected) and the in-app reminder on Home still come; with no Telegram, reminders only show in the app. |

**Kinds of reminder** (each task's own, in New task and Edit):

| Task                      | Choices                                                                              | Default                |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| With a time               | No reminder · At start time · 5 / 10 / 15 / 30 min · 1 hour · 1 day before · Custom… | Default reminder       |
| Without a time            | No reminder · That morning, 09:00 · Evening before, 19:00                            | No reminder            |
| With a deadline (no time) | The above · 15 / 30 min · 1 / 2 hours before deadline                                | 30 min before deadline |

**Custom…** (tasks with a time): a number of minutes or hours before the start, from 1 minute to 24 hours — "2 hours before", "45 min before". The Default reminder on `/settings` stays a list.

"That morning" and "Evening before" are **local wall-clock time** — 09:00 on the task's day and 19:00 the day before in your timezone, through clock changes (stored as a kind, `Task.reminderKind`, not as "minutes before midnight", which DST would turn into 08:00 or 10:00). One whose moment has already passed isn't sent — a task for today made at 10:00 with "That morning" gets none, and the form says so. A minutes-before reminder that's already late still goes out at once, as before. The reminder of a task without a time reads "Buy groceries is scheduled for today." (subject "Reminder: Buy groceries — today"); "Snooze → tomorrow" on it is 09:00 tomorrow. Changing a task's reminder, date or time moves its pending reminders, cancels them for "No reminder", and creates missing ones — never re-sending one that already went out.

A reminder whose email fails is retried; Telegram is sent once, not again on every retry. With Email reminders off and Telegram connected, Telegram is the reminder: if it doesn't go through, it's retried the same way an email would be (up to 3 attempts, on the next runs).

## Telegram bot

Once a chat is connected (see "Telegram setup"), it works as a second way in, on the same data as the app:

- **Write a task** the way you'd say it — "Call mom tomorrow at 18", "Позвонить маме в пятницу в 10" — and it's added by the same rules as a sentence in New task, with your Default reminder. The reply shows what was added and when, and the same notices as the form ("Overlaps with …", "… has already passed today"). Under it: **+1 h** and **Tomorrow** to fix the time or day, **Undo**, **Open**. They work for 10 minutes and until something of the task is marked; +1 h only before 23:00 and only for a task with a time, Tomorrow only for a one-off task. A sentence without a time ("buy milk") adds a task without one, like New task (see "Tasks without a time"). A find-a-time sentence ("find an hour tomorrow evening") isn't searched in the chat — the reply links to New task. A repeat with its own time on each day — "Dance every Mon at 19 and Wed at 20", "Танцы по пн в 19 и по ср в 20" — becomes one task per day (a task has one time for all its days), each with its own reply; New task does the same, listing them under "Will be added as 2 tasks" and sharing scheduling, reminder, importance and the note between them.
- **/today** — the day in your timezone, with how many tasks are overdue; **/next** — the next open task with a time still ahead, else the first open one without a time, else the earliest one passed and not marked. Tasks without a time show as "Anytime", after the timed ones. **Today** and **Next** are also on the keyboard under the message box.
- **Reminders** come with **Done · Snooze 15 min · Skip**, then **Open** (and **Remove this one** for a repeating task; after it, **Undo** brings the day back for 10 minutes). Pressing one changes the task exactly as the same button in the app does, and the message shows the outcome; a button for a task that's no longer open just says so.
- **Morning summary** — on `/settings`, under Telegram: Off (default), 07:00, 08:00, 09:00 or 10:00. The `/today` text with a **✓** button per open task (up to 8); pressing one marks it and redraws the summary. Below the tasks, today's habits, a line each ("Daily · 2/7", "✓ Sleep · 7.5/7.5 h", "○ Water · 0.5/1.5 L") with the day's good news, and a button for each still to do, up to 8 ("✓ Vitamins", "✓ Reading 1 h", "Water +250 ml"), which also redraw it. Sent once a day by the same 5-minute `send-notifications` run, so up to 5 minutes after the time you picked, and not at all if it couldn't go out within 2 hours or there's nothing planned, overdue or no habit today.
- **Habit reminder** — on `/settings`, under Telegram: Off (default), 18:00–22:00. "Evening check-in — 2 habits left today: Water 1.5/2 L, Steps", with **Mark them** opening Home. The same run and 2-hour window as the summary; nothing is sent when every habit is done.

A chat that isn't connected gets "Connect it from Settings" and nothing else. The bot's messages are in English, like the app.

### Mini App

The same app opens inside Telegram — from the **Open app** menu button (setup step 6), or from **Open** under a reminder, `/next` or a new task, and **Open New task**, which go straight to that page.

- **Sign-in** is automatic: Telegram hands the page signed data about who opened it (`initData`), `/telegram` sends it to `POST /api/telegram/session`, and the server checks the signature with the bot token and that it's under an hour old, then creates an ordinary 30-day session — the same as after Google. A forged, stale or other bot's string gets a 401 and no session.
- **Only a chat already connected on `/settings`** can sign in. Any other Telegram account sees "Connect this Telegram account first" with a button that opens Settings in the browser; no account is created from Telegram.
- Inside Telegram `/login` doesn't offer Google or email (neither works in Telegram's built-in browser) — it signs in through Telegram. **Sign out** works as usual; afterwards the page offers "Sign in with Telegram" instead of signing straight back in.
- Telegram's **Back** button shows on a task, its edit page, New task, a habit's page and Sent reminders, and goes back — or, opened straight on a page from a button, to its parent (task → Tasks, habit → Progress, Sent reminders → Settings). Telegram's header and background take the app's light colours; Telegram's own theme isn't used.
- `/telegram` opened in a normal browser doesn't sign in and points to the usual sign-in.
- Telegram's apps (iOS, Android, desktop) are supported. **Telegram Web** (web.telegram.org) runs the Mini App in an iframe, where browsers may block its cookie — it may not stay signed in there.
- Open buttons become Mini App buttons only when `AUTH_URL` is `https` (Telegram rejects anything else); with a local `http://localhost` they stay plain links. The Mini App itself only opens from a public `https` URL, so locally `/telegram` can be tried by adding signed data to the hash — `#tgWebAppData=<initData>` — the way Telegram passes it.

## Habits

Things you do every day — sleep, steps, water, a morning workout — kept apart from tasks: a habit has no time, is never overdue, and stays out of Calendar, Overdue and "How it's going".

- **Two kinds.** **Done or not** (vitamins) and **An amount** with a unit and a daily goal. Hours and litres are typed as such ("8 h", "1.5 L") and stored as whole minutes and millilitres; they show as "7.5/8 h", "45 min/1 h", "0.5/1.5 L". A day counts once its goal is reached.
- **One tap on Home** does the habit's one thing: ticks it, **marks the goal** at once (sleep, reading, a workout, phone-free time — a second tap clears it) or **adds a step** (water +250 ml, steps +1,000). **⋯** on an amount opens today's exact value: −, +, **Goal ✓** or a typed number ("slept 7.5 h").
- **Days and goals.** Every day by default, or the weekdays you pick — or **Different by day**: a goal per weekday (steps 10,000 on weekdays and 5,000 at the weekend; sleep 7.5 h and 9 h), an empty day being a day off. Days off don't show and don't break a streak.
- **The goal is kept with each day's mark**, so changing it later (1.5 L → 2 L) leaves past days and streaks as they were.
- **Home.** Under the greeting, on days with tasks or without: "Daily 3/7" and a tile per habit, two a row (seven take four rows), filling as it adds up; done ones stay in place, tinted. All done folds into "Daily · all done ✓" (**Show** opens it for an undo). **Edit** goes to Progress.
- **Progress** (the tab that replaced Inbox; sent reminders moved to Settings → **Sent reminders**). **This week** — a row per habit, a dot per day (done · partly · missed · today · day off · ahead). Then each habit: its streak ("🔥 5 in a row", counting the days it's on; today, until marked, doesn't break it), the best, 30 days as small squares, the share of days done and, for amounts, the average a day, and 🏅 for every streak milestone reached. **Edit list** moves habits up and down (the same order on Home and in Telegram); **+ New habit** offers Sleep 8 h, Walk 7,000 steps, Water 1.5 L, Morning workout 10 min, Reading 1 h and No phone 1 h. A habit's page: the last 7 days to set or correct (today and six before, not before it was created), its settings, **Archive habit** (off Home and Telegram, history kept, back with **Restore**) and **Delete** (with its marks, after asking).
- **Praise**, worked out from the marks, nothing stored: a streak of 3, 7, 14, 30, 60, 100 or 365 days ("Water — 1.5 L a day for a whole month. Well done!"); a new best from 7 days; coming back after a run of 7+ ("back on track, day 2. Your best is 12."); every day of last month (shown the first week of the next); a perfect week for all habits (Monday to Wednesday after). The best one shows above the tiles on Home, two on Progress, one in the morning summary; a mark that reaches a goal says its news, or "All done for today ✓", in a toast.
- Stored as `Habit` (`dayTargets` — seven goals Monday first when they differ, `tapSetsGoal`) and `HabitLog` — one row per habit per local date (`"YYYY-MM-DD"` in your time zone) with the value and that day's goal, none for a day with nothing done.

## Home: the assistant's message

The card under the greeting ("From your assistant") is on Home every day, empty days too, above the habits. Its headline and a few sentences read the day as it is (`assistant-message.ts`):

- **How full** — empty, light (1–2), steady (3–5), packed (6+ or overlaps); **the weekday** (a Monday starts the week, a Friday ends it, a weekend is gentler) and **the hour** (late at night: "the one thing left can wait until morning").
- **Real counts, as they change**: done (partly done counts) and skipped today — "Three of five done (one skipped); two to go", "One more thing and the week's work is behind you", "Everything for today is closed: three done, one skipped" — tasks left from earlier days ("Plus two things left from before"), habits still to tick, overlaps, when the day is free from (Google busy time included), and the 30-day pattern sentence.
- **Many phrasings**, more than twenty for an empty day alone (by weekday, and for evening and night). Which one is picked depends on the user and the date: the text stays put on reload and changes when the day does — a task closed, a new one added, evening coming.
- Headlines match: "A full day ahead", "A light day", "Making progress", "Almost there", "All done", "Winding down", "A free weekend day", "Room to catch up".

## Your patterns

The app counts what happened to your past tasks and shows it back to you. It's plain counting over each task's status and planned time — no model, nothing new is tracked or stored.

**Each task counts once:**

| Outcome     | When                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Completed   | marked Done                                                          |
| Partial     | marked Partially done                                                |
| Skipped     | marked Skip                                                          |
| Missed      | its day is over and it was never marked (still Scheduled or Snoozed) |
| not counted | cancelled, or still open today or later                              |

**Completion rate** = Completed ÷ everything counted. Partial and Missed count as not done: a late task you never opened isn't a finished one.

**Where it shows:**

- **`/progress`, "How it's going"** — the Progress tab, below Habits, and from Home's sentence. Two blocks:
  - **"Last 7 days"** — today and the six days before: Completed, Partial, Skipped, Missed and the completion rate. Missed only counts days that are over.
  - **"Last 30 days"** — the 30 whole days before today, so the numbers don't change during the day. The share done in each part of the day, by the task's planned local start: morning 05–12, afternoon 12–18, evening 18–20, after 20:00 20–05. Then weekdays against Saturday and Sunday.
- **Home, "From your assistant"** — the pattern sentence ends the assistant's message (see "Home: the assistant's message") only when it's about today: "You finish 33% of tasks after 20:00 — two of today's are that late.", with a "How it's going →" link. One small extra database query per Home render.
- **`/progress`, "Usual workout time: around 19:00 (6 of 8 workouts)."** — under "Last 30 days", with its own threshold (see "Finding free time" → "Your habits"), so it can show before the rest does. Free-time suggestions use it too.

**When there's a sentence:**

- Nothing at all below **20** counted tasks in the 30 days — "Not enough history yet … (10 of 20 so far)".
- A part of the day (or weekdays/weekends) takes part only with at least **5** tasks; fewer shows "too few".
- A sentence only when the best and the worst are at least **15** points apart, on the whole percents you see. Otherwise the bars alone.

Each task is counted on its own, so a daily task can carry a whole part of the day — the "N of M" next to each bar shows how much it rests on. Parts of the day use your current time zone; a task moved to another time counts at the time it ended up at.

## Architecture

Layering rule (see `docs/adr/001-project-structure.md`): components never call Prisma directly.

```
React component → Server Action → Application service → Repository → PostgreSQL
```
