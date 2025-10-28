from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, desc, func, and_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, joinedload
from sqlalchemy.dialects.sqlite import insert
from datetime import datetime, timedelta
import json

DB_NAME = 'stock_screen.db'
engine = create_engine(f'sqlite:///{DB_NAME}', echo=False)
Base = declarative_base()
Session = sessionmaker(bind=engine)

class Stock(Base):
    __tablename__ = 'Stocks'
    ticker = Column(String, primary_key=True)
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

    stock = relationship("Stock", back_populates="fetches")
    processed_results = relationship("ProcessedResult", back_populates="metric_fetch")

Stock.fetches = relationship("MetricFetch", back_populates="stock")

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

    metric_fetch = relationship("MetricFetch", back_populates="processed_results")

def init_db():
    """
    Initializes the database by creating tables if they don't exist.
    """
    Base.metadata.create_all(engine)
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
    Retrieves the latest metrics for a ticker if fetched <72 hours ago.
    Returns reconstructed metrics dict (like from fetch_metrics) or None if no recent data.
    """
    session = Session()
    latest_fetch = session.query(MetricFetch).options(joinedload(MetricFetch.stock)).filter_by(ticker=ticker).order_by(desc(MetricFetch.fetch_timestamp)).first()
    session.close()

    if not latest_fetch:
        return None

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
            'fetch_timestamp': latest_fetch.fetch_timestamp,  # Added for potential future use, though not required after seeder simplification
            'fetch_id': latest_fetch.fetch_id  # Added to allow direct access if needed
        }
        return metrics
    return None

def get_latest_processed(ticker):
    """
    Retrieves the latest processed results for a ticker, linked to the latest fetch.
    Returns processed dict or None if not available.
    """
    session = Session()
    latest_fetch = session.query(MetricFetch).filter_by(ticker=ticker).order_by(desc(MetricFetch.fetch_timestamp)).first()
    if latest_fetch:
        pr = session.query(ProcessedResult).filter_by(fetch_id=latest_fetch.fetch_id).first()
        if pr:
            flags = json.loads(pr.flags)
            factor_boosts = json.loads(pr.factor_boosts)
            processed = {
                'base_score': pr.base_score,
                'final_score': pr.final_score,
                'flags': flags,
                'positives': pr.positives,
                'risks': pr.risks,
                'factor_boosts': factor_boosts,
                'metrics': get_latest_metrics(ticker)
            }
            session.close()
            return processed
    session.close()
    return None

def save_metrics(metrics):
    """
    Saves raw metrics to DB with current timestamp.
    Upserts Stock (now with sector), inserts MetricFetch.
    Returns the fetch_id.
    """
    session = Session()

    ticker = metrics['Ticker']
    company_name = metrics.get('Company Name', 'N/A')
    industry = metrics.get('Industry', 'N/A')
    sector = metrics.get('Sector', 'N/A')

    # Upsert Stock
    stmt = insert(Stock).values(ticker=ticker, company_name=company_name, industry=industry, sector=sector)
    stmt = stmt.on_conflict_do_update(
        index_elements=['ticker'],
        set_={'company_name': company_name, 'industry': industry, 'sector': sector}
    )
    session.execute(stmt)

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
        ebitda_actual=metrics.get('EBITDA Actual') if metrics.get('EBITDA Actual') != 'N/A' else None
    )
    session.add(fetch)
    session.commit()
    fetch_id = fetch.fetch_id
    session.close()
    return fetch_id

def save_processed(processed, fetch_id):
    """
    Saves processed results to DB, linked to fetch_id.
    Stores flags and factor_boosts as JSON strings.
    """
    session = Session()
    existing = session.query(ProcessedResult).filter_by(fetch_id=fetch_id).first()
    if existing:
        session.close()
        return  # Skip if already exists to avoid duplicates on re-seed

    flags_json = json.dumps(processed['flags'])
    factor_boosts_json = json.dumps(processed['factor_boosts'])

    result = ProcessedResult(
        fetch_id=fetch_id,
        base_score=processed['base_score'],
        final_score=processed['final_score'],
        flags=flags_json,
        positives=processed['positives'],
        risks=processed['risks'],
        factor_boosts=factor_boosts_json
    )
    session.add(result)
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