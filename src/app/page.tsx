'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  TrendingUp,
  BarChart3,
  Zap,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WatchlistSidebar } from '@/components/WatchlistSidebar';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [navigating, setNavigating] = useState(false);
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

  const handleSelect = (symbol: string) => {
    setShowDropdown(false);
    setQuery(symbol);
    setNavigating(true);
    router.push(`/ticker/${symbol}`);
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
      <aside className="w-full lg:w-80 shrink-0 order-2 lg:order-1">
        <div className="lg:sticky lg:top-20">
          <WatchlistSidebar onSelectStock={handleSelect} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col items-center order-1 lg:order-2">
        <div className="mt-4 flex flex-col items-center text-center sm:mt-8">
          <div className="flex items-center gap-2 rounded-full border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Quant scoring + xAI Grok research notes
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Research stocks
            <br />
            <span className="text-primary">your way</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Multi-factor scoring, smart flag detection, and AI-generated bull / bear
            cases for every company. Search any ticker to jump straight to its
            full report.
          </p>
        </div>

        <div ref={searchRef} className="relative mt-8 w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  handleSelect(searchResults[0].symbol);
                }
              }}
              placeholder="Search any stock... (e.g., AAPL, Tesla, Microsoft)"
              className="h-14 rounded-xl border-border/50 bg-card/50 pl-12 pr-4 text-lg backdrop-blur placeholder:text-muted-foreground/50 focus-visible:ring-primary/30"
            />
            {(isSearching || navigating) && (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && !navigating && (
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

        <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: 'Multi-Factor Scoring',
              desc: 'Weighted scoring across 8+ fundamental metrics with Value, Growth, Momentum, and Quality factor boosts.',
            },
            {
              icon: Sparkles,
              title: 'xAI Grok Analysis',
              desc: 'Every stock gets an AI-generated research note with bull / bear cases, sentiment, and a buy-rating verdict.',
            },
            {
              icon: TrendingUp,
              title: 'Smart Flag Detection',
              desc: '8 analytical flags: Undervalued, Quality Moat, GARP, Momentum Building, Debt Burden, and more.',
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

        <div className="mt-12 mb-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => router.push('/screener')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Open Screener
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/ai')}>
            <Sparkles className="mr-2 h-4 w-4" />
            Browse AI Ratings
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/builder')}>
            <Zap className="mr-2 h-4 w-4" />
            Build Custom Strategy
          </Button>
        </div>
      </div>
    </div>
  );
}
