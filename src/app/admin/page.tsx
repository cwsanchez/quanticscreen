'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [fetchInput, setFetchInput] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  const [results, setResults] = useState<Array<{ ticker: string; success: boolean; message?: string }>>([]);

  const callApi = async (action: string, extra?: Record<string, unknown>) => {
    setIsLoading(action);
    setResults([]);
    try {
      const res = await fetch('/api/stocks/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password, ...extra }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.results) {
        setResults(data.results);
        const successes = data.results.filter((r: { success: boolean }) => r.success).length;
        toast.success(`${successes}/${data.results.length} operations succeeded`);
      } else if (data.message) {
        toast.success(data.message);
      }
    } catch {
      toast.error('Request failed');
    } finally {
      setIsLoading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm border-border/30 bg-card/50">
          <CardHeader className="text-center">
            <Shield className="mx-auto mb-2 h-8 w-8 text-primary" />
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter admin password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password) setIsAuthenticated(true);
              }}
            />
            <Button
              className="w-full"
              onClick={() => {
                if (password) setIsAuthenticated(true);
                else toast.error('Enter a password');
              }}
            >
              Authenticate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage stock data, refresh metrics, and maintain the database
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/30 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              Refresh All Stale
            </CardTitle>
            <CardDescription>
              Re-fetch metrics for all stale tickers (data older than 12 hours).
              2-hour cooldown between refreshes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => callApi('refresh_stale')}
              disabled={isLoading === 'refresh_stale'}
              className="w-full"
            >
              {isLoading === 'refresh_stale' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh All Stale Tickers
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Fetch New Stocks
            </CardTitle>
            <CardDescription>
              Add new tickers or refresh existing ones. Max 20 per request. 1-hour cooldown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={fetchInput}
              onChange={(e) => setFetchInput(e.target.value.toUpperCase())}
              placeholder="AAPL, MSFT, TSLA (comma-separated)"
            />
            <Button
              onClick={() => {
                const tickers = fetchInput
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                if (tickers.length === 0) {
                  toast.error('Enter at least one ticker');
                  return;
                }
                callApi('fetch_new', { tickers });
              }}
              disabled={isLoading === 'fetch_new'}
              className="w-full"
            >
              {isLoading === 'fetch_new' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Fetch Tickers
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Stocks
            </CardTitle>
            <CardDescription>
              Remove tickers and all their data. Max 5 per request. 5-minute cooldown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
              placeholder="TICKER1, TICKER2 (max 5)"
            />
            <Button
              variant="destructive"
              onClick={() => {
                const tickers = deleteInput
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                if (tickers.length === 0) {
                  toast.error('Enter at least one ticker');
                  return;
                }
                callApi('delete', { tickers });
              }}
              disabled={isLoading === 'delete'}
              className="w-full"
            >
              {isLoading === 'delete' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Tickers
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/30 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4" />
              Prune Old Metrics
            </CardTitle>
            <CardDescription>
              Remove metric fetches older than 7 days, keeping the most recent per ticker.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => callApi('prune')}
              disabled={isLoading === 'prune'}
              className="w-full"
            >
              {isLoading === 'prune' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Scissors className="mr-2 h-4 w-4" />
              )}
              Prune Old Metrics
            </Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card className="border-border/30 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border/20 px-3 py-2"
                >
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="font-medium">{r.ticker}</span>
                  {r.message && (
                    <span className="text-sm text-muted-foreground">{r.message}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
