# QuanticScreen

Your personal stock research dashboard — built with Next.js, Supabase, and Yahoo Finance data. No sign-up required. Personal watchlist saved in your browser. Background data grows automatically. AI-powered company analysis via xAI Grok.

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
- **AI Company Analysis** — xAI Grok-powered structured investment analysis with bull/bear cases, institutional & retail sentiment, AI factor scores, fundamental assessments, and verdict with confidence rating (cached weekly)
- **Multi-Factor Scoring** — Weighted scoring across 8+ fundamental metrics with customizable normalizers
- **8 Analytical Flags** — Undervalued, Strong Balance Sheet, Quality Moat, GARP, High-Risk Growth, Value Trap, Momentum Building, Debt Burden
- **5 Built-in Presets** — Overall, Value, Growth, Momentum, Quality — each with tuned flag boost weights
- **Advanced Screener** — TanStack Table v8 with sorting, filtering, column visibility, pagination, and CSV export; loads on demand via "Search" button
- **Custom Logic Builder** — Build your own scoring strategy: select metrics, adjust weights, configure flag boosts, preview results
- **Auto-Insert Tickers** — Searching a ticker that doesn't exist in the database automatically fetches and inserts it
- **Smart Background Population** — Cron job seeds ~500 high-quality tickers (S&P 500 + top market cap) at up to 100 per run, refreshes stale metrics on every cycle, and generates AI reviews for up to 10 stocks per run
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
| AI Analysis | xAI Grok (grok-4-1-fast-reasoning) |
| Icons | lucide-react |
| Deployment | Vercel |

---

## Local Setup

### Prerequisites

- **Node.js 18+** and npm
- A free [Supabase](https://supabase.com) project
- (Optional) An [xAI API key](https://console.x.ai/) for AI company analysis

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
   - `supabase/migrations/003_ai_reviews.sql` — AI reviews table for xAI Grok analysis

This creates the following tables and views:

| Object | Purpose |
|--------|---------|
| `stocks` | Ticker reference table (ticker, company name, sector, industry) |
| `metric_fetches` | Raw metric data from Yahoo Finance |
| `latest_metrics` | View — most recent metrics per ticker |
| `processed_results` | Cached scoring results |
| `price_history` | Historical price data (JSON) |
| `metadata` | Key-value store for app state (e.g. last fetch time) |
| `ai_reviews` | AI-generated company analysis (bull/bear cases, sentiment, scores, verdict) |

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

# xAI API key for AI company analysis (optional — feature disabled without it)
XAI_API_KEY=your-xai-api-key-here
```

> **Supabase UI label mapping:**
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the **"Publishable key"** in the Supabase dashboard
> - `SUPABASE_SERVICE_ROLE_KEY` → the **"Secret key"** in the Supabase dashboard

### xAI API Key Setup

1. Go to [console.x.ai](https://console.x.ai/) and create an account
2. Generate an API key
3. Add it as `XAI_API_KEY` in your `.env.local` (local) or Vercel environment variables (production)
4. The AI Analysis tab will appear on every stock detail page — if no key is configured, it shows a friendly "not configured" message

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

1. **On-demand search** — Searching a ticker that doesn't exist auto-fetches it from Yahoo Finance and inserts it
2. **Background cron job** — The cron handler seeds ~500 high-quality tickers (S&P 500 + top market cap + frequently searched) at up to 100 per run, refreshes stale metrics for up to 50 tickers per run, and generates AI reviews for up to 10 stocks per run

No manual seeding is required. The database grows naturally over time.

### Background Population Details

| Action | Per Run | Notes |
|--------|---------|-------|
| Seed missing tickers | Up to 100 | From prioritized list of ~500 high-quality tickers |
| Refresh stale metrics | Up to 50 | Prioritizes initial fetches, then stale data |
| Generate AI reviews | Up to 10 | Only if `XAI_API_KEY` is configured |

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

1. **Seeds missing tickers** — Checks which tickers from the ~500 priority list are missing and inserts up to 100 per run
2. Identifies stale tickers (data older than last market close)
3. Fetches up to 50 tickers per run with randomized delays (to avoid Yahoo Finance rate limits)
4. Generates AI reviews for up to 10 stocks per run (if `XAI_API_KEY` is set)
5. Prunes old metric entries
6. Authenticates via `Authorization: Bearer <CRON_SECRET>`

Set `CRON_SECRET` in your Vercel environment variables to secure this endpoint in production.

---

## AI Company Analysis

The AI Analysis feature uses xAI's Grok model to generate structured investment analysis for each stock. Reviews are cached for 7 days to keep costs low.

Each review includes:
- **Bull Case** — Reasons the stock could outperform
- **Bear Case** — Key risks and downside scenarios
- **Institutional Sentiment** — How large institutions view the stock
- **Retail Sentiment** — Social media and retail investor buzz
- **AI Factor Scores** — Overall, Value, Growth, Momentum, Quality (0-100)
- **Fundamental Assessment** — P/E assessment, revenue trend, margin trend, balance sheet, cash flow
- **Verdict** — Buy/Hold/Sell thesis with confidence percentage

Access AI analysis via the "AI Analysis" tab on any stock detail page, or through the API at `GET /api/ai/review/{TICKER}`.

---

## Deploying to Vercel

1. **Push** your repo to GitHub
2. **Import** the project on [vercel.com](https://vercel.com)
3. **Add environment variables** in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Publishable key from Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY` (the Secret key from Supabase)
   - `CRON_SECRET`
   - `XAI_API_KEY` (optional — enables AI company analysis)
4. **Deploy** — the cron job will automatically run every 4 hours, seeding tickers, refreshing data, and generating AI reviews

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
│       ├── cron/route.ts      # Background refresh + ticker seeding + AI review gen (Vercel Cron)
│       ├── ai/review/[symbol]/ # AI company analysis endpoint (xAI Grok)
│       └── stocks/
│           ├── search/        # Yahoo Finance search
│           ├── fetch/         # Fetch & score single stock (auto-inserts)
│           └── process/       # Score all stocks (GET preset, POST custom)
├── components/
│   ├── Navbar.tsx             # Navigation bar
│   ├── WatchlistSidebar.tsx   # Pinned stocks sidebar + PinButton (localStorage)
│   ├── StockDetail.tsx        # Professional stock detail + AI Analysis tab
│   └── ui/                    # shadcn/ui primitives
├── lib/
│   ├── supabase.ts            # Supabase client (service role for DB ops)
│   ├── processor.ts           # Scoring engine
│   ├── yahoo.ts               # Yahoo Finance data fetcher (v3+ API)
│   ├── db.ts                  # Supabase database operations
│   ├── tickers.ts             # Priority ticker list (~500 high-quality tickers)
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
