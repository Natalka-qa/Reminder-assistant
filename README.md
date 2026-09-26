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

Skip this if you don't need it — without `GOOGLE_CALENDAR_ENABLED=true` there's no "Google Calendar" section on `/settings`, no request ever goes to Google, and conflict checks only look at your own tasks.

With it, a connected user's **primary** calendar is checked for busy times whenever they create or edit a task, and an overlap shows up in the same conflict dialog as an overlapping task ("Create anyway" still saves). Only free/busy is read — scope `calendar.freebusy`, never event titles or details — and the busy times aren't stored. The connection is a second Auth.js provider, `google-calendar`, on the same OAuth client as "Sign in with Google"; its tokens live in the `Account` row with `provider = "google-calendar"`. Connecting writes real OAuth tokens, so test it locally against a Neon dev branch, not production.

In the Google Cloud project that owns `GOOGLE_CLIENT_ID`:

1. **APIs & Services → Library → Google Calendar API → Enable.**
2. **Google Auth Platform → Data access → Add or remove scopes:** add `https://www.googleapis.com/auth/calendar.freebusy` (non-sensitive), save.
3. **Clients →** the web client **→ Authorized redirect URIs:** add `http://localhost:3000/api/auth/callback/google-calendar` and `https://<your-domain>/api/auth/callback/google-calendar`.
4. **Branding:** Homepage `https://<your-domain>`, Privacy policy `https://<your-domain>/privacy`, Terms of service `https://<your-domain>/terms`, and `<your-domain>` under Authorized domains. Use the contact address from `src/app/(legal)/legal.tsx` (`LEGAL_CONTACT_EMAIL`) as the User support email. Google requires these links before an external app can be published.
5. **Audience → Publish app → Confirm** ("In production"). Until then the app is in **Testing**: only accounts under **Audience → Test users** can connect — everyone else gets "Access blocked … Error 403: access_denied" — and refresh tokens expire after 7 days, so the connection drops to "Not connected" every week. Testing plus your own account as a test user is fine for local development; production needs "In production" before the flag is turned on.
6. Set `GOOGLE_CALENDAR_ENABLED=true` in `.env.local` (or Vercel's environment variables) and restart/redeploy.
7. On `/settings`, click "Connect" under Google Calendar and keep the calendar box ticked on Google's consent screen — if it's unticked, `/settings` says so and offers "Connect" again. "Disconnect" revokes the access at Google and deletes the tokens.

## Architecture

Layering rule (see `docs/adr/001-project-structure.md`): components never call Prisma directly.

```
React component → Server Action → Application service → Repository → PostgreSQL
```
