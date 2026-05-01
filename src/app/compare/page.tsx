'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Scale,
  Sparkles,
  X,
  TrendingUp,
  Target,
  Shield,
  Zap,
  BarChart3,
  Newspaper,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatLarge,
  getFloat,
  processStock,
  PRESETS,
  DEFAULT_WEIGHTS,
  DEFAULT_METRICS,
} from '@/lib/processor';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NewsHeadlineItem } from '@/components/StockNews';
import type {
  AiReview,
  PriceHistoryPoint,
  ProcessedResult,
  StockMetrics,
  StockNews,
} from '@/types';

// --------------------------------------------------------------------------------------------
// Data types + persistence
// --------------------------------------------------------------------------------------------

interface CompareData {
  symbol: string;
  processed: ProcessedResult | null;
  history: PriceHistoryPoint[];
  aiReview: AiReview | null;
  news: StockNews | null;
  loading: boolean;
  error: string | null;
}

const MAX_COMPARE = 4;
const STORAGE_KEY = 'qs_compare_symbols';

function loadStoredSymbols(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === 'string').slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

function saveStoredSymbols(symbols: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    /* ignore */
  }
}

// --------------------------------------------------------------------------------------------
// Metric row definitions
// --------------------------------------------------------------------------------------------

type MetricFormatter = (metrics: StockMetrics) => string;

interface MetricDef {
  label: string;
  format: MetricFormatter;
  /** Numerical extractor so we can highlight best/worst across the comparison. */
  value?: (metrics: StockMetrics) => number | null;
  /** +1 = higher is better, -1 = lower is better, 0 = no coloring */
  direction?: 1 | -1 | 0;
}

const formatMoney = (v: number) => `$${v.toFixed(2)}`;
const formatNum = (v: number, digits = 2) => v.toFixed(digits);
const formatPct = (v: number) => `${v.toFixed(2)}%`;

const metricDefs: MetricDef[] = [
  {
    label: 'Price',
    format: (m) => (m['Current Price'] !== 'N/A' ? formatMoney(Number(m['Current Price'])) : '—'),
  },
  {
    label: 'Volume',
    format: (m) => (m['Average Volume'] !== 'N/A' ? formatLarge(Number(m['Average Volume'])) : '—'),
  },
  {
    label: 'P/E',
    format: (m) => (m['P/E'] !== 'N/A' ? formatNum(Number(m['P/E']), 1) : '—'),
    value: (m) => (m['P/E'] !== 'N/A' && Number(m['P/E']) > 0 ? Number(m['P/E']) : null),
    direction: -1,
  },
  {
    label: 'Fwd P/E',
    format: (m) => (m['Forward P/E'] !== 'N/A' ? formatNum(Number(m['Forward P/E']), 1) : '—'),
    value: (m) => (m['Forward P/E'] !== 'N/A' && Number(m['Forward P/E']) > 0 ? Number(m['Forward P/E']) : null),
    direction: -1,
  },
  {
    label: 'PEG',
    format: (m) => (m.PEG !== 'N/A' ? formatNum(Number(m.PEG), 2) : '—'),
    value: (m) => (m.PEG !== 'N/A' && Number(m.PEG) > 0 ? Number(m.PEG) : null),
    direction: -1,
  },
  {
    label: 'Revenue Growth',
    format: (m) => (m['Revenue Growth'] !== 'N/A' ? formatPct(Number(m['Revenue Growth'])) : '—'),
    value: (m) => (m['Revenue Growth'] !== 'N/A' ? Number(m['Revenue Growth']) : null),
    direction: 1,
  },
  {
    label: 'Earnings Growth',
    format: (m) => (m['Earnings Growth'] !== 'N/A' ? formatPct(Number(m['Earnings Growth'])) : '—'),
    value: (m) => (m['Earnings Growth'] !== 'N/A' ? Number(m['Earnings Growth']) : null),
    direction: 1,
  },
  {
    label: 'Div Yield',
    format: (m) => (m['Dividend Yield'] !== 'N/A' ? formatPct(Number(m['Dividend Yield'])) : '—'),
    value: (m) => (m['Dividend Yield'] !== 'N/A' ? Number(m['Dividend Yield']) : null),
    direction: 1,
  },
  {
    label: 'Beta',
    format: (m) => (m.Beta !== 'N/A' ? formatNum(Number(m.Beta), 2) : '—'),
  },
  {
    label: 'EV',
    format: (m) => (m.EV !== 'N/A' ? formatLarge(Number(m.EV)) : '—'),
  },
];

// --------------------------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------------------------

function verdictStyle(verdict: string | null | undefined): string {
  const v = (verdict ?? '').toLowerCase();
  if (v.includes('strong buy'))
    return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
  if (v.includes('buy')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (v.includes('strong sell'))
    return 'bg-red-500/15 border-red-500/40 text-red-400';
  if (v.includes('sell')) return 'bg-red-500/10 border-red-500/30 text-red-400';
  if (v.includes('hold')) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  return 'bg-muted/40 border-border/40 text-muted-foreground';
}

function sentimentStyle(s: string | null | undefined): string {
  const v = (s ?? '').toLowerCase();
  if (v === 'bullish') return 'text-emerald-400';
  if (v === 'bearish') return 'text-red-400';
  return 'text-muted-foreground';
}

// --------------------------------------------------------------------------------------------
// Data fetching hook
// --------------------------------------------------------------------------------------------

interface PrimaryBundle {
  processed: ProcessedResult | null;
  history: PriceHistoryPoint[];
  aiReview: AiReview | null;
  error: string | null;
}

async function fetchPrimaryBundle(symbol: string): Promise<PrimaryBundle> {
  const result: PrimaryBundle = {
    processed: null,
    history: [],
    aiReview: null,
    error: null,
  };
  try {
    const res = await fetch(`/api/stocks/fetch?ticker=${symbol}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      result.error = data?.error ?? `Failed to load ${symbol}`;
      return result;
    }
    const data = await res.json();
    result.processed = (data.processed as ProcessedResult) ?? null;
    result.history = (data.history as PriceHistoryPoint[]) ?? [];
    result.aiReview = (data.aiReview as AiReview | null) ?? null;
  } catch {
    result.error = `Network error loading ${symbol}`;
  }
  return result;
}

async function fetchAiReview(symbol: string): Promise<AiReview | null> {
  try {
    const res = await fetch(`/api/ai/review/${symbol}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.review as AiReview | null) ?? null;
  } catch {
    return null;
  }
}

async function fetchNews(symbol: string): Promise<StockNews | null> {
  try {
    const res = await fetch(`/api/ai/news/${symbol}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.news as StockNews | null) ?? null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------------------------

function PriceRangeBar({ price, high, low }: { price: number; high: number; low: number }) {
  if (!Number.isFinite(price) || !Number.isFinite(high) || !Number.isFinite(low) || high <= low) {
    return null;
  }
  const pct = Math.max(2, Math.min(98, ((price - low) / (high - low)) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>${low.toFixed(2)}</span>
        <span className="uppercase tracking-wide">52W</span>
        <span>${high.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-secondary">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute -right-1 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-white" />
        </div>
      </div>
    </div>
  );
}

function FactorScoreTile({
  label,
  score,
  icon: Icon,
  overall,
}: {
  label: string;
  score: number;
  icon: React.ElementType;
  overall?: boolean;
}) {
  const bg = overall
    ? 'border-primary/30 bg-primary/5 text-primary'
    : score >= 20
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : score >= 10
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-border/30 bg-muted/30 text-muted-foreground';
  return (
    <div className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <span className="text-sm font-bold tabular-nums">
        {overall ? score.toFixed(1) : `+${score}`}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Main page component
// --------------------------------------------------------------------------------------------

export default function ComparePage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [dataMap, setDataMap] = useState<Record<string, CompareData>>({});
  const [rankings, setRankings] = useState<Record<string, Record<string, string>>>({});
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = loadStoredSymbols();
    setSymbols(stored);
    setInitialLoaded(true);
  }, []);

  useEffect(() => {
    if (initialLoaded) saveStoredSymbols(symbols);
  }, [symbols, initialLoaded]);

  const addSymbol = useCallback((sym: string) => {
    const upper = sym.toUpperCase();
    setSymbols((prev) => {
      if (prev.includes(upper)) return prev;
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, upper];
    });
  }, []);

  const removeSymbol = useCallback((sym: string) => {
    setSymbols((prev) => prev.filter((s) => s !== sym));
    setDataMap((prev) => {
      const next = { ...prev };
      delete next[sym];
      return next;
    });
    setRankings((prev) => {
      const next = { ...prev };
      delete next[sym];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSymbols([]);
    setDataMap({});
    setRankings({});
  }, []);

  // Fetch primary bundle for any new symbols (quick). News + AI review load in
  // the background afterwards so the page doesn't block waiting on them.
  useEffect(() => {
    let cancelled = false;
    symbols.forEach(async (sym) => {
      if (dataMap[sym]) return;
      setDataMap((prev) => ({
        ...prev,
        [sym]: {
          symbol: sym,
          processed: null,
          history: [],
          aiReview: null,
          news: null,
          loading: true,
          error: null,
        },
      }));

      const primary = await fetchPrimaryBundle(sym);
      if (cancelled) return;

      setDataMap((prev) => ({
        ...prev,
        [sym]: {
          symbol: sym,
          processed: primary.processed,
          history: primary.history,
          aiReview: primary.aiReview,
          news: null,
          loading: false,
          error: primary.error,
        },
      }));

      // Kick off secondary loaders in parallel.
      if (!primary.error) {
        if (!primary.aiReview) {
          fetchAiReview(sym).then((review) => {
            if (cancelled || !review) return;
            setDataMap((prev) =>
              prev[sym]
                ? { ...prev, [sym]: { ...prev[sym]!, aiReview: review } }
                : prev
            );
          });
        }
        fetchNews(sym).then((news) => {
          if (cancelled || !news) return;
          setDataMap((prev) =>
            prev[sym] ? { ...prev, [sym]: { ...prev[sym]!, news } } : prev
          );
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  // Compute rankings for loaded stocks.
  const loadedSymbols = useMemo(
    () =>
      symbols.filter((s) => dataMap[s] && !dataMap[s].loading && dataMap[s].processed),
    [symbols, dataMap]
  );

  useEffect(() => {
    if (loadedSymbols.length === 0) return;
    let cancelled = false;
    setRankingsLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/stocks/process?preset=Overall');
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: ProcessedResult[] };
        if (cancelled) return;
        const next: Record<string, Record<string, string>> = {};
        for (const sym of loadedSymbols) {
          const entry = dataMap[sym];
          if (!entry?.processed) continue;
          const targetCap = entry.processed.cap_category;
          const targetSector = entry.processed.metrics.Sector ?? 'N/A';
          const capHeader = targetCap !== 'N/A' ? targetCap : 'Unknown';
          const sectorHeader = targetSector !== 'N/A' ? targetSector : 'Unknown';
          const stockRanks: Record<string, string> = {};
          for (const preset of ['Value', 'Growth', 'Momentum', 'Quality'] as const) {
            const logic = PRESETS[preset];
            const processed = results.map((r) =>
              processStock(r.metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic)
            );
            processed.sort((a, b) => b.final_score - a.final_score);
            const rankAll = processed.findIndex((p) => p.metrics.Ticker === sym) + 1;
            stockRanks[`${preset}_All`] = rankAll > 0 ? `${rankAll}/${processed.length}` : 'N/A';
            const filteredCap = processed.filter((p) => p.cap_category === targetCap);
            if (filteredCap.length > 0) {
              const rankCap = filteredCap.findIndex((p) => p.metrics.Ticker === sym) + 1;
              stockRanks[`${preset}_${capHeader}`] =
                rankCap > 0 ? `${rankCap}/${filteredCap.length}` : 'N/A';
            }
            const filteredSector = processed.filter((p) => p.metrics.Sector === targetSector);
            if (filteredSector.length > 0) {
              const rankSector =
                filteredSector.findIndex((p) => p.metrics.Ticker === sym) + 1;
              stockRanks[`${preset}_${sectorHeader}`] =
                rankSector > 0 ? `${rankSector}/${filteredSector.length}` : 'N/A';
            }
          }
          next[sym] = stockRanks;
        }
        if (!cancelled) setRankings(next);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setRankingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSymbols.join(',')]);

  // ------------------------------------------------------------------------
  // Render helpers per-row (metrics) that know about highlighting best/worst
  // ------------------------------------------------------------------------
  const comparisonCols = symbols; // includes placeholders up to MAX_COMPARE

  const gridColsClass = (() => {
    const count = Math.max(1, comparisonCols.length);
    if (count === 1) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  })();

  // ------------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------------
  if (symbols.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Stock Comparison</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Line up 2 – {MAX_COMPARE} stocks side by side to compare price, factor scores,
            AI verdicts, flags, and recent news.
          </p>
        </div>
        <Card className="border-border/30 bg-card/30">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-medium">Add your first stock</p>
            <GlobalSearch
              variant="hero"
              placeholder="Search any stock... (e.g., AAPL, Tesla)"
              onSelect={addSymbol}
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Quick picks:
              {['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'].map((s) => (
                <button
                  key={s}
                  onClick={() => addSymbol(s)}
                  className="rounded-full border border-border/40 bg-card/40 px-2.5 py-1 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Main compare layout
  // ------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="sticky top-14 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur-xl border-b border-border/30 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Stock Comparison</h1>
              <p className="text-xs text-muted-foreground">
                {symbols.length}/{MAX_COMPARE} selected · Data cached for 24h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-64 max-w-full">
              <GlobalSearch
                variant="navbar"
                placeholder={
                  symbols.length >= MAX_COMPARE ? 'Maximum reached' : 'Add another ticker...'
                }
                onSelect={(s) => {
                  if (symbols.length < MAX_COMPARE) addSymbol(s);
                }}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              <X className="mr-1 h-3 w-3" /> Clear all
            </Button>
          </div>
        </div>
      </div>

      {/* Column header row */}
      <div className={`grid gap-4 ${gridColsClass}`}>
        {comparisonCols.map((sym) => {
          const d = dataMap[sym];
          if (!d || d.loading) {
            return (
              <Card key={sym} className="border-border/30 bg-card/30">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            );
          }
          if (d.error || !d.processed) {
            return (
              <Card key={sym} className="border-red-500/30 bg-red-500/5">
                <CardContent className="space-y-3 p-4 text-center">
                  <AlertCircle className="mx-auto h-6 w-6 text-red-400" />
                  <p className="text-sm font-medium">{sym}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.error ?? 'Could not load data'}
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => removeSymbol(sym)}>
                    Remove
                  </Button>
                </CardContent>
              </Card>
            );
          }
          const m = d.processed.metrics;
          const price = getFloat(m, 'Current Price');
          const high52 = getFloat(m, '52W High');
          const low52 = getFloat(m, '52W Low');
          return (
            <Card key={sym} className="border-border/30 bg-card/30">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/ticker/${sym}`}
                        className="text-lg font-bold tracking-tight hover:text-primary"
                      >
                        {sym}
                      </a>
                      <Badge variant="secondary" className="text-[10px]">
                        {d.processed.cap_category}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m['Company Name']}
                    </p>
                    {m.Sector !== 'N/A' && (
                      <p className="truncate text-[10px] text-muted-foreground/70">
                        {m.Sector}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeSymbol(sym)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <p className="text-2xl font-bold tabular-nums">${price.toFixed(2)}</p>
                  {high52 > 0 && (
                    <p
                      className={`text-xs font-medium ${
                        price >= high52 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {((price - high52) / high52 * 100).toFixed(2)}% from 52w high
                    </p>
                  )}
                </div>

                <PriceRangeBar price={price} high={high52} low={low52} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analyst Summary */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Analyst Summary</CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-4 ${gridColsClass}`}>
          {symbols.map((sym) => {
            const d = dataMap[sym];
            if (!d || d.loading) return <Skeleton key={sym} className="h-24 w-full" />;
            if (!d.processed) return <div key={sym} className="text-xs text-muted-foreground">—</div>;
            const m = d.processed.metrics;
            const price = getFloat(m, 'Current Price');
            const target = m['Target Price'] !== 'N/A' ? Number(m['Target Price']) : null;
            const upside = target && price > 0 ? ((target - price) / price) * 100 : null;
            return (
              <div key={sym} className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sym}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                    <p className="text-xs font-bold uppercase">
                      {m['Analyst Rating'] !== 'N/A' ? String(m['Analyst Rating']) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Sentiment</p>
                    <p className={`text-xs font-bold ${sentimentStyle(m.Sentiment)}`}>
                      {m.Sentiment !== 'N/A' ? m.Sentiment : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Target</p>
                    <p className="text-xs font-bold tabular-nums">
                      {target ? `$${target.toFixed(2)}` : '—'}
                    </p>
                    {upside !== null && (
                      <p
                        className={`text-[10px] ${
                          upside > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {upside.toFixed(1)}% upside
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* xAI Grok Analysis */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> xAI Grok Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid gap-3 ${gridColsClass}`}>
            {symbols.map((sym) => {
              const d = dataMap[sym];
              if (!d || d.loading)
                return <Skeleton key={sym} className="h-24 w-full" />;
              const r = d.aiReview;
              return (
                <div
                  key={sym}
                  className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {sym}
                  </p>
                  {r ? (
                    <>
                      <div
                        className={`rounded-md border px-2 py-1 text-xs font-bold text-center ${verdictStyle(r.verdict)}`}
                      >
                        {r.verdict}
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Confidence</span>
                          <span className="tabular-nums font-semibold text-foreground">
                            {r.confidence}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(0, Math.min(100, r.confidence))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No AI review yet.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sentiment side-by-side rows */}
          <SentimentRow
            title="Institutional Sentiment"
            symbols={symbols}
            dataMap={dataMap}
            field="institutional_sentiment"
            gridColsClass={gridColsClass}
          />
          <SentimentRow
            title="Retail Sentiment"
            symbols={symbols}
            dataMap={dataMap}
            field="retail_sentiment"
            gridColsClass={gridColsClass}
          />
        </CardContent>
      </Card>

      {/* Primary metrics */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Primary Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-card/40">
                  <th className="w-32 px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Metric
                  </th>
                  {symbols.map((sym) => (
                    <th
                      key={sym}
                      className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider"
                    >
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricDefs.map((def) => {
                  // Compute best/worst for highlight
                  const values: Array<{ sym: string; v: number | null }> = symbols.map((sym) => ({
                    sym,
                    v: dataMap[sym]?.processed
                      ? (def.value ? def.value(dataMap[sym]!.processed!.metrics) : null)
                      : null,
                  }));
                  const numericVals = values.filter((x) => x.v !== null) as Array<{ sym: string; v: number }>;
                  let bestSym: string | null = null;
                  let worstSym: string | null = null;
                  if (def.direction && numericVals.length >= 2) {
                    if (def.direction > 0) {
                      bestSym = numericVals.reduce((a, b) => (b.v > a.v ? b : a)).sym;
                      worstSym = numericVals.reduce((a, b) => (b.v < a.v ? b : a)).sym;
                    } else if (def.direction < 0) {
                      bestSym = numericVals.reduce((a, b) => (b.v < a.v ? b : a)).sym;
                      worstSym = numericVals.reduce((a, b) => (b.v > a.v ? b : a)).sym;
                    }
                  }
                  return (
                    <tr key={def.label} className="border-b border-border/20">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{def.label}</td>
                      {symbols.map((sym) => {
                        const d = dataMap[sym];
                        const formatted = d?.processed ? def.format(d.processed.metrics) : '—';
                        const highlight =
                          bestSym === sym
                            ? 'text-emerald-400 font-semibold'
                            : worstSym === sym && bestSym !== worstSym
                              ? 'text-red-400'
                              : '';
                        return (
                          <td
                            key={sym}
                            className={`px-4 py-2 text-right text-sm tabular-nums ${highlight}`}
                          >
                            {d?.loading ? <Skeleton className="ml-auto h-4 w-14" /> : formatted}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Factor Scores */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Factor Scores</CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-3 ${gridColsClass}`}>
          {symbols.map((sym) => {
            const d = dataMap[sym];
            if (!d || d.loading) return <Skeleton key={sym} className="h-40 w-full" />;
            const p = d.processed;
            if (!p)
              return (
                <p key={sym} className="text-xs text-muted-foreground">
                  —
                </p>
              );
            return (
              <div
                key={sym}
                className="space-y-1.5 rounded-lg border border-border/30 bg-card/40 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sym}
                </p>
                <FactorScoreTile
                  label="Overall"
                  score={p.final_score}
                  icon={BarChart3}
                  overall
                />
                <FactorScoreTile
                  label="Value"
                  score={p.factor_boosts.value}
                  icon={Target}
                />
                <FactorScoreTile
                  label="Growth"
                  score={p.factor_boosts.growth}
                  icon={Zap}
                />
                <FactorScoreTile
                  label="Momentum"
                  score={p.factor_boosts.momentum}
                  icon={TrendingUp}
                />
                <FactorScoreTile
                  label="Quality"
                  score={p.factor_boosts.quality}
                  icon={Shield}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rankings */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Rankings
            {rankingsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-4 ${gridColsClass}`}>
          {symbols.map((sym) => {
            const d = dataMap[sym];
            const ranks = rankings[sym];
            if (!d || d.loading)
              return <Skeleton key={sym} className="h-40 w-full" />;
            if (!ranks)
              return (
                <div
                  key={sym}
                  className="rounded-lg border border-border/30 bg-card/40 p-3 text-[11px] text-muted-foreground"
                >
                  <p className="mb-2 font-semibold uppercase tracking-wider">{sym}</p>
                  {rankingsLoading ? 'Loading rankings…' : 'Not enough data to rank'}
                </div>
              );
            const presets = ['Value', 'Growth', 'Momentum', 'Quality'] as const;
            const categories = Array.from(
              new Set(
                Object.keys(ranks).map((k) => k.split('_').slice(1).join('_'))
              )
            );
            return (
              <div
                key={sym}
                className="rounded-lg border border-border/30 bg-card/40 p-3"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sym}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="pb-1 text-left font-medium text-muted-foreground">
                          Preset
                        </th>
                        {categories.map((c) => (
                          <th
                            key={c}
                            className="pb-1 text-center font-medium text-muted-foreground"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {presets.map((preset) => (
                        <tr key={preset} className="border-b border-border/20">
                          <td className="py-1 font-medium">{preset}</td>
                          {categories.map((cat) => (
                            <td
                              key={cat}
                              className="py-1 text-center tabular-nums"
                            >
                              {ranks[`${preset}_${cat}`] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* News summaries & headlines */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" /> Recent News
            <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Last 30 days
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid gap-3 ${gridColsClass}`}>
            {symbols.map((sym) => {
              const d = dataMap[sym];
              if (!d || d.loading)
                return <Skeleton key={sym} className="h-24 w-full" />;
              const hasNews = d.news !== null;
              return (
                <div
                  key={sym}
                  className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {sym} · Summary
                  </p>
                  {hasNews ? (
                    <p className="text-xs leading-relaxed text-foreground/90 line-clamp-6">
                      {d.news?.summary || 'No recent news summary available.'}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching recent news…
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`grid gap-3 ${gridColsClass}`}>
            {symbols.map((sym) => {
              const d = dataMap[sym];
              if (!d || d.loading)
                return <Skeleton key={sym} className="h-24 w-full" />;
              const hasNews = d.news !== null;
              const headlines = d.news?.headlines ?? [];
              return (
                <div
                  key={sym}
                  className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {sym} · Top Headlines
                    </p>
                    <a
                      href={`/ticker/${sym}`}
                      className="text-[10px] text-primary hover:underline"
                    >
                      View stock
                    </a>
                  </div>
                  {!hasNews ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : headlines.length > 0 ? (
                    <div className="space-y-1.5">
                      {headlines.slice(0, 3).map((h) => (
                        <NewsHeadlineItem key={h.url} h={h} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No headlines found.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// SentimentRow: side-by-side institutional / retail sentiment snippet
// --------------------------------------------------------------------------------------------

function SentimentRow({
  title,
  symbols,
  dataMap,
  field,
  gridColsClass,
}: {
  title: string;
  symbols: string[];
  dataMap: Record<string, CompareData>;
  field: 'institutional_sentiment' | 'retail_sentiment';
  gridColsClass: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className={`grid gap-3 ${gridColsClass}`}>
        {symbols.map((sym) => {
          const d = dataMap[sym];
          if (!d || d.loading) return <Skeleton key={sym} className="h-24 w-full" />;
          const text = d.aiReview?.[field];
          return (
            <div
              key={sym}
              className="rounded-lg border border-border/30 bg-card/40 p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {sym}
              </p>
              <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line line-clamp-6">
                {text || '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
