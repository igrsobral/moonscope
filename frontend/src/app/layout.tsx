import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Web3Provider } from '@/components/providers/web3-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meme Coin Analyzer',
  description: 'Comprehensive Web3 application for meme coin analysis and trading insights',
  keywords: ['crypto', 'meme coins', 'trading', 'web3', 'defi', 'analysis'],
  authors: [{ name: 'Meme Coin Analyzer Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system">
          <QueryProvider>
            <Web3Provider>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">
                  <div className="container py-6">{children}</div>
                </main>
                <Footer />
              </div>
            </Web3Provider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
