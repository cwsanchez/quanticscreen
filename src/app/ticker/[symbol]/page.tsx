'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Shield,
  Zap,
  Target,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  processStock,
  getFloat,
  formatLarge,
  PRESETS,
  DEFAULT_WEIGHTS,
  DEFAULT_METRICS,
  NEGATIVE_FLAGS,
} from '@/lib/processor';
import { PinButton } from '@/components/WatchlistSidebar';
import type { ProcessedResult, PriceHistoryPoint, StockMetrics } from '@/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function MetricRow({ label, value, suffix = '' }: { label: string; value: string | number | 'N/A'; suffix?: string }) {
  const display = value === 'N/A' || value === null || value === undefined
    ? '—'
    : typeof value === 'number'
      ? `${value.toFixed(2)}${suffix}`
      : `${value}${suffix}`;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{display}</span>
    </div>
  );
}

function PriceChart({ data }: { data: PriceHistoryPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">No price data available</div>;
  }

  const isPositive = data[data.length - 1].close >= data[0].close;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
            <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => `$${v}`}
          domain={['auto', 'auto']}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Price']}
          labelFormatter={(l) => new Date(l).toLocaleDateString()}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          fillOpacity={1}
          fill="url(#colorPrice)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RankingsGrid({ rankings }: { rankings: Record<string, string> }) {
  const presets = ['Value', 'Growth', 'Momentum', 'Quality'];
  const categories = Object.keys(
    Object.fromEntries(
      Object.keys(rankings)
        .map((k) => {
          const parts = k.split('_');
          return parts.slice(1).join('_');
        })
        .filter(Boolean)
        .map((c) => [c, true])
    )
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="pb-2 text-left font-medium text-muted-foreground">Preset</th>
            {categories.map((c) => (
              <th key={c} className="pb-2 text-center font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr key={preset} className="border-b border-border/30">
              <td className="py-2 font-medium">{preset}</td>
              {categories.map((cat) => (
                <td key={cat} className="py-2 text-center tabular-nums">
                  {rankings[`${preset}_${cat}`] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorBoostCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const color = value >= 20 ? 'text-emerald-400' : value >= 10 ? 'text-amber-400' : 'text-muted-foreground';
  return (
    <Card className="border-border/30 bg-card/50">
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold tabular-nums ${color}`}>+{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ processed: ProcessedResult; history: PriceHistoryPoint[] } | null>(null);
  const [rankings, setRankings] = useState<Record<string, string>>({});
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/stocks/fetch?ticker=${symbol}${force ? '&refresh=true' : ''}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const computeRankings = async () => {
    if (!data) return;
    setRankingsLoading(true);
    try {
      const res = await fetch('/api/stocks/process?preset=Overall');
      if (!res.ok) return;
      const { results } = (await res.json()) as { results: ProcessedResult[] };

      const m = data.processed.metrics;
      const targetCap = data.processed.cap_category;
      const targetSector = m.Sector ?? 'N/A';
      const capHeader = targetCap !== 'N/A' ? targetCap : 'Unknown';
      const sectorHeader = targetSector !== 'N/A' ? targetSector : 'Unknown';

      const newRankings: Record<string, string> = {};

      for (const preset of ['Value', 'Growth', 'Momentum', 'Quality'] as const) {
        const logic = PRESETS[preset];
        const processed = results.map((r) =>
          processStock(r.metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic)
        );
        processed.sort((a, b) => b.final_score - a.final_score);

        const rankAll = processed.findIndex((p) => p.metrics.Ticker === symbol) + 1;
        newRankings[`${preset}_All`] = rankAll > 0 ? `${rankAll}/${processed.length}` : 'N/A';

        const filteredCap = processed.filter((p) => p.cap_category === targetCap);
        if (filteredCap.length > 0) {
          const rankCap = filteredCap.findIndex((p) => p.metrics.Ticker === symbol) + 1;
          newRankings[`${preset}_${capHeader}`] = rankCap > 0 ? `${rankCap}/${filteredCap.length}` : 'N/A';
        }

        const filteredSector = processed.filter((p) => p.metrics.Sector === targetSector);
        if (filteredSector.length > 0) {
          const rankSector = filteredSector.findIndex((p) => p.metrics.Ticker === symbol) + 1;
          newRankings[`${preset}_${sectorHeader}`] = rankSector > 0 ? `${rankSector}/${filteredSector.length}` : 'N/A';
        }
      }

      setRankings(newRankings);
    } catch {
      // ignore
    } finally {
      setRankingsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (data) computeRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Could not load data for {symbol}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const { processed, history } = data;
  const m = processed.metrics;
  const price = getFloat(m, 'Current Price');
  const high = getFloat(m, '52W High');
  const low = getFloat(m, '52W Low');
  const rangeWidth = high - low > 0 ? ((price - low) / (high - low)) * 100 : 50;

  const largeMetrics = ['Market Cap', 'EV', 'Total Cash', 'Total Debt', 'FCF Actual', 'EBITDA Actual', 'Average Volume'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{m.Ticker}</h1>
              <Badge variant="secondary">{processed.cap_category}</Badge>
              {m.Sector !== 'N/A' && <Badge variant="outline">{m.Sector}</Badge>}
              <PinButton symbol={m.Ticker} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground">{m['Company Name']}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-2xl font-bold tabular-nums">${price.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {processed.final_score.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Base: {processed.base_score.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sentiment</p>
            <p className={`text-lg font-bold ${m.Sentiment === 'Bullish' ? 'text-emerald-400' : m.Sentiment === 'Bearish' ? 'text-red-400' : 'text-muted-foreground'}`}>
              {m.Sentiment !== 'N/A' ? m.Sentiment : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {m['Analyst Rating'] !== 'N/A' ? String(m['Analyst Rating']).toUpperCase() : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="text-lg font-bold tabular-nums">
              {m['Target Price'] !== 'N/A' ? `$${Number(m['Target Price']).toFixed(2)}` : '—'}
            </p>
            {m['Target Price'] !== 'N/A' && price > 0 && (
              <p className={`text-xs ${Number(m['Target Price']) > price ? 'text-emerald-400' : 'text-red-400'}`}>
                {((Number(m['Target Price']) - price) / price * 100).toFixed(1)}% upside
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>${low.toFixed(2)}</span>
          <span>52-Week Range</span>
          <span>${high.toFixed(2)}</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-secondary">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
            style={{ width: `${Math.max(2, Math.min(98, rangeWidth))}%` }}
          >
            <div className="absolute -right-1 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-white" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <FactorBoostCard label="Value" value={processed.factor_boosts.value} icon={Target} />
        <FactorBoostCard label="Momentum" value={processed.factor_boosts.momentum} icon={TrendingUp} />
        <FactorBoostCard label="Quality" value={processed.factor_boosts.quality} icon={Shield} />
        <FactorBoostCard label="Growth" value={processed.factor_boosts.growth} icon={Zap} />
      </div>

      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="chart">Price Chart</TabsTrigger>
          <TabsTrigger value="metrics">All Metrics</TabsTrigger>
          <TabsTrigger value="flags">Flags & Analysis</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <PriceChart data={history} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card className="border-border/30 bg-card/50">
            <CardContent className="p-4">
              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold">Valuation</h3>
                  <MetricRow label="P/E Ratio" value={m['P/E']} />
                  <MetricRow label="Forward P/E" value={m['Forward P/E']} />
                  <MetricRow label="P/B Ratio" value={m['P/B']} />
                  <MetricRow label="PEG Ratio" value={m.PEG} />
                  <MetricRow label="P/FCF" value={m['P/FCF']} />
                  <MetricRow label="EV" value={m.EV !== 'N/A' ? formatLarge(Number(m.EV)) : 'N/A'} />
                  <MetricRow label="Market Cap" value={m['Market Cap'] !== 'N/A' ? formatLarge(Number(m['Market Cap'])) : 'N/A'} />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Profitability</h3>
                  <MetricRow label="ROE" value={m.ROE} suffix="%" />
                  <MetricRow label="Gross Margin" value={m['Gross Margin']} suffix="%" />
                  <MetricRow label="Net Profit Margin" value={m['Net Profit Margin']} suffix="%" />
                  <MetricRow label="FCF/EV" value={m['FCF % EV TTM']} suffix="%" />
                  <MetricRow label="EBITDA/EV" value={m['EBITDA % EV TTM']} suffix="%" />
                </div>
                <div className="mt-4">
                  <h3 className="mb-2 font-semibold">Balance Sheet</h3>
                  <MetricRow label="D/E Ratio" value={m['D/E']} />
                  <MetricRow label="Total Cash" value={m['Total Cash'] !== 'N/A' ? formatLarge(Number(m['Total Cash'])) : 'N/A'} />
                  <MetricRow label="Total Debt" value={m['Total Debt'] !== 'N/A' ? formatLarge(Number(m['Total Debt'])) : 'N/A'} />
                  <MetricRow label="FCF" value={m['FCF Actual'] !== 'N/A' ? formatLarge(Number(m['FCF Actual'])) : 'N/A'} />
                  <MetricRow label="EBITDA" value={m['EBITDA Actual'] !== 'N/A' ? formatLarge(Number(m['EBITDA Actual'])) : 'N/A'} />
                </div>
                <div className="mt-4">
                  <h3 className="mb-2 font-semibold">Growth & Technical</h3>
                  <MetricRow label="Revenue Growth" value={m['Revenue Growth']} suffix="%" />
                  <MetricRow label="Earnings Growth" value={m['Earnings Growth']} suffix="%" />
                  <MetricRow label="Beta" value={m.Beta} />
                  <MetricRow label="Dividend Yield" value={m['Dividend Yield']} suffix="%" />
                  <MetricRow label="RSI" value={m.RSI} />
                  <MetricRow label="Avg Volume" value={m['Average Volume'] !== 'N/A' ? formatLarge(Number(m['Average Volume'])) : 'N/A'} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Positives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {processed.positives.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-border/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{processed.risks}</p>
              </CardContent>
            </Card>
          </div>

          {processed.flags.length > 0 && (
            <Card className="mt-4 border-border/30 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Active Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {processed.flags.map((flag) => (
                    <Badge
                      key={flag}
                      variant={NEGATIVE_FLAGS.has(flag) ? 'destructive' : 'success'}
                      className="text-sm"
                    >
                      {flag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rankings">
          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Rankings by Preset Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              {rankingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : Object.keys(rankings).length > 0 ? (
                <RankingsGrid rankings={rankings} />
              ) : (
                <p className="text-sm text-muted-foreground">No ranking data available. Add more stocks to the database to see rankings.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
