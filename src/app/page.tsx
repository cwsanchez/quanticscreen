'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  TrendingUp,
  BarChart3,
  Zap,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLarge, getFloat } from '@/lib/processor';
import { WatchlistSidebar, PinButton } from '@/components/WatchlistSidebar';
import type { ProcessedResult, PriceHistoryPoint } from '@/types';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

function MiniSparkline({ data }: { data: PriceHistoryPoint[] }) {
  if (!data || data.length < 2) return null;
  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 120;
  const h = 40;
  const points = closes
    .map((c, i) => `${(i / (closes.length - 1)) * w},${h - ((c - min) / range) * h}`)
    .join(' ');
  const isPositive = closes[closes.length - 1] >= closes[0];

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={isPositive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

function StockCard({
  result,
  history,
  onViewFull,
}: {
  result: ProcessedResult;
  history: PriceHistoryPoint[];
  onViewFull: () => void;
}) {
  const m = result.metrics;
  const price = getFloat(m, 'Current Price');
  const high = getFloat(m, '52W High');
  const low = getFloat(m, '52W Low');
  const rangeWidth = high - low > 0 ? ((price - low) / (high - low)) * 100 : 50;

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{m.Ticker}</h3>
              <Badge variant="secondary" className="text-[10px]">
                {result.cap_category}
              </Badge>
              <PinButton symbol={m.Ticker} size="icon" />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {m['Company Name']}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums">
              ${price.toFixed(2)}
            </p>
            <p className="text-sm font-semibold text-primary tabular-nums">
              Score: {result.final_score.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <MiniSparkline data={history} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>${low.toFixed(2)}</span>
            <span>52W Range</span>
            <span>${high.toFixed(2)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(2, Math.min(98, rangeWidth))}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">P/E</span>
            <p className="font-medium tabular-nums">
              {m['P/E'] !== 'N/A' ? Number(m['P/E']).toFixed(1) : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">ROE</span>
            <p className="font-medium tabular-nums">
              {m.ROE !== 'N/A' ? `${Number(m.ROE).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">MC</span>
            <p className="font-medium tabular-nums">
              {m['Market Cap'] !== 'N/A' ? formatLarge(Number(m['Market Cap'])) : '—'}
            </p>
          </div>
        </div>

        {result.flags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {result.flags.map((flag) => (
              <Badge
                key={flag}
                variant={
                  flag === 'Value Trap' || flag === 'Debt Burden' || flag === 'High-Risk Growth'
                    ? 'destructive'
                    : 'success'
                }
                className="text-[10px]"
              >
                {flag}
              </Badge>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-between text-primary"
          onClick={onViewFull}
        >
          Full Report
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStock, setSelectedStock] = useState<{
    processed: ProcessedResult;
    history: PriceHistoryPoint[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const handleSelect = async (symbol: string) => {
    setShowDropdown(false);
    setQuery(symbol);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stocks/fetch?ticker=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStock(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-72 shrink-0 order-2 lg:order-1">
        <div className="lg:sticky lg:top-20">
          <WatchlistSidebar
            onSelectStock={handleSelect}
            selectedSymbol={selectedStock?.processed.metrics.Ticker}
          />
        </div>
      </aside>

      <div className="flex-1 flex flex-col items-center order-1 lg:order-2">
        <div className="mt-4 flex flex-col items-center text-center sm:mt-8">
          <div className="flex items-center gap-2 rounded-full border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Your personal stock research dashboard
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Research stocks
            <br />
            <span className="text-primary">your way</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Multi-factor scoring, smart flag analysis, and custom watchlists.
            Search any ticker to get started.
          </p>
        </div>

        <div ref={searchRef} className="relative mt-8 w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search any stock... (e.g., AAPL, Tesla, Microsoft)"
              className="h-14 rounded-xl border-border/50 bg-card/50 pl-12 pr-4 text-lg backdrop-blur placeholder:text-muted-foreground/50 focus-visible:ring-primary/30"
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-xl">
              {searchResults.map((r) => (
                <button
                  key={r.symbol}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent"
                  onClick={() => handleSelect(r.symbol)}
                >
                  <div>
                    <span className="font-semibold">{r.symbol}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {r.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-8 w-full max-w-md">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="mt-4 h-10 w-full" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedStock && !isLoading && (
          <div className="mt-8 w-full max-w-md">
            <StockCard
              result={selectedStock.processed}
              history={selectedStock.history}
              onViewFull={() =>
                router.push(`/ticker/${selectedStock.processed.metrics.Ticker}`)
              }
            />
          </div>
        )}

        <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: 'Multi-Factor Scoring',
              desc: 'Weighted scoring across 8+ fundamental metrics with customizable normalizers.',
            },
            {
              icon: TrendingUp,
              title: 'Smart Flag Detection',
              desc: '8 analytical flags: Undervalued, Quality Moat, GARP, Momentum Building, and more.',
            },
            {
              icon: Zap,
              title: 'Preset Strategies',
              desc: '5 built-in strategies: Overall, Value, Growth, Momentum, Quality — or create your own.',
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              className="border-border/30 bg-card/30 backdrop-blur transition-all hover:border-border/50"
            >
              <CardContent className="p-6">
                <feature.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-3 font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {feature.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 mb-8 flex gap-3">
          <Button size="lg" onClick={() => router.push('/screener')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Open Screener
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/builder')}>
            Build Custom Strategy
          </Button>
        </div>
      </div>
    </div>
  );
}
