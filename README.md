# QuanticScreen

A modern, production-ready stock screening platform built with Next.js 15 — like Yahoo Finance, but actually good.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)

## Features

- **Smart Stock Search** — Type-ahead search powered by Yahoo Finance with instant mini-cards showing key metrics and sparkline charts
- **Multi-Factor Scoring Engine** — Weighted scoring across 8+ fundamental metrics with customizable normalizers
- **8 Proprietary Flags** — Undervalued, Strong Balance Sheet, Quality Moat, GARP, High-Risk Growth, Value Trap, Momentum Building, Debt Burden
- **5 Built-in Presets** — Overall, Value, Growth, Momentum, Quality — each with tuned flag boost weights
- **Advanced Screener** — TanStack Table v8 with sorting, filtering, column visibility, pagination, and CSV export
- **Stock Detail Pages** — Full metric breakdown, price charts (Recharts), 52-week range bar, factor boost cards, preset rankings grid
- **Custom Logic Builder** — Build your own scoring strategy: select metrics, adjust weights (0–0.3), configure flag boosts, preview results
- **Admin Panel** — Password-protected bulk operations: refresh stale data, add/delete tickers, prune old metrics (with cooldown enforcement)
- **Background Refresh** — Vercel Cron job for automated metric updates with market-close-aware scheduling
- **Dark Mode Default** — Professional finance-grade UI with dark theme, responsive design, loading skeletons

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Data Table | @tanstack/react-table v8 |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Data Source | yahoo-finance2 (server-side) |
| Icons | lucide-react |
| Deployment | Vercel-ready |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- npm or pnpm

### 1. Clone and Install

```bash
git clone <repo-url>
cd quanticscreen
npm install
```

### 2. Set Up Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service role key (server-side only)
- `ADMIN_PASSWORD` — Password for the admin panel
- `CRON_SECRET` — Secret for Vercel cron job authentication (optional)

### 3. Set Up the Database

Run the SQL migration in your Supabase SQL Editor:

```bash
# Copy and paste the contents of:
supabase/migrations/001_initial_schema.sql
```

This creates:
- `stocks` — Ticker reference table
- `metric_fetches` — Raw metric data from Yahoo Finance
- `latest_metrics` — View for most recent metrics per ticker
- `processed_results` — Cached scoring results
- `price_history` — Historical price data
- `metadata` — Key-value store for app state
- `user_presets` — User-saved configurations (with RLS)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed Initial Data

Go to the Admin page (`/admin`), authenticate, and use "Fetch New Stocks" to add tickers. Enter comma-separated tickers like `AAPL, MSFT, GOOGL`.

## Deploy to Vercel

1. Push your repo to GitHub
2. Import the project on [Vercel](https://vercel.com)
3. Add environment variables in the Vercel dashboard
4. Deploy — the cron job will automatically run every 4 hours

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home — hero search with mini-cards
│   ├── screener/          # Stock screener with TanStack table
│   ├── ticker/[symbol]/   # Stock detail page
│   ├── builder/           # Custom logic builder
│   ├── presets/           # Preset management
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   │   ├── stocks/search  # Yahoo Finance search
│   │   ├── stocks/fetch   # Fetch & process single stock
│   │   ├── stocks/process # Process all stocks
│   │   ├── stocks/refresh # Admin actions
│   │   └── cron           # Background refresh
│   └── auth/callback      # Supabase auth callback
├── components/            # Reusable UI components
│   ├── Navbar.tsx         # Navigation bar
│   └── ui/               # shadcn/ui components
├── lib/                   # Core libraries
│   ├── processor.ts       # Scoring engine (ported from Python)
│   ├── yahoo.ts           # Yahoo Finance data fetcher
│   ├── db.ts              # Supabase database operations
│   ├── supabase.ts        # Supabase client
│   ├── tickers.ts         # Default ticker list (700+)
│   └── utils.ts           # Utility functions
└── types/                 # TypeScript interfaces
    └── index.ts           # All type definitions
```

## Scoring Algorithm

1. **Normalize** each metric to 0–100 using metric-specific functions
2. **Weight** and average normalized scores to get `base_score`
3. **Detect flags** using multi-metric conditions
4. **Apply flag boosts** as percentage of base score
5. **Add factor boosts** (Value, Momentum, Quality, Growth: 0/10/20 each)
6. **Final score** = base_score + (base_score × boost%) + factor_boosts

## License

MIT
