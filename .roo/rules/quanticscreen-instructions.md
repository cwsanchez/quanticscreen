# Roo Code Agent Instructions for QuanticScreen

This file (`quanticscreen-instructions.md`) provides essential context for Roo Code agents working on the QuanticScreen project. Agents should reference this for every task to ensure consistency, avoid common pitfalls, and align with project goals. Key principles: Prioritize security, rate-limiting, and DB integrity; no automatic fetching of new tickers outside admin controls; focus on refreshes for existing data.

## Project Overview
QuanticScreen is a Streamlit web app for stock screening and analysis. It fetches financial metrics from Yahoo Finance (yfinance), stores them in a cloud PostgreSQL DB (Neon via DATABASE_URL secret, fallback to local SQLite), applies customizable scoring (e.g., P/E, ROE weights, flags like Undervalued/GARP), and displays ranked results with filters (sectors, presets, custom sets). Background refreshes stale data (>12 hours) during US market hours/weekdays only. Admin "Manage" page (password-protected via secrets) handles adding/refreshing/deleting tickers with strict rate limits. No on-demand fetching in public features—custom sets skip non-DB tickers with warnings. App is prototype-stage: Functional for ~1700 tickers, but optimize for scalability.

Goals: Reliable data freshness without abuse; user-friendly UI; no hallucinations in metrics (use fallbacks/logs). Direction: Enhance admin tools, add tests, improve error handling; avoid new deps unless critical.

## Architecture and Key Files
- **Core Files**:
  - `QuanticScreen.py`: Main Streamlit app (dashboard, filters, custom sets, background thread for refreshes). Handles UI, session state, and data loading/processing.
  - `db.py`: SQLAlchemy models (Stock, MetricFetch, ProcessedResult, Metadata), functions (init_db, get_latest_metrics, save_metrics, get_stale_tickers, get_all_latest_metrics). Uses retries for connections; no local full DB testing.
  - `fetcher.py`: yfinance integration for metrics (handles retries, calculations like PEG/P/FCF fallbacks, logs missing data).
  - `processor.py`: Scoring logic (conditions/flags, weights, factor boosts). Deterministic; re-process on fetch.
  - `pages/manage.py`: Admin page (password from secrets; manual refresh, add/refresh/delete tickers with cooldowns).
  - `pages/customize.py`: Config editing (metrics/weights/boosts; presets read-only).
- **Dependencies** (`requirements.txt`): streamlit, yfinance, pandas, sqlalchemy, numpy, psycopg[binary].
- **Config/Secrets**: `.streamlit/secrets.toml` for DATABASE_URL (Neon PostgreSQL) and admin_password. No local env for full DB—test in cloud after commit/push.
- **Data Flow**: yfinance → fetch_metrics → save_metrics (upsert Stock if new) → process_stock → save_processed. Queries use batched/eager loads for efficiency.
- **Background**: Thread in QuanticScreen.py runs fetch_bg() every 15 mins (guarded to start once/session); skips non-market hours/weekdays; batches 5-10 with 5-10s sleeps.

## Database Handling
- Neon PostgreSQL (cloud-only in prod; local SQLite fallback for basic tests). Schema: Stocks (ticker PK), MetricFetches (fetch_id serial PK, ticker FK, metrics as columns), ProcessedResults (result_id serial PK, fetch_id FK, scores/flags).
- **Testing Restrictions**: Agents cannot test DB queries directly or locally (no full Neon setup in VS Code). Make changes, advise on differences (e.g., "This updates get_stale_tickers filter—expect no type errors after cast."), and suggest tests (e.g., "Run locally to check page loads: streamlit run QuanticScreen.py; verify no syntax errors. For DB: Commit to branch, deploy to Streamlit Cloud, test manual refresh in Manage page.").
- Local runs: Load pages/files for syntax/UI checks (e.g., run QuanticScreen.py with SQLite fallback), but skip DB ops or mock them. Full testing (queries, fetches) only after git push to branch and cloud deploy—Neon requires secrets/env config.

## Fetching and Refresh Logic
- **No New Tickers Outside Admin**: Background (fetch_bg) and manual refresh only update existing stale tickers (>12 hours). Custom sets skip non-DB tickers with warnings (no queue/fetch).
- **Rate Limits**: Batches 5-10, random 5-10s sleeps; complete 1700 in <12 hours. Manage page: Add/refresh 1-20/hour; delete 1-5/5 mins; manual refresh 1/2 hours.
- **Market Constraints**: Refreshes only weekdays 9:30 AM - 4:00 PM ET (pytz 'US/Eastern'); log skips otherwise.
- **Error Handling**: Log warnings for missing metrics (e.g., Dividend Yield); retries (2x) in fetcher.py.

## Security and Admin Features
- **Admin (pages/manage.py)**: Password from secrets; session-persistent auth. Features: Manual refresh (mimics background with progress/spinner), add/refresh (prioritizes new), delete (cascades with subqueries, rollback on error).
- **Best Practices**: Parametrized queries (SQLAlchemy prevents injection). Log all ops (logging.info/error). No public fetches—warn/skip unseeded.

## Best Practices for Changes
- **Coding Standards**: Python 3.13; PEP 8; docstrings for functions; log actions/errors.
- **Changes**: Use try-except for DB/fetches; add st.error/UI feedback. Preserve rate limits/security. For UI: Use st.spinner/progress for long ops.
- **Testing Advice**: Local: Syntax/UI (run files, check loads). Cloud: Push branch, test DB interactions (e.g., add ticker in Manage, verify in table). Mock stale data for refresh tests.