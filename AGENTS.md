# AGENTS.md

## Cursor Cloud specific instructions

### Overview
QuanticScreen is a Streamlit-based stock screening web app. See `README.md` for full architecture and usage details.

### Running the app
```
streamlit run QuanticScreen.py --server.port 8501 --server.headless true
```
The app uses SQLite fallback (`stock_screen.db`) automatically when no `DATABASE_URL` is configured. With an empty DB, sample data (AAPL, MSFT, GOOGL, TSLA) is displayed.

### Secrets
The app reads `.streamlit/secrets.toml` for `DATABASE_URL` and `admin_password`. This file is gitignored. For local dev without a cloud DB, the app falls back to SQLite — no secrets file is needed.

### Lint / type checking
No lint or test tooling is configured in the repo. You can run:
- `pyright` for type checking (pre-existing type errors exist in the codebase; these are not regressions)
- `python3 -m py_compile <file>` for syntax verification

### Gotchas
- `libpq-dev` must be installed as a system package for `psycopg[binary]` to install. The update script handles this.
- The `db.py` module uses `sqlalchemy.dialects.sqlite.insert` for its `set_metadata` upsert, which means the `on_conflict_do_update` path only works with SQLite. This is fine for local dev but keep it in mind when reasoning about PostgreSQL behavior.
- The Streamlit `config.toml` sets `fileWatcherType = "none"`, so hot-reload on file changes is disabled. You must restart the Streamlit server after code changes.
- Background fetch threads (`fetch_bg`) start automatically on first page load and poll every 15 minutes. These may produce network errors in the logs when Yahoo Finance is unreachable — this is expected and non-blocking.
