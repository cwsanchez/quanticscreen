export const DEFAULT_TICKERS = [
  // S&P 500 + top market-cap + frequently searched tickers (~500)
  // Mega-cap tech
  "MSFT","AAPL","AMZN","META","AVGO","GOOGL","TSLA","GOOG","NVDA","BRK-B",
  // Financials & diversified
  "JPM","V","MA","BAC","GS","WFC","MS","SCHW","BLK","AXP",
  "C","BX","COF","ICE","CME","MMC","CB","MCO","PNC","USB",
  "BK","TFC","AIG","MET","PRU","ALL","FITB","HBAN","CFG","KEY",
  "MTB","RJF","STT","SYF","RF","EWBC","IBKR","FCNCA","CMA","WTFC",
  "FNF","EQH","LPLA","ACGL","RNR","WRB","COIN","HOOD","SOFI",
  // Healthcare & pharma
  "LLY","UNH","JNJ","ABBV","MRK","PFE","TMO","ABT","AMGN","GILD",
  "VRTX","MDT","BSX","SYK","DHR","ISRG","REGN","IDXX","EW","ZTS",
  "BDX","A","HCA","CI","ELV","HUM","COR","MCK","CVS","ALNY",
  "DXCM","PODD","MOH","CNC","BIIB","BMRN","INCY","NBIX","EXAS","INSM",
  "MRNA","ALGN","HOLX","BAX","VTRS","MEDP","UHS","THC","DGX","RMD",
  // Tech & software
  "NFLX","ORCL","PLTR","IBM","AMD","CRM","NOW","INTU","CSCO","ADBE",
  "ANET","PANW","CRWD","CDNS","SNPS","SNOW","ADSK","NET","FTNT","DDOG",
  "WDAY","TEAM","ZS","HUBS","VEEV","OKTA","MDB","TWLO","DOCU","PINS",
  "ZM","TTD","BILL","SHOP","SQ","PYPL","DELL","HPE","HPQ","NTAP",
  "KEYS","NTNX","PTC","GWRE","SSNC","FFIV","GDDY","SMCI","PSTG",
  // Semiconductors
  "QCOM","MU","TXN","LRCX","AMAT","KLAC","ADI","MRVL","ON","MCHP",
  "SWKS","QRVO","MPWR","CRDO","LSCC","RMBS","MKSI","COHR",
  // Consumer discretionary & retail
  "HD","COST","WMT","TJX","LOW","NKE","SBUX","MCD","CMG","ORLY",
  "AZO","ROST","BKNG","RCL","MAR","HLT","DPZ","YUM","ABNB","UBER",
  "DASH","LULU","DG","DLTR","TSCO","DKS","BBY","EBAY","FIVE","TPR",
  "DECK","ULTA","WSM","BURL","TGT","KMX","SFM","KR","CPRT",
  // Industrials
  "GE","CAT","RTX","LIN","BA","HON","UNP","ETN","PH","DE",
  "LMT","NOC","GD","TDG","EMR","ITW","CMI","GWW","URI","PWR",
  "CSX","NSC","FDX","UPS","MMM","FAST","PCAR","CARR","FTV","JCI",
  "WAB","OTIS","IR","ROK","XYL","AME","VRSK","WM","RSG","WCN",
  "CPAY","DAL","UAL","LUV","ODFL","JBHT","BLDR","EME","FIX",
  "ACM","J","DOV","RBC","GNRC","AXON","LDOS","CACI","BAH","LHX",
  // Energy
  "XOM","CVX","COP","EOG","SLB","MPC","PSX","VLO","OKE","WMB",
  "KMI","BKR","FANG","TRGP","DVN","OXY","HAL","EQT","CTRA","AR",
  "LNG","APA","OVV","DTM","CF","NEM","FCX","STLD","NUE","CLH",
  // Utilities & infrastructure
  "NEE","DUK","SO","AEP","D","SRE","EXC","XEL","PEG","WEC",
  "ED","ES","DTE","FE","CMS","CNP","NI","LNT","AEE","EVRG",
  "PNW","NRG","CEG","VST","PCG",
  // REITs & real estate
  "PLD","AMT","CCI","EQIX","PSA","SPG","DLR","O","WELL","VTR",
  "VICI","IRM","EXR","AVB","EQR","MAA","ESS","SBAC","INVH","REG",
  "DOC","KIM","UDR","CPT","BXP","SUI","REXR","AMH","LAMR","GLPI",
  // Communication services
  "T","VZ","TMUS","DIS","CMCSA","WBD","CHTR","LYV","EA","TTWO",
  "RBLX","ROKU","SNAP","NWSA","OMC","IPG",
  // Consumer staples
  "PG","KO","PEP","PM","MO","CL","KMB","MDLZ","GIS","KDP",
  "HSY","KHC","SYY","ADM","STZ","MKC","CAG","TSN","SJM","CHD",
  "CLX","MNST","KVUE","USFD","BG","K","CELH",
  // Materials
  "APD","ECL","SHW","PPG","VMC","MLM","DD","DOW","RPM","BALL",
  "PKG","IP","LYB","ALB","AVY","RS","FMC","AWI",
  // High-growth / popular
  "MSTR","CVNA","APP","RKLB","AFRM","DKNG","RIVN","IONQ","OKLO","RGTI",
  "JOBY","GME","ASTS","RDDT","TOST","DUOL","HIMS","PLNT","CIEN",
  "FTAI","W","U","FLUT","GEV","STRL","TLN","CRBG",
  // Other notable
  "APO","KKR","ARES","CG","OWL","EVR","TPL","FICO","MSCI","SPGI",
  "NDAQ","BR","CBOE","FI","FIS","GPN","PAYX","ADP","CTAS","WTW",
  "AON","TRV","CINF","HIG","RGA","GL","AFG","AIZ","BRO","ROP",
  "TYL","MANH","CSGP","TRMB","ENTG","TER","ZBRA","NDSN","IEX","GGG",
  "ITT","FN","PNR","SNA","RRX","DCI","BWA","ALLE","AOS","LECO",
  "CRS","ATI","HWM","CW","KNSL","SEIC","MTD","WAT","ILMN","RVTY",
  "TDY","BLD","MLI","AIT","WSO","CDW","COHR","HUBB","TEL","APH",
  "GLW","MSI","MOD","ALAB",
];
