'use client';

import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  BarChart3,
  Zap,
  Sparkles,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WatchlistSidebar } from '@/components/WatchlistSidebar';
import { GlobalSearch } from '@/components/GlobalSearch';

export default function HomePage() {
  const router = useRouter();

  const handleSelect = (symbol: string) => {
    router.push(`/ticker/${symbol}`);
  };

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

        <div className="mt-8 w-full max-w-2xl">
          <GlobalSearch variant="hero" autoFocus onSelect={handleSelect} />
        </div>

        <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Scale,
              title: 'Side-by-Side Compare',
              desc: 'Line up 2 – 4 stocks with price, ranges, factor scores, AI verdicts, news, and flags.',
            },
            {
              icon: BarChart3,
              title: 'Multi-Factor Scoring',
              desc: 'Weighted scoring across 8+ fundamental metrics with Value, Growth, Momentum, and Quality boosts.',
            },
            {
              icon: Sparkles,
              title: 'xAI Grok Analysis',
              desc: 'Every stock gets an AI-generated research note with bull / bear cases, sentiment, and a verdict.',
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
          <Button size="lg" onClick={() => router.push('/compare')}>
            <Scale className="mr-2 h-4 w-4" />
            Compare Stocks
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/ai')}>
            <Sparkles className="mr-2 h-4 w-4" />
            Browse AI Ratings
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push('/screener')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Open Screener
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
