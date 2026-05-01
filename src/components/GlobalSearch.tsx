'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  variant?: 'navbar' | 'hero';
  onSelect?: (symbol: string) => void;
  autoFocus?: boolean;
  initialValue?: string;
}

/**
 * A compact, theme-aware search box with a type-ahead dropdown.
 * Used in the navbar (variant="navbar") and on the homepage hero (variant="hero").
 * When no onSelect handler is provided, selecting a result navigates to /ticker/[symbol].
 */
export function GlobalSearch({
  placeholder,
  className,
  variant = 'navbar',
  onSelect,
  autoFocus = false,
  initialValue = '',
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 250);
  };

  const handleSelect = (symbol: string) => {
    setShowDropdown(false);
    setQuery('');
    setResults([]);
    if (onSelect) {
      onSelect(symbol);
      return;
    }
    setNavigating(true);
    router.push(`/ticker/${symbol}`);
    // Navigation doesn't always unmount; reset after a tick
    setTimeout(() => setNavigating(false), 400);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isHero = variant === 'hero';

  // Palette: primary-tinted backdrop with a magnifier icon on the left.
  const shellClass = isHero
    ? 'flex items-center rounded-xl border border-primary/25 bg-primary/10 px-3.5 h-14 shadow-sm focus-within:border-primary/50 focus-within:bg-primary/15 transition-colors'
    : 'flex items-center rounded-lg border border-primary/25 bg-primary/10 px-3 h-9 focus-within:border-primary/50 focus-within:bg-primary/15 transition-colors';

  const inputClass = isHero
    ? 'flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 ml-2'
    : 'flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 ml-2 min-w-0';

  const iconClass = isHero
    ? 'h-5 w-5 shrink-0 text-primary'
    : 'h-4 w-4 shrink-0 text-primary';

  const resolvedPlaceholder =
    placeholder ?? (isHero ? 'Search any stock... (e.g., AAPL, Tesla)' : 'Search stocks...');

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label className={shellClass}>
        <Search className={iconClass} />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0].symbol);
            } else if (e.key === 'Escape') {
              setShowDropdown(false);
            }
          }}
          placeholder={resolvedPlaceholder}
          className={inputClass}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
        />
        {(isSearching || navigating) && (
          <Loader2 className={cn('animate-spin text-muted-foreground shrink-0', isHero ? 'h-5 w-5' : 'h-4 w-4')} />
        )}
      </label>

      {showDropdown && results.length > 0 && !navigating && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-xl">
          {results.map((r) => (
            <button
              key={r.symbol}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(r.symbol);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0 flex-1 pr-3">
                <span className="font-semibold">{r.symbol}</span>
                <span className="ml-2 text-sm text-muted-foreground truncate">{r.name}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
