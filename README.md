# QuanticScreen

Your personal stock research dashboard — built with Next.js, Supabase, and Yahoo Finance data. No sign-up required. Personal watchlist saved in your browser. Background data grows automatically.

![Next.js](https://img.shields.io/badge/Next.js-App_Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)

---

## Overview

QuanticScreen is a personal stock research dashboard that combines real-time Yahoo Finance data with a proprietary multi-factor scoring engine. Search, score, and analyze stocks with depth and flexibility. Every page is fully public — no login, no sign-up, no friction.

**Key capabilities:**

- **Dashboard** — Search any ticker with type-ahead, view mini-cards with key metrics + sparkline charts, and pin stocks to your watchlist
- **Personal Watchlist** — Sidebar showing your pinned stocks with live pricing, sparklines, and one-click access to full reports (saved in localStorage — works instantly, no account needed)
- **Professional Stock Detail** — Sticky header with live price, interactive chart with time-range selectors, key-stats bar, two-column layout with factor scores, ratios, growth metrics, flags, and rankings
- **Multi-Factor Scoring** — Weighted scoring across 8+ fundamental metrics with customizable normalizers
- **8 Analytical Flags** — Undervalued, Strong Balance Sheet, Quality Moat, GARP, High-Risk Growth, Value Trap, Momentum Building, Debt Burden
- **5 Built-in Presets** — Overall, Value, Growth, Momentum, Quality — each with tuned flag boost weights
- **Advanced Screener** — TanStack Table v8 with sorting, filtering, column visibility, pagination, and CSV export; loads on demand via "Search" button
- **Custom Logic Builder** — Build your own scoring strategy: select metrics, adjust weights, configure flag boosts, preview results
- **Auto-Insert Tickers** — Searching a ticker that doesn't exist in the database automatically fetches and inserts it
- **Smart Background Population** — Cron job automatically populates ~500 prioritized tickers (S&P 500 + top market-cap + frequently searched) and refreshes watched / recently viewed stocks, so the database grows naturally
- **AI Analysis (xAI Grok)** — Professional weekly AI-generated company analysis with Bull/Bear cases, institutional & retail sentiment, key metrics, verdict, and confidence — cached in Supabase and throttled for cost control
- **Dark Mode** — Professional finance-grade UI with dark theme and responsive design

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

### 2. Set up Supabase (database only)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a project (or use an existing one).
2. Open the **SQL Editor** and run the contents of:
   - `supabase/migrations/001_initial_schema.sql` — core tables
   - `supabase/migrations/002_user_watchlists.sql` — watchlist table (kept for schema compatibility)
   - `supabase/migrations/003_ai_reviews.sql` — xAI Grok AI reviews cache + recently-viewed tracking

This creates the following tables and views:

| Object | Purpose |
|--------|---------|
| `stocks` | Ticker reference table (ticker, company name, sector, industry) |
| `metric_fetches` | Raw metric data from Yahoo Finance |
| `latest_metrics` | View — most recent metrics per ticker |
| `processed_results` | Cached scoring results |
| `price_history` | Historical price data (JSON) |
| `metadata` | Key-value store for app state (e.g. last fetch time) |
| `ai_reviews` | Cached xAI Grok company analysis (1 row per generation, latest per ticker used) |
| `latest_ai_reviews` | View — most recent AI review per ticker |

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

# xAI (Grok) API key — enables the "AI Analysis" tab on stock pages and
# lets the cron job pre-generate weekly AI reviews for recently viewed
# tickers. Without this key the app still runs; the AI Analysis tab will
# show a "disabled" state until the key is added.
XAI_API_KEY=your-xai-api-key-here
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

If your Supabase connection is configured correctly and you've run the migrations, the app is fully functional. Just search any ticker to start — it will be auto-fetched and added to the database.

---

## How Data Gets Populated

There are two ways stocks enter the database:

1. **On-demand search** — Searching a ticker that doesn't exist auto-fetches it from Yahoo Finance and inserts it. Viewing a ticker also marks it as "recently viewed" so the cron prioritizes keeping its metrics fresh.
2. **Background cron job** — Every run, the cron handler populates missing tickers from a prioritized ~500-ticker list (S&P 500 + top market-cap + frequently searched), refreshes metrics on watched and recently viewed stocks, and generates a small batch of AI reviews.

No manual seeding is required. The database grows naturally over time — faster than before, because every run both *populates* missing priority tickers and *refreshes* stale ones in a single pass.

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

This hits `GET /api/cron` every 4 hours. On every run, the cron handler:

1. **Populates missing priority tickers** — Fetches full metrics for up to 40 tickers from the prioritized ~500-ticker list that aren't yet in the database (with randomized delays to avoid rate limits).
2. **Refreshes stale metrics** — Picks up to 30 tickers (prioritizing recently viewed and then the priority list) whose metrics are older than the last market close, and re-fetches them.
3. **Generates AI reviews (throttled)** — If `XAI_API_KEY` is set, generates up to 10 fresh xAI Grok analyses per run for recently viewed tickers without a review in the last 7 days.
4. **Prunes old metric entries**.
5. **Authenticates** via `Authorization: Bearer <CRON_SECRET>` (if configured).

Set `CRON_SECRET` in your Vercel environment variables to secure this endpoint in production.

---

## AI Analysis (xAI Grok)

Every stock page includes an **AI Analysis** tab powered by [xAI Grok](https://x.ai/api).

The analysis is a professional, balanced research note covering:

- **Bull case** and **Bear case**
- **Institutional sentiment** and **Retail sentiment**
- **Key metrics** — Overall / Value / Growth / Momentum / Quality scores plus top ratios
- **Verdict** (Strong Buy / Buy / Hold / Sell / Strong Sell) with a **confidence** score

### How it works

- **Endpoint**: `GET /api/ai/review/[symbol]` — returns the most recent review if it's less than 7 days old, otherwise generates and caches a new one.
- **Model**: `grok-4-1-fast-reasoning` (structured JSON response).
- **Caching**: results are stored in the `ai_reviews` Supabase table; a `latest_ai_reviews` view gives the most recent review per ticker.
- **Throttling**: the cron job generates at most 10 reviews per run to keep costs low.
- **Manual refresh**: a "Regenerate" button on the AI Analysis tab forces a fresh call via `?refresh=true`.

### Setup

1. Create an API key at [x.ai/api](https://x.ai/api).
2. Add `XAI_API_KEY` to your `.env.local` (and to Vercel environment variables in production).
3. The AI Analysis tab activates automatically. Without the key, the tab shows a polite "disabled" state with setup instructions and the rest of the app is unaffected.

---

## Deploying to Vercel

1. **Push** your repo to GitHub
2. **Import** the project on [vercel.com](https://vercel.com)
3. **Add environment variables** in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Publishable key from Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY` (the Secret key from Supabase)
   - `CRON_SECRET`
   - `XAI_API_KEY` (optional — enables the AI Analysis tab)
4. **Deploy** — the cron job will automatically run every 4 hours, populating new priority tickers, refreshing stale metrics on watched / recently viewed stocks, and generating a small batch of AI reviews

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
│   └── api/
│       ├── cron/route.ts      # Background population + refresh + throttled AI reviews (Vercel Cron)
│       ├── ai/
│       │   └── review/[symbol]/route.ts  # xAI Grok AI analysis (cached 7 days)
│       └── stocks/
│           ├── search/        # Yahoo Finance search
│           ├── fetch/         # Fetch & score single stock (auto-inserts, marks recently viewed)
│           └── process/       # Score all stocks (GET preset, POST custom)
├── components/
│   ├── Navbar.tsx             # Navigation bar
│   ├── WatchlistSidebar.tsx   # Pinned stocks sidebar + PinButton (localStorage)
│   ├── StockDetail.tsx        # Professional stock detail component
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── supabase.ts            # Supabase client (service role for DB ops)
│   ├── processor.ts           # Scoring engine
│   ├── yahoo.ts               # Yahoo Finance data fetcher (v3+ API)
│   ├── db.ts                  # Supabase database operations
│   ├── tickers.ts             # Default + prioritized ticker lists (~500 high-quality tickers)
│   ├── xai.ts                 # xAI Grok client & structured-JSON review generator
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
