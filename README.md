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
- [Anthropic Claude API](https://console.anthropic.com) (`@anthropic-ai/sdk`) — natural-language "Fill from text" on new tasks

See `docs/adr/` for the architectural decisions behind the project structure and date/time library choice.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values (see comments in the file for where to get each one — Neon connection string, Google OAuth credentials, Resend API key, Anthropic API key).
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
2. Set every variable from `.env.example` in the project's Vercel dashboard (Settings → Environment Variables) — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `ANTHROPIC_API_KEY`.
3. Set `AUTH_URL` to the app's real production domain (not `http://localhost:3000`), and add that domain's `/api/auth/callback/google` as an authorized redirect URI in the Google Cloud Console.
4. Deploy. `npm run build` (Vercel's default build command) runs `prisma migrate deploy` before `next build`, so pending migrations are applied automatically on every deploy — no separate migration step needed.

`vercel.json` also registers the two cron endpoints (`/api/cron/extend-occurrences`, `/api/cron/send-notifications`); Vercel schedules them automatically once the project is deployed, no extra setup required. `GET /api/health` (no auth) does a lightweight database ping — point an external uptime monitor at it.

## Architecture

Layering rule (see `docs/adr/001-project-structure.md`): components never call Prisma directly.

```
React component → Server Action → Application service → Repository → PostgreSQL
```
