# Reminder

A personal scheduling assistant.

## Stack

- [Next.js](https://nextjs.org) 16.3.4 — App Router, Turbopack, TypeScript strict
- [React](https://react.dev) 19.2.8
- [Tailwind CSS](https://tailwindcss.com) v4 (CSS-first config via `@theme`)
- [Prisma](https://www.prisma.io) + PostgreSQL ([Neon](https://neon.tech))
- [Auth.js](https://authjs.dev) (`next-auth` v5) — Google OAuth + email magic link
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
2. Set every variable from `.env.example` in the project's Vercel dashboard (Settings → Environment Variables) — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. The three `TELEGRAM_*` variables and `GOOGLE_CALENDAR_ENABLED` are optional — add them to enable Telegram notifications / the Google Calendar busy check in production, or leave them out.
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

5. On `/settings`, click "Connect" and open the resulting `t.me/...` link — Telegram sends the bot `/start <code>`, which the webhook uses to link your account.

### Google Calendar setup

Skip this if you don't need it — without `GOOGLE_CALENDAR_ENABLED=true` there's no "Google Calendar" section on `/settings`, no request ever goes to Google, and conflict checks and free-time suggestions only look at your own tasks.

With it, a connected user's **primary** calendar is checked for busy times whenever they create or edit a task, and an overlap shows up the same way an overlapping task does — in the New task form's overlap notice and the edit form's conflict dialog; either way the task can still be saved. Free-time suggestions skip those busy times too (see "Finding free time"). Only free/busy is read — scope `calendar.freebusy`, never event titles or details — and the busy times aren't stored. The connection is a second Auth.js provider, `google-calendar`, on the same OAuth client as "Sign in with Google"; its tokens live in the `Account` row with `provider = "google-calendar"`. Connecting writes real OAuth tokens, so test it locally against a Neon dev branch, not production.

In the Google Cloud project that owns `GOOGLE_CLIENT_ID`:

1. **APIs & Services → Library → Google Calendar API → Enable.**
2. **Google Auth Platform → Data access → Add or remove scopes:** add `https://www.googleapis.com/auth/calendar.freebusy` (non-sensitive), save.
3. **Clients →** the web client **→ Authorized redirect URIs:** add `http://localhost:3000/api/auth/callback/google-calendar` and `https://<your-domain>/api/auth/callback/google-calendar`.
4. **Branding:** Homepage `https://<your-domain>`, Privacy policy `https://<your-domain>/privacy`, Terms of service `https://<your-domain>/terms`, and `<your-domain>` under Authorized domains. Use the contact address from `src/app/(legal)/legal.tsx` (`LEGAL_CONTACT_EMAIL`) as the User support email. Google requires these links before an external app can be published.
5. **Audience → Publish app → Confirm** ("In production"). Until then the app is in **Testing**: only accounts under **Audience → Test users** can connect — everyone else gets "Access blocked … Error 403: access_denied" — and refresh tokens expire after 7 days, so the connection drops to "Not connected" every week. Testing plus your own account as a test user is fine for local development; production needs "In production" before the flag is turned on.
6. Set `GOOGLE_CALENDAR_ENABLED=true` in `.env.local` (or Vercel's environment variables) and restart/redeploy.
7. On `/settings`, click "Connect" under Google Calendar and keep the calendar box ticked on Google's consent screen — if it's unticked, `/settings` says so and offers "Connect" again. "Disconnect" revokes the access at Google and deletes the tokens.

## Finding free time

The app suggests free times in three places. It only fills in a date and time — nothing is saved until you press "Create task" or save the edit.

- **New task, from a phrase.** "Find me an hour tomorrow evening for a workout", "Найди завтра вечером час для тренировки", "Знайди завтра ввечері годину для тренування". The first free slot becomes the task's date and time (the task stays Flexible — the app picked the time, you didn't), and up to two more are offered under When. Nothing free: "No free hour tomorrow evening." and the rest of the form is filled as usual.
- **New task, from an overlap.** When the chosen time overlaps a task or a Google Calendar busy time, the notice adds "Free nearby: 17:30 · 20:45" — up to two slots closest to it, one on each side where there's room.
- **Home, "A small suggestion".** When a flexible task sits at the same time as another one, the card suggests moving it to the first free time today after the other ends. No free time left today — no card.

**Your hours** are on `/settings`, each user's own:

| Setting                   | Default             | What it does                                                                                                       |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Start of day / End of day | 08:00 / 21:00       | Nothing is suggested outside them. Morning is start of day–12:00, afternoon 12:00–18:00, evening 18:00–end of day. |
| Work hours                | Mon–Fri 09:00–17:00 | Busy for suggestions, unless the task can be done during work. No days picked — no work hours.                     |
| Workouts start by         | 20:00               | The latest a workout may **start** (a one-hour workout can be 20:00–21:00). "No limit" turns it off.               |

**What counts as busy:**

- Your open tasks (Scheduled or Snoozed), checked the same way the overlap notice checks them — touching isn't overlapping. A slot you're offered never shows up as an overlap.
- Your Google Calendar's busy times, if `GOOGLE_CALENDAR_ENABLED=true` and you've connected it: **one** free/busy request per search, however many days it covers. "Free nearby" asks nothing extra — it reuses the overlap check's request. Home never asks Google.
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

- **`/progress`, "How it's going"** — reached from a row on `/settings` and from Home's sentence. Two blocks:
  - **"Last 7 days"** — today and the six days before: Completed, Partial, Skipped, Missed and the completion rate. Missed only counts days that are over.
  - **"Last 30 days"** — the 30 whole days before today, so the numbers don't change during the day. The share done in each part of the day, by the task's planned local start: morning 05–12, afternoon 12–18, evening 18–20, after 20:00 20–05. Then weekdays against Saturday and Sunday.
- **Home, "Assistant insight"** — one sentence, only when it's about today: "You finish 33% of tasks after 20:00 — two of today's are that late.", with a "How it's going →" link. One small extra database query per Home render, none to Google.

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
