import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuanticScreen – Your Personal Stock Research Dashboard',
  description:
    'A personal stock research dashboard with multi-factor scoring, smart flag analysis, preset strategies, and custom watchlists.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
