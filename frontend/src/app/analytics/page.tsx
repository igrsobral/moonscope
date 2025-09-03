import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics - MemeAnalyzer',
  description: 'Advanced analytics and insights for meme coin markets.',
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Advanced analytics and insights for meme coin markets.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground">
          Advanced analytics features will be implemented in the next tasks.
        </p>
      </div>
    </div>
  );
}
