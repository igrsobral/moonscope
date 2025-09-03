import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Web3Provider } from '@/components/providers/web3-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Meme Coin Analyzer',
    template: '%s | Meme Coin Analyzer',
  },
  description: 'Comprehensive Web3 application for meme coin analysis and trading insights',
  keywords: ['crypto', 'meme coins', 'trading', 'web3', 'defi', 'analysis', 'portfolio', 'alerts'],
  authors: [{ name: 'Meme Coin Analyzer Team' }],
  creator: 'Meme Coin Analyzer Team',
  publisher: 'Meme Coin Analyzer',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://memeanalyzer.com',
    title: 'Meme Coin Analyzer',
    description: 'Comprehensive Web3 application for meme coin analysis and trading insights',
    siteName: 'Meme Coin Analyzer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meme Coin Analyzer',
    description: 'Comprehensive Web3 application for meme coin analysis and trading insights',
    creator: '@memeanalyzer',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
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
                <Toaster />
              </Web3Provider>
            </QueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
