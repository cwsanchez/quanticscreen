'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import StockDetail from '@/components/StockDetail';

export default function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const router = useRouter();

  return <StockDetail symbol={symbol} onBack={() => router.back()} />;
}
