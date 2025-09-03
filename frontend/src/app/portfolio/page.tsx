import { Metadata } from 'next';

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

      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground">
          Portfolio management features will be implemented in the next tasks.
        </p>
      </div>
    </div>
  );
}
