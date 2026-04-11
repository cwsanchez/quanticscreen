# AGENTS.md

## Cursor Cloud specific instructions

### Overview

QuanticScreen is a modern Next.js (App Router) stock screening web app backed by Supabase (PostgreSQL) and Yahoo Finance data. No authentication required — fully public app. See `README.md` for full architecture and usage details.

### Running the app

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`. The app requires a Supabase project with the migration files applied:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_user_watchlists.sql`
- `supabase/migrations/003_ai_reviews.sql`

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase **Publishable key** (called "anon key" in env vars)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase **Secret key** (server-side only)
- `CRON_SECRET` — Bearer token for the `/api/cron` endpoint (optional locally)
- `XAI_API_KEY` — xAI API key for AI company analysis (optional — feature disabled without it)

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
- The cron handler seeds ~500 high-quality tickers (up to 100 per run), refreshes stale metrics (up to 50), and generates AI reviews (up to 10 per run).
- No authentication is used. All pages are fully public with no login or sign-up.
- Watchlist uses 100% localStorage — no server-side watchlist storage.
- `vercel.json` configures a cron schedule (`0 */4 * * *`) that only runs when deployed to Vercel.
- Hot reload works normally in dev mode (`next dev`).
- Searching a ticker that doesn't exist in the database auto-fetches and inserts it.
- AI Analysis tab on stock detail page requires `XAI_API_KEY` env var. Without it, a friendly "not configured" message is shown.
- AI reviews are cached for 7 days to keep API costs low.
