# AGENTS.md

## Cursor Cloud specific instructions

### Overview

QuanticScreen is a modern Next.js (App Router) stock screening web app backed by Supabase (PostgreSQL) and Yahoo Finance data. See `README.md` for full architecture and usage details.

### Running the app

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`. The app requires a Supabase project with the schema from `supabase/migrations/001_initial_schema.sql` applied.

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase **Publishable key** (called "anon key" in env vars)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase **Secret key** (server-side only)
- `ADMIN_PASSWORD` — Password for the `/admin` panel
- `CRON_SECRET` — Bearer token for the `/api/cron` endpoint (optional locally)

### Build & lint

```bash
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured. Use `npx tsc --noEmit` for type checking.

### Gotchas

- The app uses `yahoo-finance2` for market data. Yahoo Finance may rate-limit or return errors — this is expected and non-blocking.
- The cron handler (`/api/cron`) includes randomized sleep between fetches to avoid rate limits.
- The admin panel uses client-side password auth; the API validates `ADMIN_PASSWORD` server-side on each request.
- `vercel.json` configures a cron schedule (`0 */4 * * *`) that only runs when deployed to Vercel.
- Hot reload works normally in dev mode (`next dev`).

### Final polish pass (April 2026)

This codebase was fully rewritten from a Streamlit/Python app to Next.js + Supabase (PR #9). A final polish pass updated:
- `README.md` — Complete rewrite for the new Next.js architecture
- `AGENTS.md` — Updated from stale Streamlit references to current Next.js stack
- `.env.local.example` — Comments updated to reference current Supabase UI labels ("Publishable key" / "Secret key")
- Build verified clean; Supabase connection tested
