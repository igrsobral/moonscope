import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alerts - MemeAnalyzer',
  description: 'Manage your price alerts and notifications for meme coins.',
};

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground">
          Manage your price alerts and notifications for meme coins.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground">
          Alert management features will be implemented in the next tasks.
        </p>
      </div>
    </div>
  );
}
