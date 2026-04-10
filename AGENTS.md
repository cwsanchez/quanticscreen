# AGENTS.md

## Cursor Cloud specific instructions

### Overview

QuanticScreen is a modern Next.js (App Router) stock screening web app backed by Supabase (PostgreSQL) and Yahoo Finance data. No authentication required — fully public app. See `README.md` for full architecture and usage details.

### Running the app

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`. The app requires a Supabase project with the migration file applied:
- `supabase/migrations/001_initial_schema.sql`

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase **Publishable key** (called "anon key" in env vars)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase **Secret key** (server-side only)
- `CRON_SECRET` — Bearer token for the `/api/cron` endpoint (optional locally)

### Build & lint

```bash
npm run build # Production build
npm run lint # ESLint
```

No test suite is configured. Use `npx tsc --noEmit` for type checking.

### Gotchas

- The app uses `yahoo-finance2` v3+ which requires instantiation: `const yf = new YahooFinance()`. The old static API is no longer supported.
- Yahoo Finance may rate-limit or return errors — this is expected and non-blocking.
- The cron handler (`/api/cron`) includes randomized sleep between fetches to avoid rate limits.
- The cron handler also gradually seeds S&P 500 tickers (up to 50 per run) from the hardcoded list in `src/lib/tickers.ts`.
- No authentication is used. All pages are fully public with no login or sign-up.
- Watchlist uses 100% localStorage — no server-side watchlist storage.
- `vercel.json` configures a cron schedule (`0 */4 * * *`) that only runs when deployed to Vercel.
- Hot reload works normally in dev mode (`next dev`).
- Searching a ticker that doesn't exist in the database auto-fetches and inserts it.
