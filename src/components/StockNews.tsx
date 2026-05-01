'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Newspaper, RefreshCw, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockNews, NewsHeadline } from '@/types';

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const deltaDays = Math.round((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (deltaDays <= 0) return 'today';
  if (deltaDays === 1) return 'yesterday';
  if (deltaDays < 7) return `${deltaDays}d ago`;
  if (deltaDays < 30) return `${Math.round(deltaDays / 7)}w ago`;
  return `${Math.round(deltaDays / 30)}mo ago`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

export function NewsHeadlineItem({ h, compact = false }: { h: NewsHeadline; compact?: boolean }) {
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-start gap-3 rounded-lg border border-border/20 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 ${compact ? 'py-2' : ''}`}
    >
      <div className="mt-0.5 shrink-0 rounded-md bg-primary/10 p-1.5">
        <Newspaper className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-medium leading-snug group-hover:text-primary ${compact ? 'text-xs' : 'text-sm'}`}>
          {h.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium">{h.source || hostnameOf(h.url)}</span>
          {h.published_at && (
            <>
              <span>·</span>
              <span>{formatRelativeDate(h.published_at)}</span>
            </>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary" />
    </a>
  );
}

interface UseStockNewsOptions {
  refresh?: boolean;
  auto?: boolean;
}

export function useStockNews(symbol: string, { auto = true }: UseStockNewsOptions = {}) {
  const [news, setNews] = useState<StockNews | null>(null);
  const [loading, setLoading] = useState(auto);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!symbol) return;
      if (force) setGenerating(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/ai/news/${symbol}${force ? '?refresh=true' : ''}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? 'Failed to load news');
          setNews(null);
        } else {
          setNews(data.news as StockNews);
        }
      } catch {
        setError('Network error while loading news');
      } finally {
        setLoading(false);
        setGenerating(false);
      }
    },
    [symbol]
  );

  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, auto, load]);

  return { news, loading, generating, error, reload: load };
}

export function StockNewsOverviewCard({
  symbol,
  onViewFull,
}: {
  symbol: string;
  onViewFull: () => void;
}) {
  const { news, loading, error } = useStockNews(symbol);

  if (loading) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const missingKey = error ? /XAI_API_KEY|missing_api_key/i.test(error) : false;

  if (error || !news || (news.headlines.length === 0 && !news.summary)) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Newspaper className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Recent News
                </p>
                <p className="text-xs text-muted-foreground">
                  {missingKey
                    ? 'Set XAI_API_KEY to enable news.'
                    : 'No recent news available yet.'}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onViewFull}>
              Open News
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topThree = news.headlines.slice(0, 3);

  return (
    <Card className="border-border/30 bg-card/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Newspaper className="h-4 w-4 text-primary" /> Recent News
            <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Last 30 days
            </span>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={onViewFull}>
            Full Summary
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {news.summary && (
          <p className="text-xs leading-relaxed text-foreground/90 line-clamp-4">
            {news.summary}
          </p>
        )}
        {topThree.length > 0 && (
          <div className="space-y-1.5">
            {topThree.map((h) => (
              <NewsHeadlineItem key={h.url} h={h} compact />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StockNewsPanel({ symbol }: { symbol: string }) {
  const { news, loading, generating, error, reload } = useStockNews(symbol);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const missingKey = error ? /XAI_API_KEY|missing_api_key/i.test(error) : false;
  if (error) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-6 text-center space-y-3">
          <Newspaper className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-medium">News unavailable</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {missingKey
              ? 'Set XAI_API_KEY to enable news powered by xAI Grok live search.'
              : error}
          </p>
          {!missingKey && (
            <Button size="sm" variant="outline" onClick={() => reload(true)} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!news || (news.headlines.length === 0 && !news.summary)) {
    return (
      <Card className="border-border/30 bg-card/30">
        <CardContent className="p-6 text-center space-y-3 text-sm text-muted-foreground">
          <p>No recent news found.</p>
          <Button size="sm" onClick={() => reload(true)} disabled={generating}>
            {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Newspaper className="mr-1 h-3 w-3" />}
            Search now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/30 bg-gradient-to-br from-primary/5 via-card/30 to-card/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Newspaper className="h-4 w-4 text-primary" /> News Summary
              <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                Last 30 days
              </span>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => reload(true)} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {news.summary || '—'}
          </p>
          {news.model && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              Curated via xAI Grok live search · {news.model}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/30 bg-card/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Headlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {news.headlines.length > 0 ? (
            news.headlines.map((h) => <NewsHeadlineItem key={h.url} h={h} />)
          ) : (
            <p className="text-xs text-muted-foreground">No headlines returned.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        Headlines are generated via xAI Grok live search and may occasionally include stale or off-topic stories.
      </p>
    </div>
  );
}
