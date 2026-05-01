import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchPriceHistory } from '@/lib/yahoo';
import { getPriceHistory, savePriceHistory } from '@/lib/db';

// Ranges we support. Short/intraday ranges are always fetched fresh; daily
// ranges fall back to the cached history when available.
const DAILY_OR_LONGER = new Set(['1M', '3M', '6M', '1Y', '5Y', 'Max']);
const INTRADAY = new Set(['1D', '1W']);

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const rangeRaw = request.nextUrl.searchParams.get('range') ?? '1Y';
  const range = rangeRaw.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  const upper = ticker.toUpperCase();

  try {
    if (INTRADAY.has(range)) {
      const history = await fetchPriceHistory(upper, range);
      return NextResponse.json({ history, range, fresh: true });
    }

    if (DAILY_OR_LONGER.has(range)) {
      // For 1M/3M/6M/1Y we can reuse the cached 1Y daily history (since it's a
      // superset), but for 5Y/Max we always fetch live because the cache is
      // only 1Y of data.
      if (range !== '5Y' && range !== 'Max') {
        const cached = await getPriceHistory(upper);
        if (cached && cached.length > 0) {
          return NextResponse.json({ history: cached, range, fresh: false });
        }
      }

      const history = await fetchPriceHistory(upper, range);
      if (history.length > 0 && (range === '1Y' || range === '1M' || range === '3M' || range === '6M')) {
        // Store a 1Y-sized cache when we fetch any daily range so future 1M/3M/6M
        // can be served from the cache too.
        try {
          await savePriceHistory(upper, history);
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json({ history, range, fresh: true });
    }

    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  } catch (err) {
    console.error('History endpoint error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
