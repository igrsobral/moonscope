import { Metadata } from 'next';
import { RealTimePortfolioValue } from '@/components/portfolio/real-time-portfolio-value';

export const metadata: Metadata = {
  title: 'Portfolio - MemeAnalyzer',
  description: 'Track your meme coin portfolio performance and analytics.',
};

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Track your meme coin portfolio performance and analytics.
        </p>
      </div>

      {/* Real-time Portfolio Value */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <RealTimePortfolioValue
          userId="demo-user" // TODO: add userId from auth
          initialValue={0}
          initialProfitLoss={0}
          initialProfitLossPercentage={0}
        />

        <div className="md:col-span-2">
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold">Portfolio Holdings</h2>
            <p className="text-muted-foreground">
              Portfolio management features will be implemented in the next tasks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
