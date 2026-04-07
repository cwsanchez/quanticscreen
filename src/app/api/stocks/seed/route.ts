import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getServiceClient } from '@/lib/supabase';
import { DEFAULT_TICKERS } from '@/lib/tickers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceClient();

  const { data: existing } = await sb.from('stocks').select('ticker');
  const existingSet = new Set(existing?.map((s) => s.ticker) ?? []);

  const toInsert = DEFAULT_TICKERS
    .filter((t) => !existingSet.has(t))
    .map((ticker) => ({
      ticker,
      company_name: 'N/A',
      industry: 'N/A',
      sector: 'N/A',
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: 'All tickers already seeded.', added: 0 });
  }

  const batchSize = 100;
  let added = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await sb
      .from('stocks')
      .upsert(batch, { onConflict: 'ticker' });
    if (!error) added += batch.length;
  }

  return NextResponse.json({
    message: `Seeded ${added} new tickers. Metrics will be fetched on next cron run or when searched.`,
    added,
  });
}
