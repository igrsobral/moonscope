import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Bell, Shield, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="space-y-6 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Meme Coin Analysis
            <span className="text-primary"> Made Simple</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Real-time price tracking, risk assessment, social sentiment analysis, and portfolio
            management for meme coins across multiple blockchain networks.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/coins">
              Explore Coins <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/portfolio">View Portfolio</Link>
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
          <div className="mb-4 flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Real-time Data</h3>
          </div>
          <p className="text-muted-foreground">
            Live price updates, market metrics, and trading volume across multiple DEXs.
          </p>
        </div>

        <div className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
          <div className="mb-4 flex items-center space-x-2">
            <Shield className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Risk Analysis</h3>
          </div>
          <p className="text-muted-foreground">
            Advanced risk scoring based on liquidity, holder distribution, and contract security.
          </p>
        </div>

        <div className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
          <div className="mb-4 flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Social Sentiment</h3>
          </div>
          <p className="text-muted-foreground">
            Track community sentiment across Twitter, Reddit, and Telegram.
          </p>
        </div>

        <div className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
          <div className="mb-4 flex items-center space-x-2">
            <Bell className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Smart Alerts</h3>
          </div>
          <p className="text-muted-foreground">
            Automated portfolio detection and performance analytics with Web3 integration.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="rounded-lg border bg-card p-8">
        <div className="mb-8 space-y-4 text-center">
          <h2 className="text-3xl font-bold">Platform Statistics</h2>
          <p className="text-muted-foreground">
            Real-time metrics from our meme coin analysis platform
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2 text-center">
            <div className="text-3xl font-bold text-primary">0</div>
            <div className="text-sm text-muted-foreground">Coins Tracked</div>
          </div>
          <div className="space-y-2 text-center">
            <div className="text-3xl font-bold text-primary">0</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
          <div className="space-y-2 text-center">
            <div className="text-3xl font-bold text-primary">0</div>
            <div className="text-sm text-muted-foreground">Alerts Sent</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="space-y-6 py-12 text-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Ready to Start Analyzing?</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Join thousands of traders who trust MemeAnalyzer for their meme coin investments.
          </p>
        </div>

        <Button asChild size="lg">
          <Link href="/coins">
            Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
