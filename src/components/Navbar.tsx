'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Sliders,
  Sparkles,
  Home,
  Menu,
  X,
  Scale,
} from 'lucide-react';
import { useState } from 'react';
import { GlobalSearch } from '@/components/GlobalSearch';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home, exact: true },
  { href: '/compare', label: 'Compare', icon: Scale, exact: false },
  { href: '/ai', label: 'AI Ratings', icon: Sparkles, exact: false },
  { href: '/screener', label: 'Screener', icon: BarChart3, exact: false },
  { href: '/builder', label: 'Builder', icon: Sliders, exact: false },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-bold tracking-tight">
              Quantic<span className="text-primary">Screen</span>
            </span>
          </Link>

          {/* Inline global search — expands to fill available room */}
          <div className="hidden sm:flex flex-1 max-w-sm md:max-w-md lg:max-w-lg">
            <GlobalSearch variant="navbar" className="w-full" />
          </div>

          <div className="ml-auto hidden md:flex md:items-center md:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <button
            className="md:hidden p-2 rounded-md hover:bg-accent ml-auto"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile-only search bar (shown below brand + menu toggle) */}
        <div className="pb-3 sm:hidden">
          <GlobalSearch variant="navbar" className="w-full" />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
