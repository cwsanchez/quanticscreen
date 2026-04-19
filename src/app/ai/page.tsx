'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiListItem } from '@/app/api/ai/list/route';

type SortField =
  | 'verdict'
  | 'confidence'
  | 'overall_score'
  | 'value_score'
  | 'growth_score'
  | 'momentum_score'
  | 'quality_score'
  | 'generated_at'
  | 'ticker';

type SortDir = 'asc' | 'desc';

const VERDICT_RANK: Record<string, number> = {
  'strong buy': 5,
  buy: 4,
  hold: 3,
  sell: 2,
  'strong sell': 1,
};

const VERDICT_FILTERS = ['All', 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'];

function verdictRank(v: string | null | undefined): number {
  if (!v) return 0;
  return VERDICT_RANK[v.toLowerCase()] ?? 0;
}

function verdictStyle(verdict: string | null | undefined): string {
  const v = (verdict ?? '').toLowerCase();
  if (v.includes('strong buy')) return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
  if (v.includes('buy')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (v.includes('strong sell')) return 'bg-red-500/15 border-red-500/40 text-red-400';
  if (v.includes('sell')) return 'bg-red-500/10 border-red-500/30 text-red-400';
  return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const delta = Date.now() - then;
  const mins = Math.round(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function HeaderCell({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = sortField === field;
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const justifyClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`px-3 py-2 text-xs font-medium text-muted-foreground ${alignClass}`}>
      <button
        onClick={() => onSort(field)}
        className={`flex w-full items-center gap-1 ${justifyClass} hover:text-foreground transition-colors`}
      >
        {label}
        {active ? (
          sortDir === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-secondary shrink-0">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="tabular-nums text-foreground">{Math.round(v)}</span>
    </div>
  );
}

export default function AiPage() {
  const router = useRouter();
  const [items, setItems] = useState<AiListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('verdict');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ai/list');
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? 'Failed to load AI ratings');
          setItems([]);
        } else {
          setItems((data.items ?? []) as AiListItem[]);
        }
      } catch {
        setError('Network error while loading AI ratings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'ticker' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.ticker.toLowerCase().includes(q) ||
          (i.company_name ?? '').toLowerCase().includes(q)
      );
    }
    if (verdictFilter !== 'All') {
      const target = verdictFilter.toLowerCase();
      list = list.filter((i) => (i.verdict ?? '').toLowerCase() === target);
    }
    return list;
  }, [items, search, verdictFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortField) {
        case 'verdict': {
          const ar = verdictRank(a.verdict);
          const br = verdictRank(b.verdict);
          if (ar !== br) return (ar - br) * dir;
          return ((a.confidence ?? 0) - (b.confidence ?? 0)) * dir;
        }
        case 'confidence':
          av = a.confidence ?? -1;
          bv = b.confidence ?? -1;
          break;
        case 'overall_score':
          av = a.overall_score ?? -1;
          bv = b.overall_score ?? -1;
          break;
        case 'value_score':
          av = a.value_score ?? -1;
          bv = b.value_score ?? -1;
          break;
        case 'growth_score':
          av = a.growth_score ?? -1;
          bv = b.growth_score ?? -1;
          break;
        case 'momentum_score':
          av = a.momentum_score ?? -1;
          bv = b.momentum_score ?? -1;
          break;
        case 'quality_score':
          av = a.quality_score ?? -1;
          bv = b.quality_score ?? -1;
          break;
        case 'generated_at':
          av = new Date(a.generated_at).getTime();
          bv = new Date(b.generated_at).getTime();
          break;
        case 'ticker':
          av = a.ticker;
          bv = b.ticker;
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      const key = i.verdict ?? 'Unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Ratings
          </h1>
          <p className="text-sm text-muted-foreground">
            xAI Grok verdicts and factor scores for every company that has a cached
            AI review. Sort by buy rating, confidence, or any factor score.
          </p>
        </div>
      </div>

      {/* Summary badges */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {items.length} rated
          </Badge>
          {['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'].map((v) => {
            const count = verdictCounts[v] ?? 0;
            if (count === 0) return null;
            return (
              <div
                key={v}
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${verdictStyle(v)}`}
              >
                {v}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="border-border/30 bg-card/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or company..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Verdict:
            </span>
            <Select value={verdictFilter} onValueChange={setVerdictFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERDICT_FILTERS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Sort:
            </span>
            <Select
              value={sortField}
              onValueChange={(v) => setSortField(v as SortField)}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verdict">Buy Rating</SelectItem>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="overall_score">Overall Score</SelectItem>
                <SelectItem value="value_score">Value Score</SelectItem>
                <SelectItem value="growth_score">Growth Score</SelectItem>
                <SelectItem value="momentum_score">Momentum Score</SelectItem>
                <SelectItem value="quality_score">Quality Score</SelectItem>
                <SelectItem value="generated_at">Most Recent</SelectItem>
                <SelectItem value="ticker">Ticker (A–Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
              }
              title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
            >
              {sortDir === 'desc' ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <ArrowUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-border/30 bg-card/30">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium">Could not load AI ratings</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-border/30 bg-card/30">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium">No AI ratings yet</p>
            <p className="max-w-md text-xs text-muted-foreground">
              AI reviews are generated for stocks you view and by the background
              cron job. Open a stock&apos;s AI Analysis tab to generate its first
              review, or wait for the cron job to populate them automatically.
            </p>
            <Button size="sm" onClick={() => router.push('/screener')}>
              Browse Screener
            </Button>
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="border-border/30 bg-card/30">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No stocks match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/30 bg-card/30">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <HeaderCell
                      label="Ticker"
                      field="ticker"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Company
                    </th>
                    <HeaderCell
                      label="Verdict"
                      field="verdict"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Confidence"
                      field="confidence"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Overall"
                      field="overall_score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Value"
                      field="value_score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Growth"
                      field="growth_score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Momentum"
                      field="momentum_score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Quality"
                      field="quality_score"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <HeaderCell
                      label="Generated"
                      field="generated_at"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.ticker}
                      className="border-b border-border/20 transition-colors hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/ticker/${item.ticker}`)}
                    >
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">
                            {item.ticker}
                          </span>
                          {item.current_price != null && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              ${item.current_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="flex flex-col">
                          <span className="truncate">
                            {item.company_name ?? '—'}
                          </span>
                          {item.sector && item.sector !== 'N/A' && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {item.sector}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${verdictStyle(item.verdict)}`}
                        >
                          {item.verdict ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {item.confidence != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-secondary shrink-0">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{
                                  width: `${Math.max(0, Math.min(100, item.confidence))}%`,
                                }}
                              />
                            </div>
                            <span className="tabular-nums text-foreground">
                              {item.confidence}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar value={item.overall_score} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar value={item.value_score} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar value={item.growth_score} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar value={item.momentum_score} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar value={item.quality_score} />
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.generated_at)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        <TrendingUp className="mr-1 inline h-3 w-3" />
        AI-generated analysis for informational purposes only. Not financial advice.
      </p>
    </div>
  );
}
