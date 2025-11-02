import csv

# Read tickers from tickers.csv
tickers = []
with open('tickers.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader)  # Skip header if present
    for row in reader:
        if row:
            tickers.append(row[0].strip())

# Take first 700
top_700 = tickers[:700]

# Write to tickers.py
with open('tickers.py', 'w') as f:
    f.write("# tickers.py\n")
    f.write("# Top 700 tickers from tickers.csv, assuming sorted by market cap\n\n")
    f.write("DEFAULT_TICKERS = [\n")
    for ticker in top_700:
        f.write(f'    "{ticker}",\n')
    f.write("]\n")