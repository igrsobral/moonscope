import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coins - MemeAnalyzer',
  description: 'Discover and analyze meme coins with real-time data and risk assessment.',
};

export default function CoinsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Coins</h1>
        <p className="text-muted-foreground">
          Discover and analyze meme coins with real-time data and risk assessment.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground">
          Coin discovery and analysis features will be implemented in the next tasks.
        </p>
      </div>
    </div>
  );
}
