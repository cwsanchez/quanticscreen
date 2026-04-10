# QuanticScreen

Your personal stock research dashboard — built with Next.js, Supabase, and Yahoo Finance data. Multi-factor scoring, smart flag analysis, custom watchlists, and preset strategies in a clean dark-mode UI.

![Next.js](https://img.shields.io/badge/Next.js-App_Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Auth_+_Postgres-3ecf8e)

---

## Overview

QuanticScreen is a personal stock research dashboard that combines real-time Yahoo Finance data with a proprietary multi-factor scoring engine. Search, score, and analyze stocks with depth and flexibility. All pages are fully accessible without login — sign in only to persist your watchlist to the cloud.

**Key capabilities:**

- **Dashboard** — Search any ticker with type-ahead, view mini-cards with key metrics + sparkline charts, and pin stocks to your watchlist
- **Personal Watchlist** — Sidebar showing your pinned stocks with live pricing, sparklines, and one-click access to full reports (works for guests via localStorage; sign in to save permanently)
- **Professional Stock Detail** — Sticky header with live price, interactive chart with time-range selectors, key-stats bar, two-column layout with factor scores, ratios, growth metrics, flags, and rankings
- **Multi-Factor Scoring** — Weighted scoring across 8+ fundamental metrics with customizable normalizers
- **8 Analytical Flags** — Undervalued, Strong Balance Sheet, Quality Moat, GARP, High-Risk Growth, Value Trap, Momentum Building, Debt Burden
- **5 Built-in Presets** — Overall, Value, Growth, Momentum, Quality — each with tuned flag boost weights
- **Advanced Screener** — TanStack Table v8 with sorting, filtering, column visibility, pagination, and CSV export; loads on demand via "Search" button
- **Stock Detail Pages** — Full metric breakdown, price charts (Recharts), 52-week range bar, factor boost cards, preset rankings
- **Custom Logic Builder** — Build your own scoring strategy: select metrics, adjust weights, configure flag boosts, preview results
- **Auth** — Supabase Auth with email + password (Sign In / Create Account); no OAuth or magic links
- **Auto-Insert Tickers** — Searching a ticker that doesn't exist in the database automatically fetches and inserts it
- **Seed Popular Tickers** — One-click button to seed the database with 700+ popular ticker symbols
- **Background Refresh** — Vercel Cron job for automated metric updates with market-close-aware scheduling
- **Dark Mode** — Professional finance-grade UI with dark theme and responsive design

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Auth | Supabase Auth (email + password) |
| Data Table | @tanstack/react-table v8 |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Data Source | yahoo-finance2 v3+ (server-side) |
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

### 2. Set up Supabase (database + auth)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a project (or use an existing one).
2. Open the **SQL Editor** and run the contents of:
   - `supabase/migrations/001_initial_schema.sql` — core tables
   - `supabase/migrations/002_user_watchlists.sql` — watchlist table
3. Enable authentication providers:
   - Go to **Authentication → Providers**
   - Enable **Email** provider (enabled by default)
   - Disable Google and any other OAuth providers
4. Set the site URL in **Authentication → URL Configuration** to `http://localhost:3000` (or your deployed URL).

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
| `user_watchlists` | Per-user pinned stocks with ordering (with RLS) |

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

Open [http://localhost:3000](http://localhost:3000). You should see the dashboard with a search bar.

If your Supabase connection is configured correctly and you've run both migrations, the app is fully functional. The screener table will be empty until you seed data.

---

## Authentication & Access Control

QuanticScreen uses **email + password** authentication via Supabase Auth. There is no Google OAuth, magic links, or other social login.

### Public vs. Protected

All pages are **public** and accessible without login:

| Route | Access |
|-------|--------|
| `/` (Dashboard) | Public |
| `/ticker/[symbol]` | Public |
| `/screener` | Public |
| `/builder` | Public |
| `/presets` | Public |
| `/login` | Public |

### What requires login

Only **persistent watchlist storage** requires authentication:

- **Guest users** can pin/unpin stocks using localStorage — the UI is identical to logged-in users
- **Logged-in users** have their watchlist saved to Supabase (survives across devices and browsers)
- On login, if there are locally pinned stocks, the app offers to **sync them to your account**

### Login page

- `/login` has two tabs: **Sign In** and **Create Account**
- Both use email + password fields
- No OAuth, no magic links, no social login

### One-time Supabase setup

In your Supabase Dashboard → **Authentication → Providers**:

1. **Enable** the **Email** provider (should be enabled by default)
2. **Disable** Google and any other OAuth providers (if enabled)
3. Optionally disable "Confirm email" under **Authentication → Settings** for faster local development

---

## How to Seed Initial Data

1. On the dashboard, click the **"Seed Popular Tickers"** button in the sidebar
2. This inserts 700+ ticker symbols into the `stocks` table
3. Metrics will be fetched when you search individual tickers, or on the next cron run

Alternatively, just search any ticker — if it doesn't exist in the database, it will be auto-fetched and inserted.

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
   - `CRON_SECRET`
4. **Deploy** — the cron job will automatically run every 4 hours

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx               # Dashboard — search + watchlist sidebar
│   ├── screener/page.tsx      # Stock screener with TanStack table
│   ├── ticker/[symbol]/       # Stock detail page
│   ├── builder/page.tsx       # Custom logic builder
│   ├── presets/page.tsx       # Preset management
│   ├── login/page.tsx         # Auth login page (email + password)
│   ├── api/
│   │   ├── cron/route.ts      # Background refresh (Vercel Cron)
│   │   ├── watchlist/route.ts # Watchlist CRUD API
│   │   └── stocks/
│   │       ├── search/        # Yahoo Finance search
│   │       ├── fetch/         # Fetch & score single stock (auto-inserts)
│   │       ├── process/       # Score all stocks (GET preset, POST custom)
│   │       └── seed/          # Seed popular tickers
│   └── auth/callback/         # Supabase auth callback
├── components/
│   ├── Navbar.tsx             # Navigation bar with auth
│   ├── AuthProvider.tsx       # Supabase auth context (email + password)
│   ├── WatchlistSidebar.tsx   # Pinned stocks sidebar + PinButton (localStorage + Supabase)
│   ├── StockDetail.tsx        # Professional stock detail component
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client (@supabase/ssr)
│   │   ├── server.ts          # Server Supabase client (@supabase/ssr)
│   │   └── middleware.ts      # Middleware session helper (no route protection)
│   ├── supabase.ts            # Legacy Supabase client (service role for DB ops)
│   ├── processor.ts           # Scoring engine
│   ├── yahoo.ts               # Yahoo Finance data fetcher (v3+ API)
│   ├── db.ts                  # Supabase database operations
│   ├── supabase-browser.ts    # Supabase browser client (SSR)
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
