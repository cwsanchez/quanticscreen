import csv

# Read tickers from tickers.csv
tickers = []
with open('tickers.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader)  # Skip header if present
    for row in reader:
        if row:
            tickers.append(row[0].strip())

# Take first 300
top_300 = tickers[:300]

# Write to tickers.py
with open('tickers.py', 'w') as f:
    f.write("# tickers.py\n")
    f.write("# Top 300 tickers from tickers.csv, assuming sorted by market cap\n\n")
    f.write("DEFAULT_TICKERS = [\n")
    for ticker in top_300:
        f.write(f'    "{ticker}",\n')
    f.write("]\n")