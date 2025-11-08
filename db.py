from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, desc, func, and_, cast, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, joinedload
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.sql import text
from sqlalchemy.exc import OperationalError
from datetime import datetime, timedelta
import json
import os
import time
import random
import streamlit as st
from streamlit.errors import StreamlitSecretNotFoundError
import logging

logging.basicConfig(level=logging.INFO)

DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL is None:
    DATABASE_URL = st.secrets.get('DATABASE_URL', 'sqlite:///stock_screen.db')

logging.info(f"Using DATABASE_URL: {DATABASE_URL[:20]}... (truncated for security)")

# Use psycopg driver for PostgreSQL URIs
scheme = DATABASE_URL.split('://')[0] if '://' in DATABASE_URL else ''
if scheme in ('postgres', 'postgresql') and '+' not in scheme:
    new_scheme = 'postgresql+psycopg'
    DATABASE_URL = DATABASE_URL.replace(scheme, new_scheme, 1)

# Ensure SSL for Neon
if 'sslmode=require' not in DATABASE_URL and 'postgres' in DATABASE_URL.lower():
    DATABASE_URL += '?sslmode=require' if '?' not in DATABASE_URL else '&sslmode=require'

# Wrap engine creation with retries
retries = 5
for attempt in range(retries):
    try:
        engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=300)
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        break
    except Exception as e:
        if attempt < retries - 1:
            sleep_time = random.randint(10, 20)
            logging.error(f"DB connection attempt {attempt + 1} failed: {e}. Retrying in {sleep_time}s...")
            time.sleep(sleep_time)
        else:
            raise e

Base = declarative_base()
Session = sessionmaker(bind=engine)

class Stock(Base):
    __tablename__ = 'Stocks'
    ticker = Column(String, primary_key=True, autoincrement=False)
    company_name = Column(String)
    industry = Column(String)
    sector = Column(String)  # New: Sector for filtering

class MetricFetch(Base):
    __tablename__ = 'MetricFetches'
    fetch_id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey('Stocks.ticker'))
    fetch_timestamp = Column(String)
    pe = Column(Float)
    roe = Column(Float)
    de = Column(Float)
    pb = Column(Float)
    peg = Column(Float)
    gross_margin = Column(Float)
    net_profit_margin = Column(Float)
    fcf_ev = Column(Float)
    ebitda_ev = Column(Float)
    current_price = Column(Float)
    w52_high = Column(Float)
    w52_low = Column(Float)
    market_cap = Column(Float)
    ev = Column(Float)
    total_cash = Column(Float)
    total_debt = Column(Float)
    fcf_actual = Column(Float)
    ebitda_actual = Column(Float)
    p_fcf = Column(Float)
    beta = Column(Float)
    dividend_yield = Column(Float)
    avg_volume = Column(Float)
    rsi = Column(Float)
    revenue_growth = Column(Float)
    earnings_growth = Column(Float)
    forward_pe = Column(Float)

    stock = relationship("Stock", back_populates="metric_fetches")

Stock.metric_fetches = relationship("MetricFetch", back_populates="stock")

class Metadata(Base):
    __tablename__ = 'metadata'
    key = Column(String, primary_key=True)
    value = Column(String)

class ProcessedResult(Base):
    __tablename__ = 'ProcessedResults'
    result_id = Column(Integer, primary_key=True, autoincrement=True)
    fetch_id = Column(Integer, ForeignKey('MetricFetches.fetch_id'))
    base_score = Column(Float)
    final_score = Column(Float)
    flags = Column(Text)  # JSON string
    positives = Column(Text)
    risks = Column(Text)
    factor_boosts = Column(Text)  # JSON string

    metric_fetch = relationship("MetricFetch")

class PriceHistory(Base):
    __tablename__ = 'PriceHistory'
    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey('Stocks.ticker'))
    fetch_timestamp = Column(String)
    history_json = Column(Text)

def init_db():
    """
    Initializes the database by creating tables if they don't exist.
    """
    from sqlalchemy import inspect
    from sqlalchemy.sql import text
    inspector = inspect(engine)

    # Migrations wrapped in try/except
    try:
        # Drop ProcessorConfigs table if exists
        if 'ProcessorConfigs' in inspector.get_table_names():
            with engine.connect() as conn:
                conn.execute(text('DROP TABLE "ProcessorConfigs"'))
                conn.commit()
    except Exception as e:
        print(f"Migration error dropping ProcessorConfigs: {e}")

    try:
        # Migration: Drop config_id column from ProcessedResults if exists
        if 'ProcessedResults' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('ProcessedResults')]
            if 'config_id' in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "ProcessedResults" DROP COLUMN config_id'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error dropping config_id: {e}")

    try:
        # Migration: Add p_fcf column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'p_fcf' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN p_fcf FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding p_fcf: {e}")

    try:
        # Migration: Add beta column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'beta' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN beta FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding beta: {e}")

    try:
        # Migration: Add dividend_yield column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'dividend_yield' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN dividend_yield FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding dividend_yield: {e}")

    try:
        # Migration: Add avg_volume column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'avg_volume' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN avg_volume FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding avg_volume: {e}")

    try:
        # Migration: Add rsi column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'rsi' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN rsi FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding rsi: {e}")

    try:
        # Migration: Add revenue_growth column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'revenue_growth' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN revenue_growth FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding revenue_growth: {e}")

    try:
        # Migration: Add earnings_growth column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'earnings_growth' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN earnings_growth FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding earnings_growth: {e}")

    try:
        # Migration: Add forward_pe column to MetricFetches if not exists
        if 'MetricFetches' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('MetricFetches')]
            if 'forward_pe' not in columns:
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE "MetricFetches" ADD COLUMN forward_pe FLOAT'))
                    conn.commit()
    except Exception as e:
        print(f"Migration error adding forward_pe: {e}")

    # Conditional table creation
    tables = [Stock, MetricFetch, Metadata, ProcessedResult, PriceHistory]
    for table in tables:
        if not (inspector.has_table(table.__tablename__.lower()) or inspector.has_table(table.__tablename__)):
            try:
                table.__table__.create(engine)
            except OperationalError as e:
                if 'already exists' in str(e):
                    pass
                else:
                    raise
    
    # Migration: Set old default timestamp for any records missing fetch_timestamp to force re-fetch on next seed
    session = Session()
    old_date = datetime(2000, 1, 1).isoformat()
    session.query(MetricFetch).filter(MetricFetch.fetch_timestamp.is_(None)).update({MetricFetch.fetch_timestamp: old_date})
    session.commit()
    session.close()

def get_value_from_db(val):
    """
    Helper to convert DB value to 'N/A' if None.
    """
    return val if val is not None else 'N/A'

def get_latest_metrics(ticker):
    """
    Retrieves the latest metrics for a ticker if fetched <12 hours ago.
    Returns reconstructed metrics dict (like from fetch_metrics) or None if no recent data.
    """
    session = Session()
    latest_fetch = session.query(MetricFetch).options(joinedload(MetricFetch.stock)).filter_by(ticker=ticker).order_by(desc(MetricFetch.fetch_timestamp)).first()
    session.close()

    if not latest_fetch:
        return None
    
    def get_all_latest_metrics():
        """
        Retrieves the latest metrics for all tickers in a single batched query.
        Returns list of metrics dicts (like get_latest_metrics) for recent data (<12 hours), or empty list if none.
        """
        session = Session()
        latest_subq = session.query(
            MetricFetch.ticker,
            func.max(MetricFetch.fetch_timestamp).label('max_ts')
        ).group_by(MetricFetch.ticker).subquery()
        latest_fetches = session.query(MetricFetch).join(
            latest_subq,
            and_(MetricFetch.ticker == latest_subq.c.ticker, MetricFetch.fetch_timestamp == latest_subq.c.max_ts)
        ).options(joinedload(MetricFetch.stock)).all()
        session.close()
    
        if not latest_fetches:
            return []
    
        metrics_list = []
        for latest_fetch in latest_fetches:
            fetch_time = datetime.fromisoformat(latest_fetch.fetch_timestamp)
            if datetime.now() - fetch_time < timedelta(hours=12):
                stock = latest_fetch.stock
                metrics = {
                    'Ticker': latest_fetch.ticker,
                    'Company Name': stock.company_name if stock else 'N/A',
                    'Industry': stock.industry if stock else 'N/A',
                    'Sector': stock.sector if stock else 'N/A',
                    'P/E': get_value_from_db(latest_fetch.pe),
                    'ROE': get_value_from_db(latest_fetch.roe),
                    'D/E': get_value_from_db(latest_fetch.de),
                    'P/B': get_value_from_db(latest_fetch.pb),
                    'PEG': get_value_from_db(latest_fetch.peg),
                    'Gross Margin': get_value_from_db(latest_fetch.gross_margin),
                    'Net Profit Margin': get_value_from_db(latest_fetch.net_profit_margin),
                    'FCF % EV TTM': get_value_from_db(latest_fetch.fcf_ev),
                    'EBITDA % EV TTM': get_value_from_db(latest_fetch.ebitda_ev),
                    'Current Price': get_value_from_db(latest_fetch.current_price),
                    '52W High': get_value_from_db(latest_fetch.w52_high),
                    '52W Low': get_value_from_db(latest_fetch.w52_low),
                    'Market Cap': get_value_from_db(latest_fetch.market_cap),
                    'EV': get_value_from_db(latest_fetch.ev),
                    'Total Cash': get_value_from_db(latest_fetch.total_cash),
                    'Total Debt': get_value_from_db(latest_fetch.total_debt),
                    'FCF Actual': get_value_from_db(latest_fetch.fcf_actual),
                    'EBITDA Actual': get_value_from_db(latest_fetch.ebitda_actual),
                    'P/FCF': get_value_from_db(latest_fetch.p_fcf),
                    'fetch_timestamp': latest_fetch.fetch_timestamp,
                    'fetch_id': latest_fetch.fetch_id
                }
                metrics_list.append(metrics)
        return metrics_list

    fetch_time = datetime.fromisoformat(latest_fetch.fetch_timestamp)
    if datetime.now() - fetch_time < timedelta(hours=72):
        # Reconstruct metrics dict
        stock = latest_fetch.stock  # Via relationship (now eager-loaded)
        metrics = {
            'Ticker': ticker,
            'Company Name': stock.company_name if stock else 'N/A',
            'Industry': stock.industry if stock else 'N/A',
            'Sector': stock.sector if stock else 'N/A',
            'P/E': get_value_from_db(latest_fetch.pe),
            'ROE': get_value_from_db(latest_fetch.roe),
            'D/E': get_value_from_db(latest_fetch.de),
            'P/B': get_value_from_db(latest_fetch.pb),
            'PEG': get_value_from_db(latest_fetch.peg),
            'Gross Margin': get_value_from_db(latest_fetch.gross_margin),
            'Net Profit Margin': get_value_from_db(latest_fetch.net_profit_margin),
            'FCF % EV TTM': get_value_from_db(latest_fetch.fcf_ev),
            'EBITDA % EV TTM': get_value_from_db(latest_fetch.ebitda_ev),
            'Current Price': get_value_from_db(latest_fetch.current_price),
            '52W High': get_value_from_db(latest_fetch.w52_high),
            '52W Low': get_value_from_db(latest_fetch.w52_low),
            'Market Cap': get_value_from_db(latest_fetch.market_cap),
            'EV': get_value_from_db(latest_fetch.ev),
            'Total Cash': get_value_from_db(latest_fetch.total_cash),
            'Total Debt': get_value_from_db(latest_fetch.total_debt),
            'FCF Actual': get_value_from_db(latest_fetch.fcf_actual),
            'EBITDA Actual': get_value_from_db(latest_fetch.ebitda_actual),
            'P/FCF': get_value_from_db(latest_fetch.p_fcf),
            'Beta': get_value_from_db(latest_fetch.beta),
            'Dividend Yield': get_value_from_db(latest_fetch.dividend_yield),
            'Average Volume': get_value_from_db(latest_fetch.avg_volume),
            'RSI': get_value_from_db(latest_fetch.rsi),
            'Revenue Growth': get_value_from_db(latest_fetch.revenue_growth),
            'Earnings Growth': get_value_from_db(latest_fetch.earnings_growth),
            'Forward PE': get_value_from_db(latest_fetch.forward_pe),
            'fetch_timestamp': latest_fetch.fetch_timestamp,  # Added for potential future use, though not required after seeder simplification
            'fetch_id': latest_fetch.fetch_id  # Added to allow direct access if needed
        }
        return metrics
    return None

def prune_old_metrics(tickers=None, keep_days=7):
    """
    Deletes MetricFetches and ProcessedResults older than keep_days.
    If tickers provided, filters to those; else all.
    Always keeps the latest fetch per ticker even if old.
    Uses subqueries for cascades, logs counts deleted.
    """
    session = Session()
    try:
        cutoff = datetime.now() - timedelta(days=keep_days)
        # Get latest fetch_id per ticker to keep
        if tickers:
            latest_subq = session.query(
                MetricFetch.ticker,
                func.max(MetricFetch.fetch_timestamp).label('max_ts')
            ).filter(MetricFetch.ticker.in_(tickers)).group_by(MetricFetch.ticker).subquery()
        else:
            latest_subq = session.query(
                MetricFetch.ticker,
                func.max(MetricFetch.fetch_timestamp).label('max_ts')
            ).group_by(MetricFetch.ticker).subquery()
        latest_ids = session.query(MetricFetch.fetch_id).join(
            latest_subq,
            and_(MetricFetch.ticker == latest_subq.c.ticker, MetricFetch.fetch_timestamp == latest_subq.c.max_ts)
        ).all()
        keep_ids = [row[0] for row in latest_ids]
        # Delete ProcessedResults where fetch_id not in keep_ids and fetch_timestamp < cutoff
        deleted_processed = session.query(ProcessedResult).join(MetricFetch, ProcessedResult.fetch_id == MetricFetch.fetch_id).filter(
            ProcessedResult.fetch_id.notin_(keep_ids),
            cast(MetricFetch.fetch_timestamp, DateTime) < cutoff
        ).delete(synchronize_session=False)
        # Delete MetricFetches not in keep_ids and fetch_timestamp < cutoff
        deleted_fetches = session.query(MetricFetch).filter(
            MetricFetch.fetch_id.notin_(keep_ids),
            cast(MetricFetch.fetch_timestamp, DateTime) < cutoff
        ).delete(synchronize_session=False)
        session.commit()
        logging.info(f"Pruned {deleted_fetches} MetricFetches and {deleted_processed} ProcessedResults older than {keep_days} days.")
    except Exception as e:
        session.rollback()
        logging.error(f"Error pruning old metrics: {e}")
    finally:
        session.close()

def save_metrics(metrics):
    """
    Saves raw metrics to DB with current timestamp.
    Inserts MetricFetch. Stock upsert handled elsewhere.
    Returns the fetch_id.
    """
    session = Session()

    ticker = metrics['Ticker']

    # Insert MetricFetch
    now = datetime.now().isoformat()
    fetch = MetricFetch(
        ticker=ticker,
        fetch_timestamp=now,
        pe=metrics.get('P/E') if metrics.get('P/E') != 'N/A' else None,
        roe=metrics.get('ROE') if metrics.get('ROE') != 'N/A' else None,
        de=metrics.get('D/E') if metrics.get('D/E') != 'N/A' else None,
        pb=metrics.get('P/B') if metrics.get('P/B') != 'N/A' else None,
        peg=metrics.get('PEG') if metrics.get('PEG') != 'N/A' else None,
        gross_margin=metrics.get('Gross Margin') if metrics.get('Gross Margin') != 'N/A' else None,
        net_profit_margin=metrics.get('Net Profit Margin') if metrics.get('Net Profit Margin') != 'N/A' else None,
        fcf_ev=metrics.get('FCF % EV TTM') if metrics.get('FCF % EV TTM') != 'N/A' else None,
        ebitda_ev=metrics.get('EBITDA % EV TTM') if metrics.get('EBITDA % EV TTM') != 'N/A' else None,
        current_price=metrics.get('Current Price') if metrics.get('Current Price') != 'N/A' else None,
        w52_high=metrics.get('52W High') if metrics.get('52W High') != 'N/A' else None,
        w52_low=metrics.get('52W Low') if metrics.get('52W Low') != 'N/A' else None,
        market_cap=metrics.get('Market Cap') if metrics.get('Market Cap') != 'N/A' else None,
        ev=metrics.get('EV') if metrics.get('EV') != 'N/A' else None,
        total_cash=metrics.get('Total Cash') if metrics.get('Total Cash') != 'N/A' else None,
        total_debt=metrics.get('Total Debt') if metrics.get('Total Debt') != 'N/A' else None,
        fcf_actual=metrics.get('FCF Actual') if metrics.get('FCF Actual') != 'N/A' else None,
        ebitda_actual=metrics.get('EBITDA Actual') if metrics.get('EBITDA Actual') != 'N/A' else None,
        p_fcf=metrics.get('P/FCF') if metrics.get('P/FCF') != 'N/A' else None,
        beta=metrics.get('Beta') if metrics.get('Beta') != 'N/A' else None,
        dividend_yield=metrics.get('Dividend Yield') if metrics.get('Dividend Yield') != 'N/A' else None,
        avg_volume=metrics.get('Average Volume') if metrics.get('Average Volume') != 'N/A' else None,
        rsi=metrics.get('RSI') if metrics.get('RSI') != 'N/A' else None,
        revenue_growth=metrics.get('Revenue Growth') if metrics.get('Revenue Growth') != 'N/A' else None,
        earnings_growth=metrics.get('Earnings Growth') if metrics.get('Earnings Growth') != 'N/A' else None,
        forward_pe=metrics.get('Forward PE') if metrics.get('Forward PE') != 'N/A' else None
    )
    session.add(fetch)
    session.commit()
    fetch_id = fetch.fetch_id
    session.close()
    # Prune old metrics after save
    prune_old_metrics(tickers=[ticker])
    return fetch_id

def get_metadata(key):
    session = Session()
    result = session.query(Metadata).filter_by(key=key).first()
    session.close()
    return result.value if result else None

def set_metadata(key, value):
    session = Session()
    stmt = insert(Metadata).values(key=key, value=value)
    stmt = stmt.on_conflict_do_update(index_elements=['key'], set_={'value': value})
    session.execute(stmt)
    session.commit()
    session.close()

def get_all_tickers():
    """
    Returns list of all seeded tickers in DB.
    """
    session = Session()
    tickers = [t[0] for t in session.query(Stock.ticker).all()]
    session.close()
    return tickers

def get_unique_sectors():
    """
    Returns list of unique sectors in DB.
    """
    session = Session()
    sectors = [s[0] for s in session.query(Stock.sector).distinct().all() if s[0] != 'N/A']
    session.close()
    return sorted(sectors)

def get_stale_tickers():
    """
    Returns list of tickers with data older than 12 hours, ordered by oldest first.
    """
    session = Session()
    cutoff = datetime.now() - timedelta(hours=12)
    # TODO: Migrate fetch_timestamp to DateTime column for better performance.
    stale = session.query(MetricFetch.ticker).filter(cast(MetricFetch.fetch_timestamp, DateTime) < cutoff).order_by(MetricFetch.fetch_timestamp).all()
    session.close()
    return [t[0] for t in stale]
def get_price_history(ticker):
    """
    Retrieves the latest price history for a ticker if fetched <24 hours ago.
    Returns list of {'date':str, 'close':float} or None if no recent data.
    """
    session = Session()
    latest = session.query(PriceHistory).filter_by(ticker=ticker).order_by(desc(PriceHistory.fetch_timestamp)).first()
    session.close()
    if latest:
        fetch_time = datetime.fromisoformat(latest.fetch_timestamp)
        if datetime.now() - fetch_time < timedelta(hours=24):
            return json.loads(latest.history_json)
    return None

def save_price_history(ticker, history_list):
    """
    Saves price history to DB with current timestamp.
    """
    session = Session()
    now = datetime.now().isoformat()
    ph = PriceHistory(ticker=ticker, fetch_timestamp=now, history_json=json.dumps(history_list))
    session.add(ph)
    session.commit()
    session.close()

def get_all_latest_metrics():
    session = Session()
    if session.query(Stock).count() == 0:
        return []
    from sqlalchemy import and_
    latest_subq = session.query(
        MetricFetch.ticker,
        func.max(MetricFetch.fetch_timestamp).label('max_ts')
    ).group_by(MetricFetch.ticker).subquery()
    latest_fetches = session.query(MetricFetch).join(
        latest_subq,
        and_(MetricFetch.ticker == latest_subq.c.ticker, MetricFetch.fetch_timestamp == latest_subq.c.max_ts)
    ).options(joinedload(MetricFetch.stock)).all()
    metrics_list = []
    for fetch in latest_fetches:
        metrics = {
            'Ticker': fetch.ticker,
            'Company Name': fetch.stock.company_name if fetch.stock else 'N/A',
            'Industry': fetch.stock.industry if fetch.stock else 'N/A',
            'Sector': fetch.stock.sector if fetch.stock else 'N/A',
            'P/E': fetch.pe if fetch.pe is not None else 'N/A',
            'ROE': fetch.roe if fetch.roe is not None else 'N/A',
            'D/E': fetch.de if fetch.de is not None else 'N/A',
            'P/B': fetch.pb if fetch.pb is not None else 'N/A',
            'PEG': fetch.peg if fetch.peg is not None else 'N/A',
            'Gross Margin': fetch.gross_margin if fetch.gross_margin is not None else 'N/A',
            'Net Profit Margin': fetch.net_profit_margin if fetch.net_profit_margin is not None else 'N/A',
            'FCF % EV TTM': fetch.fcf_ev if fetch.fcf_ev is not None else 'N/A',
            'EBITDA % EV TTM': fetch.ebitda_ev if fetch.ebitda_ev is not None else 'N/A',
            'Current Price': fetch.current_price if fetch.current_price is not None else 'N/A',
            '52W High': fetch.w52_high if fetch.w52_high is not None else 'N/A',
            '52W Low': fetch.w52_low if fetch.w52_low is not None else 'N/A',
            'Market Cap': fetch.market_cap if fetch.market_cap is not None else 'N/A',
            'EV': fetch.ev if fetch.ev is not None else 'N/A',
            'Total Cash': fetch.total_cash if fetch.total_cash is not None else 'N/A',
            'Total Debt': fetch.total_debt if fetch.total_debt is not None else 'N/A',
            'FCF Actual': fetch.fcf_actual if fetch.fcf_actual is not None else 'N/A',
            'EBITDA Actual': fetch.ebitda_actual if fetch.ebitda_actual is not None else 'N/A',
            'P/FCF': fetch.p_fcf if fetch.p_fcf is not None else 'N/A',
            'Beta': fetch.beta if fetch.beta is not None else 'N/A',
            'Dividend Yield': fetch.dividend_yield if fetch.dividend_yield is not None else 'N/A',
            'Average Volume': fetch.avg_volume if fetch.avg_volume is not None else 'N/A',
            'RSI': fetch.rsi if fetch.rsi is not None else 'N/A',
            'Revenue Growth': fetch.revenue_growth if fetch.revenue_growth is not None else 'N/A',
            'Earnings Growth': fetch.earnings_growth if fetch.earnings_growth is not None else 'N/A',
            'Forward PE': fetch.forward_pe if fetch.forward_pe is not None else 'N/A',
            'fetch_timestamp': fetch.fetch_timestamp,
            'fetch_id': fetch.fetch_id
        }
        metrics_list.append(metrics)
    session.close()
    return metrics_list