'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MarketOverviewDashboard,
  WhaleMovementTracker,
  LiquidityAnalysisCharts,
  CrossCoinCorrelationAnalysis,
  MarketSentimentOverview,
} from '@/components/analytics';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Advanced analytics and insights for meme coin markets.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Market Overview</TabsTrigger>
          <TabsTrigger value="whales">Whale Tracking</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity Analysis</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <MarketOverviewDashboard />
        </TabsContent>

        <TabsContent value="whales" className="space-y-6">
          <WhaleMovementTracker />
        </TabsContent>

        <TabsContent value="liquidity" className="space-y-6">
          <LiquidityAnalysisCharts />
        </TabsContent>

        <TabsContent value="correlation" className="space-y-6">
          <CrossCoinCorrelationAnalysis />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <MarketSentimentOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
