'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, X, ChevronDown, ChevronUp, Loader2, Star, Sparkles } from 'lucide-react';
import type { PriceHistoryPoint, AiReview } from '@/types';

const LOCAL_PINS_KEY = 'qs_local_watchlist';

function getLocalPins(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalPins(pins: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(pins));
  window.dispatchEvent(new Event('watchlist-update'));
}

interface WatchlistStockData {
  symbol: string;
  companyName: string;
  price: number;
  high52: number;
  low52: number;
  sentiment: string | null;
  history: PriceHistoryPoint[];
  aiReview: AiReview | null;
}

function verdictStyle(verdict: string | null | undefined): string {
  const v = (verdict ?? '').toLowerCase();
  if (v.includes('strong buy'))
    return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
  if (v.includes('buy')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (v.includes('strong sell'))
    return 'bg-red-500/15 border-red-500/40 text-red-400';
  if (v.includes('sell')) return 'bg-red-500/10 border-red-500/30 text-red-400';
  return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
}

function sentimentStyle(s: string | null | undefined): string {
  const v = (s ?? '').toLowerCase();
  if (v === 'bullish') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (v === 'bearish') return 'bg-red-500/10 border-red-500/30 text-red-400';
  return 'bg-muted/40 border-border/40 text-muted-foreground';
}

function PriceRangeBar({
  price,
  high,
  low,
}: {
  price: number;
  high: number;
  low: number;
}) {
  if (!Number.isFinite(price) || !Number.isFinite(high) || !Number.isFinite(low) || high <= low) {
    return null;
  }
  const pct = Math.max(2, Math.min(98, ((price - low) / (high - low)) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[9px] leading-none text-muted-foreground">
        <span>${low.toFixed(0)}</span>
        <span className="uppercase tracking-wide">52W</span>
        <span>${high.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-secondary">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-red-500/80 via-amber-500/80 to-emerald-500/80"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-white shadow-sm" />
        </div>
      </div>
    </div>
  );
}

function MiniSparkline({ data }: { data: PriceHistoryPoint[] }) {
  if (!data || data.length < 2) return null;
  const closes = data.slice(-30).map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 70;
  const h = 22;
  const points = closes
    .map((c, i) => `${(i / (closes.length - 1)) * w},${h - ((c - min) / range) * h}`)
    .join(' ');
  const isPositive = closes[closes.length - 1] >= closes[0];

  return (
    <svg width={w} height={h} className="overflow-visible shrink-0">
      <polyline
        fill="none"
        stroke={isPositive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function WatchlistSidebar({
  onSelectStock,
  selectedSymbol,
}: {
  onSelectStock?: (symbol: string) => void;
  selectedSymbol?: string;
}) {
  const router = useRouter();
  const [localPins, setLocalPinsState] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Record<string, WatchlistStockData>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const symbols = localPins;

  const fetchWatchlist = useCallback(() => {
    setLocalPinsState(getLocalPins());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWatchlist();
    const handler = () => fetchWatchlist();
    window.addEventListener('watchlist-update', handler);
    return () => window.removeEventListener('watchlist-update', handler);
  }, [fetchWatchlist]);

  useEffect(() => {
    const fetchAllData = async () => {
      for (const sym of symbols) {
        if (stockData[sym]) continue;
        try {
          const res = await fetch(`/api/stocks/fetch?ticker=${sym}`);
          if (res.ok) {
            const data = await res.json();
            const m = data.processed?.metrics;
            if (m) {
              const price = m['Current Price'] !== 'N/A' ? Number(m['Current Price']) : 0;
              const high52 = m['52W High'] !== 'N/A' ? Number(m['52W High']) : 0;
              const low52 = m['52W Low'] !== 'N/A' ? Number(m['52W Low']) : 0;
              setStockData((prev) => ({
                ...prev,
                [sym]: {
                  symbol: sym,
                  companyName: m['Company Name'] ?? sym,
                  price,
                  high52,
                  low52,
                  sentiment: m.Sentiment && m.Sentiment !== 'N/A' ? String(m.Sentiment) : null,
                  history: data.history ?? [],
                  aiReview: (data.aiReview ?? null) as AiReview | null,
                },
              }));
            }
          }
        } catch { /* ignore */ }
      }
    };
    if (symbols.length > 0) fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  const handleRemove = (symbol: string) => {
    const updated = localPins.filter((s) => s !== symbol);
    setLocalPins(updated);
    setLocalPinsState(updated);
    setStockData((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  const handleClick = (symbol: string) => {
    if (onSelectStock) onSelectStock(symbol);
    else router.push(`/ticker/${symbol}`);
  };

  if (symbols.length === 0 && !loading) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
          <Star className="h-4 w-4 text-primary" />
          My Watchlist
        </div>
        <p className="text-xs text-muted-foreground py-4 text-center">
          Pin stocks to build your watchlist
        </p>
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Pins are saved in your browser
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          <Star className="h-4 w-4 text-primary" />
          My Watchlist
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        <span className="text-xs text-muted-foreground">
          {symbols.length} stock{symbols.length === 1 ? '' : 's'}
        </span>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          ) : (
            symbols.map((sym) => {
              const sd = stockData[sym];
              const isSelected = selectedSymbol === sym;
              return (
                <button
                  key={sym}
                  onClick={() => handleClick(sym)}
                  className={`group flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-accent/50 ${
                    isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{sym}</span>
                        {sd?.aiReview?.verdict && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[9px] font-semibold leading-tight ${verdictStyle(sd.aiReview.verdict)}`}
                            title={`AI verdict · ${sd.aiReview.confidence}% confidence`}
                          >
                            <Sparkles className="h-2 w-2" />
                            {sd.aiReview.verdict}
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {sd?.companyName ?? '...'}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <div className="text-right">
                        {sd ? (
                          <span className="text-sm font-medium tabular-nums">
                            ${sd.price.toFixed(2)}
                          </span>
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleRemove(sym); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </div>
                  </div>

                  {sd && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <PriceRangeBar
                          price={sd.price}
                          high={sd.high52}
                          low={sd.low52}
                        />
                        <MiniSparkline data={sd.history} />
                      </div>

                      {(sd.sentiment || sd.aiReview) && (
                        <div className="flex flex-wrap items-center gap-1">
                          {sd.sentiment && (
                            <span
                              className={`rounded border px-1.5 py-0 text-[9px] font-medium leading-tight ${sentimentStyle(sd.sentiment)}`}
                              title="Analyst sentiment"
                            >
                              {sd.sentiment}
                            </span>
                          )}
                          {sd.aiReview && sd.aiReview.confidence != null && (
                            <span
                              className="rounded border border-border/40 bg-muted/30 px-1.5 py-0 text-[9px] font-medium leading-tight text-muted-foreground"
                              title="AI confidence"
                            >
                              AI {sd.aiReview.confidence}%
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function PinButton({
  symbol,
  size = 'sm',
}: {
  symbol: string;
  size?: 'sm' | 'icon';
}) {
  const [localToggle, setLocalToggle] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = () => setLocalToggle((v) => v + 1);
    window.addEventListener('watchlist-update', handler);
    return () => window.removeEventListener('watchlist-update', handler);
  }, []);

  const isPinned = (() => {
    void localToggle;
    return getLocalPins().includes(symbol);
  })();

  const toggle = () => {
    setLoading(true);
    const pins = getLocalPins();
    if (pins.includes(symbol)) {
      setLocalPins(pins.filter((s) => s !== symbol));
    } else {
      pins.push(symbol);
      setLocalPins(pins);
    }
    setLocalToggle((v) => v + 1);
    setLoading(false);
  };

  if (size === 'icon') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={loading}
        className={`p-1 rounded transition-colors ${
          isPinned ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        }`}
        title={isPinned ? 'Unpin from watchlist' : 'Pin to watchlist'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={isPinned ? 'default' : 'outline'}
      size="sm"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Pin className={`mr-1 h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
      )}
      {isPinned ? 'Pinned' : 'Pin'}
    </Button>
  );
}
