import { Metadata } from 'next';
import { CoinGrid } from '@/components/coins';

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

      <CoinGrid />
    </div>
  );
}
