import { NextRequest, NextResponse } from 'next/server';
import { searchTickers } from '@/lib/yahoo';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchTickers(query);
    return NextResponse.json(results);
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
