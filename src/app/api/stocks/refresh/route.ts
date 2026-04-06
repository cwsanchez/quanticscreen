import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchStockMetrics } from '@/lib/yahoo';
import {
  saveMetrics,
  getStaleTickers,
  getLatestMetrics,
  pruneOldMetrics,
  getMetadata,
  setMetadata,
  getAllTickers,
  deleteStock,
} from '@/lib/db';
import { sleep, randomInt, isValidTicker } from '@/lib/utils';
import { getServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const body = await request.json();
  const { action, password, tickers } = body as {
    action: string;
    password?: string;
    tickers?: string[];
  };

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    switch (action) {
      case 'refresh_stale': {
        const lastRefresh = await getMetadata('last_manual_refresh');
        if (lastRefresh) {
          const elapsed = Date.now() - new Date(lastRefresh).getTime();
          if (elapsed < 7200000) {
            const remaining = Math.ceil((7200000 - elapsed) / 60000);
            return NextResponse.json({
              error: `Cooldown active. Wait ${remaining} minutes.`,
            });
          }
        }

        await setMetadata('last_manual_refresh', new Date().toISOString());
        const stale = await getStaleTickers();

        if (stale.length === 0) {
          return NextResponse.json({ message: 'No stale tickers found.', count: 0 });
        }

        let refreshed = 0;
        const batchSize = randomInt(5, 10);

        for (let i = 0; i < stale.length; i += batchSize) {
          const batch = stale.slice(i, i + batchSize);
          for (const t of batch) {
            try {
              const metrics = await fetchStockMetrics(t);
              if (metrics) {
                await saveMetrics(metrics);
                refreshed++;
              }
            } catch (e) {
              console.error(`Refresh error for ${t}:`, e);
            }
            await sleep(randomInt(5000, 10000));
          }
          await sleep(randomInt(5000, 10000));
        }

        await pruneOldMetrics();
        return NextResponse.json({
          message: `Refreshed ${refreshed}/${stale.length} tickers.`,
          count: refreshed,
        });
      }

      case 'fetch_new': {
        if (!tickers || tickers.length === 0) {
          return NextResponse.json({ error: 'No tickers provided' });
        }
        if (tickers.length > 20) {
          return NextResponse.json({ error: 'Max 20 tickers at a time' });
        }

        const invalid = tickers.filter((t) => !isValidTicker(t));
        if (invalid.length > 0) {
          return NextResponse.json({
            error: `Invalid ticker format: ${invalid.join(', ')}`,
          });
        }

        const lastFetchNew = await getMetadata('last_fetch_new');
        if (lastFetchNew) {
          const elapsed = Date.now() - new Date(lastFetchNew).getTime();
          if (elapsed < 3600000) {
            return NextResponse.json({
              error: 'Rate limit: once per hour for new tickers.',
            });
          }
        }

        await setMetadata('last_fetch_new', new Date().toISOString());
        const results: Array<{ ticker: string; success: boolean; message: string }> = [];
        const sb = getServiceClient();

        for (const ticker of tickers) {
          try {
            const metrics = await fetchStockMetrics(ticker);
            if (metrics) {
              await sb.from('stocks').upsert(
                {
                  ticker,
                  company_name: metrics['Company Name'] ?? 'N/A',
                  industry: metrics.Industry ?? 'N/A',
                  sector: metrics.Sector ?? 'N/A',
                },
                { onConflict: 'ticker' }
              );
              await saveMetrics(metrics);
              results.push({ ticker, success: true, message: 'Added/refreshed' });
            } else {
              results.push({ ticker, success: false, message: 'Fetch failed' });
            }
          } catch (e) {
            results.push({ ticker, success: false, message: String(e) });
          }
          await sleep(randomInt(5000, 10000));
        }

        return NextResponse.json({ results });
      }

      case 'delete': {
        if (!tickers || tickers.length === 0) {
          return NextResponse.json({ error: 'No tickers provided' });
        }
        if (tickers.length > 5) {
          return NextResponse.json({ error: 'Max 5 tickers at a time' });
        }

        const lastDelete = await getMetadata('last_delete');
        if (lastDelete) {
          const elapsed = Date.now() - new Date(lastDelete).getTime();
          if (elapsed < 300000) {
            return NextResponse.json({
              error: 'Rate limit: 5 minute cooldown for deletes.',
            });
          }
        }

        await setMetadata('last_delete', new Date().toISOString());
        const deleteResults: Array<{ ticker: string; success: boolean }> = [];

        for (const ticker of tickers) {
          try {
            await deleteStock(ticker);
            deleteResults.push({ ticker, success: true });
          } catch (e) {
            console.error(`Delete error for ${ticker}:`, e);
            deleteResults.push({ ticker, success: false });
          }
        }

        return NextResponse.json({ results: deleteResults });
      }

      case 'prune': {
        const count = await pruneOldMetrics();
        return NextResponse.json({ message: `Pruned ${count} old metrics.` });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Admin action error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
