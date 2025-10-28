# db.py (refactored with SQLAlchemy)
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.sqlite import insert
from datetime import datetime
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

def get_value(metrics, key):
    """
    Helper to get float value or None if 'N/A'/missing.
    """
    val = metrics.get(key, 'N/A')
    return float(val) if val != 'N/A' else None

def save_metrics(metrics):
    """
    Saves raw metrics to DB with current timestamp.
    Upserts Stock, inserts MetricFetch.
    Returns the fetch_id.
    """
    session = Session()

    ticker = metrics['Ticker']
    company_name = metrics.get('Company Name', 'N/A')
    industry = metrics.get('Industry', 'N/A')

    # Upsert Stock
    stmt = insert(Stock).values(ticker=ticker, company_name=company_name, industry=industry)
    stmt = stmt.on_conflict_do_update(
        index_elements=['ticker'],
        set_={'company_name': company_name, 'industry': industry}
    )
    session.execute(stmt)

    # Insert MetricFetch
    now = datetime.now().isoformat()
    fetch = MetricFetch(
        ticker=ticker,
        fetch_timestamp=now,
        pe=get_value(metrics, 'P/E'),
        roe=get_value(metrics, 'ROE'),
        de=get_value(metrics, 'D/E'),
        pb=get_value(metrics, 'P/B'),
        peg=get_value(metrics, 'PEG'),
        gross_margin=get_value(metrics, 'Gross Margin'),
        net_profit_margin=get_value(metrics, 'Net Profit Margin'),
        fcf_ev=get_value(metrics, 'FCF % EV TTM'),
        ebitda_ev=get_value(metrics, 'EBITDA % EV TTM'),
        current_price=get_value(metrics, 'Current Price'),
        w52_high=get_value(metrics, '52W High'),
        w52_low=get_value(metrics, '52W Low'),
        market_cap=get_value(metrics, 'Market Cap'),
        ev=get_value(metrics, 'EV'),
        total_cash=get_value(metrics, 'Total Cash'),
        total_debt=get_value(metrics, 'Total Debt'),
        fcf_actual=get_value(metrics, 'FCF Actual'),
        ebitda_actual=get_value(metrics, 'EBITDA Actual')
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