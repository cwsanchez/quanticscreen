from fetcher import fetch_metrics
from processor import process_stock
from db import get_latest_metrics, save_metrics, save_processed
from datetime import datetime, timedelta

# Manageable lists: S&P 500 (~500 large cap) and partial Russell 2000 (~200 small cap) for total ~700
large_cap_tickers = ['NVDA', 'AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'BRK.B', 'WMT', 'JPM', 'ORCL', 'LLY', 'V', 'MA', 'XOM', 'NFLX', 'JNJ', 'PLTR', 'AMD', 'COST', 'ABBV', 'BAC', 'HD', 'PG', 'UNH', 'GE', 'CVX', 'KO', 'IBM', 'CSCO', 'WFC', 'MS', 'GS', 'AXP', 'MU', 'CAT', 'TMUS', 'CRM', 'RTX', 'PM', 'ABT', 'MCD', 'MRK', 'APP', 'TMO', 'PEP', 'LIN', 'DIS', 'QCOM', 'UBER', 'ANET', 'LRCX', 'NOW', 'ISRG', 'INTU', 'BX', 'INTC', 'AMAT', 'T', 'C', 'NEE', 'BLK', 'SCHW', 'BKNG', 'BA', 'APH', 'VZ', 'KLAC', 'TJX', 'GEV', 'AMGN', 'DHR', 'ACN', 'TXN', 'BSX', 'SPGI', 'ADBE', 'GILD', 'PANW', 'ETN', 'SYK', 'COF', 'PFE', 'LOW', 'HON', 'CRWD', 'HOOD', 'UNP', 'DE', 'PGR', 'CEG', 'WELL', 'MDT', 'PLD', 'ADI', 'ADP', 'LMT', 'DASH', 'CB', 'COP', 'HCA', 'KKR', 'DELL', 'CMCSA', 'VRTX', 'MO', 'SO', 'CVS', 'NKE', 'MCK', 'SBUX', 'DUK', 'PH', 'CME', 'CDNS', 'GD', 'TT', 'COIN', 'MMC', 'ICE', 'MMM', 'AMT', 'MCO', 'BMY', 'RCL', 'SNPS', 'WM', 'NEM', 'NOC', 'SHW', 'CI', 'EQIX', 'HWM', 'ORLY', 'MDLZ', 'ECL', 'ABNB', 'GLW', 'TDG', 'ELV', 'CTAS', 'EMR', 'UPS', 'BK', 'USB', 'JCI', 'MSI', 'MAR', 'AON', 'PNC', 'APO', 'ITW', 'AJG', 'WMB', 'TEL', 'RSG', 'FI', 'MNST', 'SPG', 'VST', 'PYPL', 'CSX', 'ADSK', 'PWR', 'ZTS', 'FTNT', 'COR', 'GM', 'WDAY', 'AZO', 'NSC', 'CL', 'AEP', 'DLR', 'HLT', 'SRE', 'REGN', 'TRV', 'MPC', 'FCX', 'AXON', 'FDX', 'EOG', 'KMI', 'CMI', 'AFL', 'URI', 'TFC', 'APD', 'NXPI', 'O', 'CMG', 'DDOG', 'PSX', 'LHX', 'SLB', 'BDX', 'VLO', 'PCAR', 'MPWR', 'PSA', 'F', 'MET', 'ROST', 'WBD', 'D', 'IDXX', 'ALL', 'NDAQ', 'EA', 'ROP', 'CARR', 'STX', 'XYZ', 'FAST', 'EXC', 'GRMN', 'XEL', 'EW', 'DHI', 'CBRE', 'TTWO', 'GWW', 'BKR', 'AMP', 'KR', 'PAYX', 'EBAY', 'TGT', 'AIG', 'OKE', 'ETR', 'WDC', 'CTVA', 'AME', 'CPRT', 'CCI', 'MSCI', 'FANG', 'PEG', 'OXY', 'A', 'ROK', 'FICO', 'LVS', 'KMB', 'KDP', 'YUM', 'DAL', 'CAH', 'CCL', 'VMC', 'RMD', 'CHTR', 'WEC', 'SYY', 'MLM', 'TKO', 'IQV', 'HSY', 'XYL', 'EL', 'ED', 'OTIS', 'PCG', 'PRU', 'GEHC', 'LYV', 'HUM', 'HIG', 'MCHP', 'FIS', 'WAB', 'DD', 'EME', 'EQT', 'NRG', 'CTSH', 'TRGP', 'EXR', 'CSGP', 'NUE', 'STT', 'VICI', 'LEN', 'VTR', 'VRSK', 'RJF', 'UAL', 'ACGL', 'HPE', 'IR', 'WTW', 'IRM', 'IBKR', 'SMCI', 'KHC', 'TSCO', 'ADM', 'DTE', 'MTD', 'BRO', 'KVUE', 'K', 'KEYS', 'ODFL', 'WRB', 'MTB', 'AEE', 'ATO', 'FITB', 'EFX', 'AWK', 'ES', 'PPL', 'DXCM', 'EXPE', 'FOXA', 'ROL', 'BR', 'SYF', 'FE', 'AVB', 'FSLR', 'TTD', 'HPQ', 'CNP', 'VLTO', 'FOX', 'GIS', 'IP', 'CBOE', 'EQR', 'TDY', 'EXE', 'CINF', 'DOV', 'PTC', 'LDOS', 'STZ', 'NTRS', 'PPG', 'TPR', 'STE', 'WSM', 'TER', 'PHM', 'ULTA', 'NTAP', 'STLD', 'HUBB', 'TROW', 'VRSN', 'PODD', 'LH', 'HBAN', 'DG', 'SW', 'JBL', 'HAL', 'CFG', 'CMS', 'BIIB', 'TYL', 'EIX', 'ON', 'LULU', 'RF', 'DRI', 'TPL', 'NVR', 'SBAC', 'GPN', 'WAT', 'DVN', 'CDW', 'CHD', 'L', 'DLTR', 'WST', 'NI', 'RL', 'ZBH', 'CPAY', 'DGX', 'KEY', 'IT', 'TRMB', 'BG', 'J', 'AMCR', 'APTV', 'TSN', 'PKG', 'DOW', 'GPC', 'GDDY', 'INCY', 'PSKY', 'CTRA', 'EVRG', 'MKC', 'SNA', 'PNR', 'INVH', 'PFG', 'LNT', 'LII', 'ESS', 'BBY', 'WY', 'ERIE', 'FTV', 'IFF', 'LUV', 'FFIV', 'GEN', 'HOLX', 'CNC', 'EXPD', 'JBHT', 'MAA', 'ZBRA', 'LYB', 'NWS', 'OMC', 'CHRW', 'KIM', 'NWSA', 'ALLE', 'COO', 'EG', 'MAS', 'TXT', 'CLX', 'AVY', 'CF', 'DPZ', 'UHS', 'BLDR', 'BALL', 'DOC', 'BF.B', 'ARE', 'DECK', 'NDSN', 'REG', 'BXP', 'UDR', 'HRL', 'WYNN', 'IEX', 'SOLV', 'VTRS', 'BEN', 'BAX', 'HII', 'HST', 'JKHY', 'ALB', 'CPT', 'RVTY', 'PAYC', 'SWKS', 'SJM', 'GNRC', 'SWK', 'PNW', 'POOL', 'HAS', 'FDS', 'GL', 'AKAM', 'DAY', 'AIZ', 'NCLH', 'IVZ', 'MRNA', 'AES', 'TECH', 'IPG', 'ALGN', 'AOS', 'CRL', 'MOS', 'CPB', 'LW', 'DVA', 'EPAM', 'MGM', 'TAP', 'CAG', 'FRT', 'APA', 'MOH', 'LKQ', 'MTCH', 'HSIC', 'MHK', 'EMN', 'KMX']
small_cap_tickers = ['MSTR', 'CVNA', 'INSM', 'FIX', 'RKLB', 'SMCI', 'ASTS', 'CRDO', 'BE', 'IONQ', 'SATS', 'FTAI', 'AVAV', 'CRS', 'KTOS', 'FN', 'NXT', 'SMMT', 'APG', 'DUOL', 'JOBY', 'COOP', 'DOC', 'ATI', 'RMBS', 'BBIO', 'MLI', 'STRL', 'CDE', 'COKE', 'SMR', 'DRS', 'HIMS', 'MTSI', 'RVMD', 'ENSG', 'SFM', 'RNA', 'PR', 'IDCC', 'AIT', 'AUR', 'MDGL', 'DDS', 'LUMN', 'APLD', 'WTS', 'SPXC', 'GTLS', 'PSN', 'GH', 'APPF', 'MOD', 'AAON', 'UMBF', 'RIOT', 'HQY', 'HL', 'DY', 'AMKR', 'IESC', 'ONB', 'CIFR', 'FLR', 'ZWS', 'CTRE', 'CVLT', 'AEIS', 'HALO', 'PRIM', 'CORT', 'FSS', 'STEP', 'ELF', 'SOUN', 'IBP', 'RYTM', 'SSD', 'ACHR', 'MARA', 'CYTK', 'SITM', 'SANM', 'NUVL', 'VRNS', 'CADE', 'JXN', 'PI', 'PFSI', 'AXSM', 'CMC', 'EXLS', 'FCFS', 'HLNE', 'LRN', 'ONTO', 'ROAD', 'LEU', 'REZI', 'ORA', 'UEC', 'KNTK', 'LNW', 'TRNO', 'RDNT', 'ITRI', 'VLY', 'BOOT', 'RRR', 'SMTC', 'EPRT', 'TTMI', 'URBN', 'TMHC', 'OPEN', 'ESNT', 'SGHC', 'LTH', 'IRTC', 'SWX', 'PCVX', 'MIR', 'CLSK', 'ESES', 'MC', 'CWST', 'GATX', 'EAT', 'ATGE', 'WULF', 'STNE', 'RHP', 'KRYS', 'ARWR', 'GPI', 'BMI', 'GSAT', 'UFPI', 'HOMB', 'TGTX', 'CHRD', 'PTCT', 'BIPC', 'ACT', 'SR', 'ACIW', 'CRK', 'UBSI', 'GBCI', 'SNEX', 'ABCB', 'POR', 'OSCR', 'MTH', 'UPST', 'WFRD', 'KRG', 'FTDR', 'BCPC', 'OGS', 'WK', 'MTDR', 'ALKS', 'MMSI', 'MMS', 'NPO', 'BCO', 'AUB', 'ACLX', 'BKH', 'GOLF', 'HWC', 'KTB', 'NNI', 'BOX', 'NOVT', 'PPG', 'TPR', 'STE', 'WSM', 'TER', 'PHM', 'ULTA', 'NTAP', 'STLD', 'HUBB', 'TROW', 'VRSN', 'PODD', 'LH', 'HBAN', 'DG', 'SW', 'JBL', 'HAL', 'CFG', 'CMS', 'BIIB', 'TYL', 'EIX', 'ON', 'LULU', 'RF', 'DRI', 'TPL', 'NVR', 'SBAC', 'GPN', 'WAT', 'DVN', 'CDW', 'CHD', 'L', 'DLTR', 'WST', 'NI', 'RL', 'ZBH', 'CPAY', 'DGX', 'KEY', 'IT', 'TRMB', 'BG', 'J', 'AMCR', 'APTV', 'TSN', 'PKG', 'DOW', 'GPC', 'GDDY', 'INCY', 'PSKY', 'CTRA', 'EVRG', 'MKC', 'SNA', 'PNR', 'INVH', 'PFG', 'LNT', 'LII', 'ESS', 'BBY', 'WY', 'ERIE', 'FTV', 'IFF', 'LUV', 'FFIV', 'GEN', 'HOLX', 'CNC', 'EXPD', 'JBHT', 'MAA', 'ZBRA', 'LYB', 'NWS', 'OMC', 'CHRW', 'KIM', 'NWSA', 'ALLE', 'COO', 'EG', 'MAS', 'TXT', 'CLX', 'AVY', 'CF', 'DPZ', 'UHS', 'BLDR', 'BALL', 'DOC', 'BF.B', 'ARE', 'DECK', 'NDSN', 'REG', 'BXP', 'UDR', 'HRL', 'WYNN', 'IEX', 'SOLV', 'VTRS', 'BEN', 'BAX', 'HII', 'HST', 'JKHY', 'ALB', 'CPT', 'RVTY', 'PAYC', 'SWKS', 'SJM', 'GNRC', 'SWK', 'PNW', 'POOL', 'HAS', 'FDS', 'GL', 'AKAM', 'DAY', 'AIZ', 'NCLH', 'IVZ', 'MRNA', 'AES', 'TECH', 'IPG', 'ALGN', 'AOS', 'CRL', 'MOS', 'CPB', 'LW', 'DVA', 'EPAM', 'MGM', 'TAP', 'CAG', 'FRT', 'APA', 'MOH', 'LKQ', 'MTCH', 'HSIC', 'MHK', 'EMN', 'KMX']  # Truncated to partial for manageability

# Note: Small cap list is partial (~200) to keep total seeded ~700; full Russell 2000 is ~2000, too large per user

def batches(l, n):
    for i in range(0, len(l), n):
        yield l[i:i + n]

def seed():
    """
    Seeds the DB with a manageable set of tickers from major indices in batches of 50.
    Only re-fetches if cache >72h old or no data.
    """
    all_tickers = list(set(large_cap_tickers + small_cap_tickers))  # Dedup
    for batch in batches(all_tickers, 50):
        for ticker in batch:
            metrics = get_latest_metrics(ticker)
            if metrics is None:
                # No data, fetch
                metrics = fetch_metrics(ticker)
                if metrics:
                    fetch_id = save_metrics(metrics)
                    processed = process_stock(metrics)
                    save_processed(processed, fetch_id)
            elif (datetime.now() - datetime.fromisoformat(metrics['fetch_timestamp'])) > timedelta(hours=72):
                # Stale, re-fetch
                metrics = fetch_metrics(ticker)
                if metrics:
                    fetch_id = save_metrics(metrics)
                    processed = process_stock(metrics)
                    save_processed(processed, fetch_id)

if __name__ == "__main__":
    seed()