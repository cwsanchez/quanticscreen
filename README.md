# QuanticScreen

A modern, production-ready stock screening platform built with Next.js — like Yahoo Finance, but actually good. Custom multi-factor scoring, proprietary flags, a full logic builder, and a dark-mode-first UI that makes screening stocks a pleasure.

![Next.js](https://img.shields.io/badge/Next.js-App_Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)

---

## Overview

QuanticScreen is a modern Yahoo Finance replacement with custom scoring and logic builder capabilities. It combines real-time Yahoo Finance data with a proprietary multi-factor scoring engine, letting you screen, rank, and analyze stocks with far more depth than any free tool.

**Key capabilities:**

- **Smart Search** — Type-ahead ticker search with instant mini-cards (key metrics + sparkline charts)
- **Multi-Factor Scoring** — Weighted scoring across 8+ fundamental metrics with customizable normalizers
- **8 Proprietary Flags** — Undervalued, Strong Balance Sheet, Quality Moat, GARP, High-Risk Growth, Value Trap, Momentum Building, Debt Burden
- **5 Built-in Presets** — Overall, Value, Growth, Momentum, Quality — each with tuned flag boost weights
- **Advanced Screener** — TanStack Table v8 with sorting, filtering, column visibility, pagination, and CSV export
- **Stock Detail Pages** — Full metric breakdown, price charts (Recharts), 52-week range bar, factor boost cards, preset rankings
- **Custom Logic Builder** — Build your own scoring strategy: select metrics, adjust weights, configure flag boosts, preview results
- **Admin Panel** — Password-protected bulk operations: refresh stale data, add/delete tickers, prune old metrics
- **Background Refresh** — Vercel Cron job for automated metric updates with market-close-aware scheduling
- **Dark Mode Default** — Professional finance-grade UI with dark theme and responsive design

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Data Table | @tanstack/react-table v8 |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Data Source | yahoo-finance2 (server-side) |
| Icons | lucide-react |
| Deployment | Vercel |

---

## Local Setup

### Prerequisites

- **Node.js 18+** and npm
- A free [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <your-repo-url>
cd quanticscreen
npm install
```

### 2. Set up Supabase (database)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a project (or use an existing one).
2. Open the **SQL Editor** and paste the contents of `supabase/migrations/001_initial_schema.sql`. Run it.

This creates the following tables and views:

| Object | Purpose |
|--------|---------|
| `stocks` | Ticker reference table (ticker, company name, sector, industry) |
| `metric_fetches` | Raw metric data from Yahoo Finance |
| `latest_metrics` | View — most recent metrics per ticker |
| `processed_results` | Cached scoring results |
| `price_history` | Historical price data (JSON) |
| `metadata` | Key-value store for app state (e.g. last fetch time) |
| `user_presets` | User-saved scoring configurations (with RLS) |

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual keys. You can find these in your **Supabase Dashboard → Project Settings → API**:

```bash
# Supabase project URL (Settings → API → Project URL)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Publishable key (Settings → API → Project API keys → "Publishable key")
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key-here

# Supabase Secret key (Settings → API → Project API keys → "Secret key")
# Server-side only — never expose to client
SUPABASE_SERVICE_ROLE_KEY=your-secret-key-here

# Password for the /admin panel
ADMIN_PASSWORD=your-secure-admin-password

# Secret for Vercel Cron job authentication (optional locally, required in production)
CRON_SECRET=your-cron-secret-here
```

> **Supabase UI label mapping:**
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the **"Publishable key"** in the Supabase dashboard
> - `SUPABASE_SERVICE_ROLE_KEY` → the **"Secret key"** in the Supabase dashboard

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the home page with a hero search bar.

If your Supabase connection is configured correctly and you've run the migration, the app is fully functional. The screener table will be empty until you seed data (see below).

---

## Authentication

QuanticScreen uses **email + password** authentication via Supabase Auth. There is no Google OAuth, magic links, or other social login — just classic email/password.

### How it works

- `/login` — Sign In / Create Account tabs with email + password fields
- Protected routes (`/screener`, `/builder`, `/presets`, `/admin`) require authentication; unauthenticated users are redirected to `/login`
- Public routes (`/`, `/ticker/[symbol]`) remain accessible without login
- Session management uses `@supabase/ssr` with cookie-based sessions and Next.js middleware
- The Navbar shows the logged-in user's email and a Sign Out button

### One-time Supabase setup

In your Supabase Dashboard → **Authentication → Providers**:

1. **Enable** the **Email** provider (should be enabled by default)
2. **Disable** Google and any other OAuth providers (if enabled)
3. Optionally disable "Confirm email" under **Authentication → Settings** for faster local development (users can sign in immediately after sign-up)

That's it — no OAuth client IDs or redirect URLs needed.

---

## How to Seed Initial Data

1. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter your `ADMIN_PASSWORD` to authenticate
3. Use **"Fetch New Stocks"** and enter comma-separated tickers: `AAPL, MSFT, GOOGL, AMZN, TSLA`
4. The app fetches live data from Yahoo Finance, scores each stock, and populates the screener

You can add as many tickers as you want. The default ticker list (`src/lib/tickers.ts`) contains 700+ tickers for bulk operations.

---

## Admin Panel

**Route:** `/admin`

The admin panel is password-protected (using `ADMIN_PASSWORD`). It provides:

- **Refresh Stale** — Re-fetch metrics for tickers whose data is older than the last market close
- **Fetch New Stocks** — Add new tickers by comma-separated symbols
- **Delete Tickers** — Remove tickers and all associated data
- **Prune Old Metrics** — Clean up old metric_fetches entries, keeping only the latest per ticker

All operations include cooldown enforcement to prevent accidental rapid-fire API calls.

---

## Background Cron

The app includes a Vercel Cron job configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

This hits `GET /api/cron` every 4 hours. The cron handler:

1. Checks if data was already fetched today
2. Identifies stale tickers (data older than last market close)
3. Fetches up to 30 tickers per run with randomized delays (to avoid rate limits)
4. Prunes old metric entries
5. Authenticates via `Authorization: Bearer <CRON_SECRET>`

Set `CRON_SECRET` in your Vercel environment variables to secure this endpoint in production.

---

## Deploying to Vercel

1. **Push** your repo to GitHub
2. **Import** the project on [vercel.com](https://vercel.com)
3. **Add environment variables** in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Publishable key from Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY` (the Secret key from Supabase)
   - `ADMIN_PASSWORD`
   - `CRON_SECRET`
4. **Deploy** — the cron job will automatically run every 4 hours

That's it. Your stock screener is live.

---

## Project Structure

```
src/
├── middleware.ts               # Session refresh + route protection
├── app/
│   ├── page.tsx               # Home — hero search with mini-cards
│   ├── login/page.tsx         # Email + password sign-in / sign-up
│   ├── screener/page.tsx      # Stock screener with TanStack table
│   ├── ticker/[symbol]/       # Stock detail page
│   ├── builder/page.tsx       # Custom logic builder
│   ├── presets/page.tsx       # Preset management
│   ├── admin/page.tsx         # Admin panel
│   ├── api/
│   │   ├── cron/route.ts      # Background refresh (Vercel Cron)
│   │   └── stocks/
│   │       ├── search/        # Yahoo Finance search
│   │       ├── fetch/         # Fetch & score single stock
│   │       ├── process/       # Score all stocks (GET preset, POST custom)
│   │       └── refresh/       # Admin actions
│   └── auth/callback/         # Supabase auth callback (PKCE code exchange)
├── components/
│   ├── AuthProvider.tsx       # Auth context (user state, sign-out)
│   ├── Navbar.tsx             # Navigation bar with auth state
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client (@supabase/ssr)
│   │   ├── server.ts          # Server Supabase client (@supabase/ssr)
│   │   └── middleware.ts      # Middleware session helper
│   ├── supabase.ts            # Legacy Supabase client (service role for DB ops)
│   ├── processor.ts           # Scoring engine
│   ├── yahoo.ts               # Yahoo Finance data fetcher
│   ├── db.ts                  # Supabase database operations
│   ├── tickers.ts             # Default ticker list (700+)
│   └── utils.ts               # Utility functions
└── types/
    └── index.ts               # TypeScript interfaces
```

---

## Scoring Algorithm

1. **Normalize** each metric to 0–100 using metric-specific functions
2. **Weight** and average normalized scores → `base_score`
3. **Detect flags** using multi-metric threshold conditions
4. **Apply flag boosts** as percentage of base score
5. **Add factor boosts** (Value, Momentum, Quality, Growth: 0/10/20 each)
6. **Final score** = `base_score + (base_score × boost%) + factor_boosts`

---

## License

MIT
