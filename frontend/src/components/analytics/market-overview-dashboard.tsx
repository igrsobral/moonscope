'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { TrendingCoin } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingCoinsWidget } from './trending-coins-widget';

interface MarketOverviewData {
  totalMarketCap: number;
  totalVolume24h: number;
  activeCoins: number;
  marketCapChange24h: number;
  volumeChange24h: number;
  topGainers: TrendingCoin[];
  topLosers: TrendingCoin[];
  mostActive: TrendingCoin[];
}

type TimeFrame = '24h' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

export function MarketOverviewDashboard() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');

  const {
    data: marketData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['market-overview', timeFrame],
    queryFn: async () => {
      const response = await apiClient.get<MarketOverviewData>(
        `/api/v1/analytics/market-overview?timeframe=${timeFrame}`
      );
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Market Overview</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <LoadingState />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !marketData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>Failed to load market overview data</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Market Overview</h2>
          <p className="text-muted-foreground">
            Real-time market statistics and trending meme coins
          </p>
        </div>
        <div className="flex space-x-1">
          {timeFrameOptions.map(option => (
            <Button
              key={option.value}
              variant={timeFrame === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeFrame(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Market Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Market Cap</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(marketData.totalMarketCap)}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(marketData.marketCapChange24h)} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(marketData.totalVolume24h)}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(marketData.volumeChange24h)} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketData.activeCoins.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Tracked meme coins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Trend</CardTitle>
            {marketData.marketCapChange24h >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData.marketCapChange24h >= 0 ? 'Bullish' : 'Bearish'}
            </div>
            <p className="text-xs text-muted-foreground">Based on {timeFrame} performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Trending Coins Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TrendingCoinsWidget
          title="Top Gainers"
          coins={marketData.topGainers}
          type="gainers"
          timeFrame={timeFrame}
        />
        <TrendingCoinsWidget
          title="Top Losers"
          coins={marketData.topLosers}
          type="losers"
          timeFrame={timeFrame}
        />
        <TrendingCoinsWidget
          title="Most Active"
          coins={marketData.mostActive}
          type="active"
          timeFrame={timeFrame}
        />
      </div>
    </div>
  );
}
