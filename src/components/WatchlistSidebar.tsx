'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, X, ChevronDown, ChevronUp, Loader2, Star, Upload } from 'lucide-react';
import type { PriceHistoryPoint } from '@/types';

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
}

interface WatchlistItem {
  id: string;
  stock_symbol: string;
  sort_order: number;
  added_at: string;
}

interface WatchlistStockData {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  history: PriceHistoryPoint[];
}

function MiniSparkline({ data }: { data: PriceHistoryPoint[] }) {
  if (!data || data.length < 2) return null;
  const closes = data.slice(-30).map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
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

export function SyncPromptBanner() {
  const { showSyncPrompt, syncLocalPinsToAccount, dismissPinSync } = useAuth();

  if (!showSyncPrompt) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <Upload className="mt-0.5 h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Sync local pins?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You have locally pinned stocks. Sync them to your account?
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={syncLocalPinsToAccount}>
              Sync Now
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismissPinSync}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchlistSidebar({
  onSelectStock,
  selectedSymbol,
}: {
  onSelectStock: (symbol: string) => void;
  selectedSymbol?: string;
}) {
  const { user } = useAuth();
  const [dbItems, setDbItems] = useState<WatchlistItem[]>([]);
  const [localPins, setLocalPinsState] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Record<string, WatchlistStockData>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const symbols = user
    ? dbItems.map((i) => i.stock_symbol)
    : localPins;

  const fetchWatchlist = useCallback(async () => {
    if (!user) {
      setLocalPinsState(getLocalPins());
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setDbItems(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel('watchlist-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_watchlists', filter: `user_id=eq.${user.id}` },
        () => { fetchWatchlist(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchWatchlist]);

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
              const high = m['52W High'] !== 'N/A' ? Number(m['52W High']) : 0;
              const pct = high > 0 ? ((price - high) / high) * 100 : 0;
              setStockData((prev) => ({
                ...prev,
                [sym]: {
                  symbol: sym,
                  companyName: m['Company Name'] ?? sym,
                  price,
                  change: 0,
                  changePercent: pct,
                  history: data.history ?? [],
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

  const handleRemove = async (symbol: string) => {
    if (user) {
      await fetch(`/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      setDbItems((prev) => prev.filter((i) => i.stock_symbol !== symbol));
    } else {
      const updated = localPins.filter((s) => s !== symbol);
      setLocalPins(updated);
      setLocalPinsState(updated);
    }
    setStockData((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
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
          {symbols.length} stocks
          {!user && <span className="ml-1 opacity-60">(local)</span>}
        </span>
      </div>

      {!collapsed && (
        <div className="space-y-1">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))
          ) : (
            symbols.map((sym) => {
              const sd = stockData[sym];
              const isSelected = selectedSymbol === sym;
              return (
                <button
                  key={sym}
                  onClick={() => onSelectStock(sym)}
                  className={`group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-accent/50 ${
                    isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{sym}</span>
                      {sd ? (
                        <span className="text-sm font-medium tabular-nums">
                          ${sd.price.toFixed(2)}
                        </span>
                      ) : (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {sd?.companyName ?? '...'}
                      </span>
                      {sd && <MiniSparkline data={sd.history} />}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(sym); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
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
  const { user } = useAuth();
  const [dbPinned, setDbPinned] = useState(false);
  const [localToggle, setLocalToggle] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      fetch('/api/watchlist')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data)) {
            setDbPinned(data.some((i: WatchlistItem) => i.stock_symbol === symbol));
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user, symbol]);

  const isPinned = user ? dbPinned : (() => {
    void localToggle;
    return getLocalPins().includes(symbol);
  })();

  const toggle = async () => {
    setLoading(true);
    if (user) {
      if (dbPinned) {
        await fetch(`/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
        setDbPinned(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        setDbPinned(true);
      }
    } else {
      const pins = getLocalPins();
      if (pins.includes(symbol)) {
        setLocalPins(pins.filter((s) => s !== symbol));
      } else {
        pins.push(symbol);
        setLocalPins(pins);
      }
      setLocalToggle((v) => v + 1);
    }
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
