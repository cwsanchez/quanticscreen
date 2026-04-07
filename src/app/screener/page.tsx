'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  Download,
  Search,
  BarChart3 as BarChart3Icon,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getFloat, formatLarge, NEGATIVE_FLAGS, FLAG_NAMES } from '@/lib/processor';
import type { ProcessedResult } from '@/types';

const columnHelper = createColumnHelper<ProcessedResult>();

export default function ScreenerPage() {
  const router = useRouter();
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [preset, setPreset] = useState('Overall');
  const [search, setSearch] = useState('');
  const [dataset, setDataset] = useState('All');
  const [selectedSector, setSelectedSector] = useState('');
  const [excludeNegative, setExcludeNegative] = useState(false);
  const [requireFlags, setRequireFlags] = useState<string[]>([]);
  const [flagMatch, setFlagMatch] = useState<'Any' | 'All'>('Any');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/stocks/process?preset=${preset}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setSectors(data.sectors ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [preset]);

  const filteredResults = useMemo(() => {
    let r = [...results];

    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.metrics.Ticker.toLowerCase().includes(q) ||
          x.metrics['Company Name'].toLowerCase().includes(q)
      );
    }

    if (dataset === 'Large Cap') {
      r = r.filter((x) => getFloat(x.metrics, 'Market Cap') > 10e9);
    } else if (dataset === 'Mid Cap') {
      r = r.filter((x) => {
        const mc = getFloat(x.metrics, 'Market Cap');
        return mc >= 2e9 && mc <= 10e9;
      });
    } else if (dataset === 'Small Cap') {
      r = r.filter((x) => getFloat(x.metrics, 'Market Cap') < 2e9);
    } else if (dataset === 'Value') {
      r = r.filter(
        (x) => x.flags.includes('Undervalued') || getFloat(x.metrics, 'P/B') < 2
      );
    } else if (dataset === 'Growth') {
      r = r.filter(
        (x) => x.flags.includes('GARP') || getFloat(x.metrics, 'PEG') < 1
      );
    } else if (dataset === 'Sector' && selectedSector) {
      r = r.filter((x) => x.metrics.Sector === selectedSector);
    }

    if (excludeNegative) {
      r = r.filter((x) => !x.flags.some((f) => NEGATIVE_FLAGS.has(f)));
    }

    if (requireFlags.length > 0) {
      if (flagMatch === 'Any') {
        r = r.filter((x) => requireFlags.some((f) => x.flags.includes(f)));
      } else {
        r = r.filter((x) => requireFlags.every((f) => x.flags.includes(f)));
      }
    }

    return r;
  }, [results, search, dataset, selectedSector, excludeNegative, requireFlags, flagMatch]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.metrics.Ticker, {
        id: 'ticker',
        header: 'Ticker',
        cell: (info) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => router.push(`/ticker/${info.getValue()}`)}
          >
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.accessor((row) => row.metrics['Company Name'], {
        id: 'company',
        header: 'Company',
        cell: (info) => (
          <span className="max-w-[200px] truncate text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor((row) => row.final_score, {
        id: 'score',
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
            Score <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => (
          <span className="font-bold tabular-nums text-primary">
            {info.getValue().toFixed(1)}
          </span>
        ),
      }),
      columnHelper.accessor((row) => getFloat(row.metrics, 'Current Price'), {
        id: 'price',
        header: 'Price',
        cell: (info) => <span className="tabular-nums">${info.getValue().toFixed(2)}</span>,
      }),
      columnHelper.accessor((row) => row.metrics['Market Cap'], {
        id: 'mcap',
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
            MC <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => (
          <span className="tabular-nums">
            {info.getValue() !== 'N/A' ? formatLarge(Number(info.getValue())) : '—'}
          </span>
        ),
        sortingFn: (a, b) => {
          const av = a.original.metrics['Market Cap'];
          const bv = b.original.metrics['Market Cap'];
          return (av === 'N/A' ? 0 : Number(av)) - (bv === 'N/A' ? 0 : Number(bv));
        },
      }),
      columnHelper.accessor((row) => row.metrics['P/E'], {
        id: 'pe',
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
            P/E <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? Number(info.getValue()).toFixed(1) : '—'}</span>
        ),
        sortingFn: (a, b) => {
          const av = a.original.metrics['P/E'];
          const bv = b.original.metrics['P/E'];
          return (av === 'N/A' ? 999 : Number(av)) - (bv === 'N/A' ? 999 : Number(bv));
        },
      }),
      columnHelper.accessor((row) => row.metrics.ROE, {
        id: 'roe',
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
            ROE% <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? `${Number(info.getValue()).toFixed(1)}%` : '—'}</span>
        ),
        sortingFn: (a, b) => {
          const av = a.original.metrics.ROE;
          const bv = b.original.metrics.ROE;
          return (av === 'N/A' ? 0 : Number(av)) - (bv === 'N/A' ? 0 : Number(bv));
        },
      }),
      columnHelper.accessor((row) => row.metrics['P/B'], {
        id: 'pb',
        header: 'P/B',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? Number(info.getValue()).toFixed(2) : '—'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.metrics.PEG, {
        id: 'peg',
        header: 'PEG',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? Number(info.getValue()).toFixed(2) : '—'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.metrics['Gross Margin'], {
        id: 'grossMargin',
        header: 'Gross%',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? `${Number(info.getValue()).toFixed(1)}%` : '—'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.metrics['D/E'], {
        id: 'de',
        header: 'D/E',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? Number(info.getValue()).toFixed(2) : '—'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.metrics['FCF % EV TTM'], {
        id: 'fcfev',
        header: 'FCF/EV%',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() !== 'N/A' ? `${Number(info.getValue()).toFixed(1)}%` : '—'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.flags, {
        id: 'flags',
        header: 'Flags',
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((f) => (
              <Badge
                key={f}
                variant={NEGATIVE_FLAGS.has(f) ? 'destructive' : 'success'}
                className="text-[10px] whitespace-nowrap"
              >
                {f}
              </Badge>
            ))}
          </div>
        ),
        enableSorting: false,
      }),
    ],
    [router]
  );

  const table = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const exportCSV = () => {
    const headers = table.getVisibleFlatColumns().map((c) => c.id);
    const rows = table.getFilteredRowModel().rows.map((row) => {
      return headers.map((h) => {
        const cell = row.getAllCells().find((c) => c.column.id === h);
        const val = cell?.getValue();
        if (Array.isArray(val)) return val.join('; ');
        if (val === 'N/A') return '';
        return String(val ?? '');
      });
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener_${preset}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Screener</h1>
          <p className="text-sm text-muted-foreground">
            {filteredResults.length} stocks • {preset} preset
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={fetchResults} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Search className="mr-1 h-3 w-3" />}
            Search
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-1 h-3 w-3" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowColumns(!showColumns)}>
            <Columns3 className="mr-1 h-3 w-3" />
            Columns
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-border/30 bg-card/50">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1.5 block text-xs">Preset</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Overall', 'Value', 'Growth', 'Momentum', 'Quality'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Dataset</Label>
              <Select value={dataset} onValueChange={setDataset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['All', 'Large Cap', 'Mid Cap', 'Small Cap', 'Value', 'Growth', 'Sector'].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dataset === 'Sector' && (
              <div>
                <Label className="mb-1.5 block text-xs">Sector</Label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block text-xs">Require Flags</Label>
              <div className="flex flex-wrap gap-1">
                {FLAG_NAMES.map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      setRequireFlags((prev) =>
                        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                      )
                    }
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                      requireFlags.includes(f)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {requireFlags.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className={`text-[10px] ${flagMatch === 'Any' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setFlagMatch('Any')}
                  >
                    Match Any
                  </button>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <button
                    className={`text-[10px] ${flagMatch === 'All' ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setFlagMatch('All')}
                  >
                    Match All
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="excludeNeg"
                checked={excludeNegative}
                onCheckedChange={(v) => setExcludeNegative(!!v)}
              />
              <Label htmlFor="excludeNeg" className="text-xs">
                Exclude negative flags
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {showColumns && (
        <Card className="border-border/30 bg-card/50">
          <CardContent className="flex flex-wrap gap-3 p-4">
            {table.getAllLeafColumns().map((col) => (
              <label key={col.id} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                />
                {col.id}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search ticker or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {search && (
          <Button variant="ghost" size="icon" onClick={() => setSearch('')}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3Icon className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-2">
            Ready to screen stocks
          </p>
          <p className="text-sm text-muted-foreground/70 mb-6 max-w-md">
            Select a preset and filters above, then click Search to load scored results from your database.
          </p>
          <Button onClick={fetchResults} size="lg">
            <Search className="mr-2 h-4 w-4" />
            Search Stocks
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b bg-muted/30">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/20 transition-colors hover:bg-muted/20"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()} ({filteredResults.length} results)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
