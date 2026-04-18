'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Target,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  Building2,
  Users,
  Gauge,
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
import type { ProcessedResult, PriceHistoryPoint, AiReview } from '@/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const TIME_RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'Max'] as const;
type TimeRange = typeof TIME_RANGES[number];

function filterDataByRange(data: PriceHistoryPoint[], range: TimeRange): PriceHistoryPoint[] {
  if (!data || data.length === 0) return [];
  if (range === 'Max') return data;
  const now = new Date();
  const cutoff = new Date();
  switch (range) {
    case '1M': cutoff.setMonth(now.getMonth() - 1); break;
    case '3M': cutoff.setMonth(now.getMonth() - 3); break;
    case '6M': cutoff.setMonth(now.getMonth() - 6); break;
    case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
    case '5Y': cutoff.setFullYear(now.getFullYear() - 5); break;
  }
  const filtered = data.filter((d) => new Date(d.date) >= cutoff);
  return filtered.length > 0 ? filtered : data;
}

function PriceChart({ data, range }: { data: PriceHistoryPoint[]; range: TimeRange }) {
  const filtered = useMemo(() => filterDataByRange(data, range), [data, range]);
  if (!filtered || filtered.length === 0) {
    return <div className="flex h-80 items-center justify-center text-muted-foreground">No price data available</div>;
  }
  const isPositive = filtered[filtered.length - 1].close >= filtered[0].close;
  const color = isPositive ? '#22c55e' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height={380}>
      <AreaChart data={filtered} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          interval="preserveStartEnd"
          minTickGap={60}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => `$${v}`}
          domain={['auto', 'auto']}
          width={55}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Price']}
          labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={color}
          fillOpacity={1}
          fill="url(#chartGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/30 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ScoreBadge({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const bg = score >= 20 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : score >= 10 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : 'bg-muted/50 border-border/30 text-muted-foreground';

  return (
    <div className={`flex flex-col items-center rounded-xl border p-4 ${bg}`}>
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-2xl font-bold tabular-nums">+{score}</span>
      <span className="text-xs font-medium mt-1">{label}</span>
    </div>
  );
}

function MetricRow({ label, value, suffix = '' }: { label: string; value: string | number | 'N/A'; suffix?: string }) {
  const display = value === 'N/A' || value === null || value === undefined
    ? '—'
    : typeof value === 'number'
      ? `${value.toFixed(2)}${suffix}`
      : `${value}${suffix}`;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">{display}</span>
    </div>
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
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30">
            <th className="pb-2 text-left font-medium text-muted-foreground">Preset</th>
            {categories.map((c) => (
              <th key={c} className="pb-2 text-center font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr key={preset} className="border-b border-border/20">
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

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const deltaMs = Date.now() - then;
  const mins = Math.round(deltaMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

function verdictStyle(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v.includes('strong buy')) return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
  if (v.includes('buy')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (v.includes('strong sell')) return 'bg-red-500/15 border-red-500/40 text-red-400';
  if (v.includes('sell')) return 'bg-red-500/10 border-red-500/30 text-red-400';
  return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
}

function AiSnapshot({ symbol, onViewFull }: { symbol: string; onViewFull: () => void }) {
  const [review, setReview] = useState<AiReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ai/review/${symbol}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? 'Failed to load AI analysis');
          setReview(null);
        } else {
          setReview(data.review as AiReview);
        }
      } catch {
        if (!cancelled) setError('Network error while loading AI analysis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !review) {
    const missingKey = error ? /XAI_API_KEY|missing_api_key/i.test(error) : false;
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  xAI Grok Analysis
                </p>
                <p className="text-xs text-muted-foreground">
                  {missingKey
                    ? 'Set XAI_API_KEY to enable AI analysis.'
                    : review === null && !error
                      ? 'No AI analysis yet.'
                      : 'AI analysis unavailable.'}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onViewFull}>
              Full Summary
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 bg-gradient-to-br from-primary/5 via-card/30 to-card/30">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                xAI Grok Analysis
              </p>
              <p className="text-xs text-muted-foreground">
                Last generated: {formatRelativeTime(review.generated_at)}
                {review.model ? ` · ${review.model}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${verdictStyle(review.verdict)}`}>
              {review.verdict}
            </div>
            <div className="text-xs text-muted-foreground">
              Confidence
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, review.confidence))}%` }}
                  />
                </div>
                <span className="font-semibold text-foreground tabular-nums">{review.confidence}%</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onViewFull}>
              Full Summary
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AiAnalysisPanel({ symbol }: { symbol: string }) {
  const [review, setReview] = useState<AiReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (force) setGenerating(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/review/${symbol}${force ? '?refresh=true' : ''}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to load AI analysis');
        setReview(null);
      } else {
        setReview(data.review as AiReview);
      }
    } catch {
      setError('Network error while loading AI analysis');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    const missingKey = /XAI_API_KEY|missing_api_key/i.test(error);
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-6 text-center space-y-3">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-medium">AI analysis unavailable</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {missingKey
              ? 'Set the XAI_API_KEY environment variable to enable AI-generated company analysis powered by xAI Grok.'
              : error}
          </p>
          {!missingKey && (
            <Button size="sm" variant="outline" onClick={() => load(true)} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!review) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No AI analysis yet.
          <div className="mt-3">
            <Button size="sm" onClick={() => load(true)} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const km = (review.key_metrics ?? {}) as Record<string, unknown>;
  const scoreKeys: Array<[string, string]> = [
    ['overall_score', 'Overall'],
    ['value_score', 'Value'],
    ['growth_score', 'Growth'],
    ['momentum_score', 'Momentum'],
    ['quality_score', 'Quality'],
  ];
  const topRatios = (km.top_ratios && typeof km.top_ratios === 'object'
    ? (km.top_ratios as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      {/* Verdict hero */}
      <Card className="border-border/30 bg-gradient-to-br from-primary/5 via-card/30 to-card/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  xAI Grok Analysis
                </p>
                <p className="text-xs text-muted-foreground">
                  Last generated: {formatRelativeTime(review.generated_at)}
                  {review.model ? ` · ${review.model}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${verdictStyle(review.verdict)}`}>
                {review.verdict}
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence
                <div className="mt-0.5 flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, review.confidence))}%` }}
                    />
                  </div>
                  <span className="font-semibold text-foreground tabular-nums">{review.confidence}%</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => load(true)} disabled={generating}>
                {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Regenerate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bull / Bear */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-emerald-400">
              <TrendingUp className="h-4 w-4" /> Bull Case
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {review.bull_case || '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-400">
              <TrendingDown className="h-4 w-4" /> Bear Case
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {review.bear_case || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sentiments */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/30 bg-card/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-primary" /> Institutional Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {review.institutional_sentiment || '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" /> Retail Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {review.retail_sentiment || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics */}
      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-primary" /> Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {scoreKeys.map(([key, label]) => {
              const raw = km[key];
              const num = typeof raw === 'number' ? raw : Number(raw);
              const val = Number.isFinite(num) ? Math.round(num) : null;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border/30 bg-card/50 p-3 text-center"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                    {val ?? '—'}
                  </p>
                  <div className="mt-1 h-1 w-full rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, val ?? 0))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {Object.keys(topRatios).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top Ratios
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {Object.entries(topRatios).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-md border border-border/20 bg-card/30 px-3 py-1.5"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-medium tabular-nums">
                      {typeof value === 'number' || typeof value === 'string' ? String(value) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        AI-generated analysis for informational purposes only. Not financial advice.
      </p>
    </div>
  );
}

interface StockDetailProps {
  symbol: string;
  onBack?: () => void;
}

export default function StockDetail({ symbol, onBack }: StockDetailProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ processed: ProcessedResult; history: PriceHistoryPoint[] } | null>(null);
  const [rankings, setRankings] = useState<Record<string, string>>({});
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/stocks/fetch?ticker=${symbol}${force ? '&refresh=true' : ''}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  const computeRankings = async () => {
    if (!data) return;
    setRankingsLoading(true);
    try {
      const res = await fetch('/api/stocks/process?preset=Overall');
      if (!res.ok) return;
      const { results } = (await res.json()) as { results: ProcessedResult[] };
      const targetCap = data.processed.cap_category;
      const targetSector = data.processed.metrics.Sector ?? 'N/A';
      const capHeader = targetCap !== 'N/A' ? targetCap : 'Unknown';
      const sectorHeader = targetSector !== 'N/A' ? targetSector : 'Unknown';
      const newRankings: Record<string, string> = {};
      for (const preset of ['Value', 'Growth', 'Momentum', 'Quality'] as const) {
        const logic = PRESETS[preset];
        const processed = results.map((r) => processStock(r.metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic));
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
    } catch { /* ignore */ }
    finally { setRankingsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data) computeRankings(); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
        <div className="grid gap-4 grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Could not load data for {symbol}</p>
        {onBack && (
          <Button variant="outline" className="mt-4" onClick={onBack}>Go Back</Button>
        )}
      </div>
    );
  }

  const { processed, history } = data;
  const m = processed.metrics;
  const price = getFloat(m, 'Current Price');
  const high52 = getFloat(m, '52W High');
  const low52 = getFloat(m, '52W Low');
  const marketCap = m['Market Cap'] !== 'N/A' ? formatLarge(Number(m['Market Cap'])) : '—';
  const pe = m['P/E'] !== 'N/A' ? Number(m['P/E']).toFixed(1) : '—';
  const fpe = m['Forward P/E'] !== 'N/A' ? Number(m['Forward P/E']).toFixed(1) : '—';
  const peg = m.PEG !== 'N/A' ? Number(m.PEG).toFixed(2) : '—';
  const divYield = m['Dividend Yield'] !== 'N/A' ? `${Number(m['Dividend Yield']).toFixed(2)}%` : '—';
  const beta = m.Beta !== 'N/A' ? Number(m.Beta).toFixed(2) : '—';
  const ev = m.EV !== 'N/A' ? formatLarge(Number(m.EV)) : '—';
  const volume = m['Average Volume'] !== 'N/A' ? formatLarge(Number(m['Average Volume'])) : '—';
  const rangeWidth = high52 - low52 > 0 ? ((price - low52) / (high52 - low52)) * 100 : 50;

  const pctFromHigh = high52 > 0 ? ((price - high52) / high52 * 100) : 0;
  const isUp = pctFromHigh >= 0;

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-14 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur-xl border-b border-border/30 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{m.Ticker}</h1>
                <span className="text-lg text-muted-foreground font-medium truncate max-w-[250px]">{m['Company Name']}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-2xl font-bold tabular-nums">${price.toFixed(2)}</span>
                <span className={`flex items-center text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(pctFromHigh).toFixed(2)}% from 52w high
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{processed.cap_category}</Badge>
            {m.Sector !== 'N/A' && <Badge variant="outline" className="text-xs">{m.Sector}</Badge>}
            {m.Industry !== 'N/A' && <Badge variant="outline" className="text-xs opacity-70">{m.Industry}</Badge>}
            <span className="text-xs text-muted-foreground">MC: {marketCap}</span>
            <PinButton symbol={m.Ticker} size="sm" />
            <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Price History</h2>
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeRange === r
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <PriceChart data={history} range={timeRange} />
        </CardContent>
      </Card>

      {/* Key Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        <StatCard label="Price" value={`$${price.toFixed(2)}`} />
        <StatCard label="Volume" value={volume} />
        <StatCard label="52w High" value={`$${high52.toFixed(2)}`} />
        <StatCard label="52w Low" value={`$${low52.toFixed(2)}`} />
        <StatCard label="P/E" value={pe} />
        <StatCard label="Fwd P/E" value={fpe} />
        <StatCard label="PEG" value={peg} />
        <StatCard label="Div Yield" value={divYield} />
        <StatCard label="Beta" value={beta} />
        <StatCard label="EV" value={ev} />
      </div>

      {/* Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column - Tabs */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 border-b border-border/30 rounded-none">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Overview</TabsTrigger>
              <TabsTrigger value="ratios" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Ratios</TabsTrigger>
              <TabsTrigger value="growth" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Growth & Momentum</TabsTrigger>
              <TabsTrigger value="flags" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Flags</TabsTrigger>
              <TabsTrigger value="rankings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Rankings</TabsTrigger>
              <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <Sparkles className="mr-1 h-3 w-3 text-primary" />
                AI Analysis
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card className="border-border/30 bg-card/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>${low52.toFixed(2)}</span>
                    <span>52-Week Range</span>
                    <span>${high52.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                      style={{ width: `${Math.max(2, Math.min(98, rangeWidth))}%` }}
                    >
                      <div className="absolute -right-1 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-card/30">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Analyst Summary</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Rating</p>
                      <p className="text-sm font-bold">{m['Analyst Rating'] !== 'N/A' ? String(m['Analyst Rating']).toUpperCase() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sentiment</p>
                      <p className={`text-sm font-bold ${m.Sentiment === 'Bullish' ? 'text-emerald-400' : m.Sentiment === 'Bearish' ? 'text-red-400' : ''}`}>
                        {m.Sentiment !== 'N/A' ? m.Sentiment : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Target Price</p>
                      <p className="text-sm font-bold tabular-nums">
                        {m['Target Price'] !== 'N/A' ? `$${Number(m['Target Price']).toFixed(2)}` : '—'}
                      </p>
                      {m['Target Price'] !== 'N/A' && price > 0 && (
                        <p className={`text-[10px] ${Number(m['Target Price']) > price ? 'text-emerald-400' : 'text-red-400'}`}>
                          {((Number(m['Target Price']) - price) / price * 100).toFixed(1)}% upside
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <AiSnapshot symbol={symbol} onViewFull={() => setActiveTab('ai')} />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Factor Scores
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="flex flex-col items-center rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <BarChart3 className="h-6 w-6 text-primary mb-1" />
                    <span className="text-2xl font-bold tabular-nums text-primary">{processed.final_score.toFixed(1)}</span>
                    <span className="text-xs font-medium mt-1">Overall</span>
                  </div>
                  <ScoreBadge label="Value" score={processed.factor_boosts.value} icon={Target} />
                  <ScoreBadge label="Growth" score={processed.factor_boosts.growth} icon={Zap} />
                  <ScoreBadge label="Momentum" score={processed.factor_boosts.momentum} icon={TrendingUp} />
                  <ScoreBadge label="Quality" score={processed.factor_boosts.quality} icon={Shield} />
                </div>
              </div>
            </TabsContent>

            {/* Ratios Tab */}
            <TabsContent value="ratios" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Valuation</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="P/E Ratio" value={m['P/E']} />
                    <MetricRow label="Forward P/E" value={m['Forward P/E']} />
                    <MetricRow label="P/B Ratio" value={m['P/B']} />
                    <MetricRow label="PEG Ratio" value={m.PEG} />
                    <MetricRow label="P/FCF" value={m['P/FCF']} />
                    <MetricRow label="EV" value={m.EV !== 'N/A' ? formatLarge(Number(m.EV)) : 'N/A'} />
                    <MetricRow label="Market Cap" value={m['Market Cap'] !== 'N/A' ? formatLarge(Number(m['Market Cap'])) : 'N/A'} />
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Profitability</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="ROE" value={m.ROE} suffix="%" />
                    <MetricRow label="Gross Margin" value={m['Gross Margin']} suffix="%" />
                    <MetricRow label="Net Profit Margin" value={m['Net Profit Margin']} suffix="%" />
                    <MetricRow label="FCF/EV" value={m['FCF % EV TTM']} suffix="%" />
                    <MetricRow label="EBITDA/EV" value={m['EBITDA % EV TTM']} suffix="%" />
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Balance Sheet</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="D/E Ratio" value={m['D/E']} />
                    <MetricRow label="Total Cash" value={m['Total Cash'] !== 'N/A' ? formatLarge(Number(m['Total Cash'])) : 'N/A'} />
                    <MetricRow label="Total Debt" value={m['Total Debt'] !== 'N/A' ? formatLarge(Number(m['Total Debt'])) : 'N/A'} />
                    <MetricRow label="FCF" value={m['FCF Actual'] !== 'N/A' ? formatLarge(Number(m['FCF Actual'])) : 'N/A'} />
                    <MetricRow label="EBITDA" value={m['EBITDA Actual'] !== 'N/A' ? formatLarge(Number(m['EBITDA Actual'])) : 'N/A'} />
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Liquidity & Leverage</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="D/E" value={m['D/E']} />
                    <MetricRow label="FCF % EV" value={m['FCF % EV TTM']} suffix="%" />
                    <MetricRow label="EBITDA % EV" value={m['EBITDA % EV TTM']} suffix="%" />
                    <MetricRow label="Beta" value={m.Beta} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Growth & Momentum Tab */}
            <TabsContent value="growth" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Growth Rates</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="Revenue Growth" value={m['Revenue Growth']} suffix="%" />
                    <MetricRow label="Earnings Growth" value={m['Earnings Growth']} suffix="%" />
                    <MetricRow label="PEG Ratio" value={m.PEG} />
                    <MetricRow label="Forward P/E" value={m['Forward P/E']} />
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Momentum & Technical</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="RSI" value={m.RSI} />
                    <MetricRow label="Beta" value={m.Beta} />
                    <MetricRow label="52W High" value={m['52W High'] !== 'N/A' ? `$${Number(m['52W High']).toFixed(2)}` : 'N/A'} />
                    <MetricRow label="52W Low" value={m['52W Low'] !== 'N/A' ? `$${Number(m['52W Low']).toFixed(2)}` : 'N/A'} />
                    <MetricRow label="% from 52W High" value={high52 > 0 ? `${((price - high52) / high52 * 100).toFixed(1)}%` : 'N/A'} />
                    <MetricRow label="Avg Volume" value={m['Average Volume'] !== 'N/A' ? formatLarge(Number(m['Average Volume'])) : 'N/A'} />
                    <MetricRow label="Dividend Yield" value={m['Dividend Yield']} suffix="%" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Flags Tab */}
            <TabsContent value="flags" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-emerald-400" /> Positives
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {processed.positives.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingDown className="h-4 w-4 text-red-400" /> Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{processed.risks}</p>
                  </CardContent>
                </Card>
              </div>

              {processed.flags.length > 0 && (
                <Card className="border-border/30 bg-card/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Active Flags</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {processed.flags.map((flag) => (
                        <Badge
                          key={flag}
                          variant={NEGATIVE_FLAGS.has(flag) ? 'destructive' : 'success'}
                          className="text-xs"
                        >
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="ai" className="mt-4">
              <AiAnalysisPanel symbol={symbol} />
            </TabsContent>

            {/* Rankings Tab */}
            <TabsContent value="rankings" className="mt-4">
              <Card className="border-border/30 bg-card/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rankings by Preset Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  {rankingsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : Object.keys(rankings).length > 0 ? (
                    <RankingsGrid rankings={rankings} />
                  ) : (
                    <p className="text-xs text-muted-foreground">No ranking data available. Add more stocks to see rankings.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Pin to Watchlist */}
          <Card className="border-border/30 bg-card/30">
            <CardContent className="p-4">
              <PinButton symbol={m.Ticker} size="sm" />
              <p className="text-[10px] text-muted-foreground mt-2">
                {/* guest pinning works via localStorage */}
                Pin to track in your watchlist
              </p>
            </CardContent>
          </Card>

          {/* Quick Risk Metrics */}
          <Card className="border-border/30 bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Risk Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetricRow label="Beta" value={m.Beta} />
              <MetricRow label="D/E Ratio" value={m['D/E']} />
              <MetricRow label="RSI" value={m.RSI} />
              <MetricRow label="% from 52w High" value={high52 > 0 ? `${((price - high52) / high52 * 100).toFixed(1)}%` : 'N/A'} />
              <MetricRow label="Dividend Yield" value={m['Dividend Yield']} suffix="%" />
            </CardContent>
          </Card>

          {/* Score Summary */}
          <Card className="border-border/30 bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Score Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Base Score</span>
                  <span className="font-medium tabular-nums">{processed.base_score.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Factor Boost</span>
                  <span className="font-medium tabular-nums text-primary">
                    +{Object.values(processed.factor_boosts).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="border-t border-border/30 pt-2 flex justify-between text-sm">
                  <span className="font-semibold">Final Score</span>
                  <span className="font-bold tabular-nums text-primary">{processed.final_score.toFixed(1)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Flags Sidebar */}
          {processed.flags.length > 0 && (
            <Card className="border-border/30 bg-card/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {processed.flags.map((flag) => (
                    <Badge
                      key={flag}
                      variant={NEGATIVE_FLAGS.has(flag) ? 'destructive' : 'success'}
                      className="text-[10px]"
                    >
                      {flag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
