'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity, ExternalLink } from 'lucide-react';
import { TrendingCoin } from '@/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface TrendingCoinsWidgetProps {
  title: string;
  coins: TrendingCoin[];
  type: 'gainers' | 'losers' | 'active';
}

export function TrendingCoinsWidget({ title, coins, type }: TrendingCoinsWidgetProps) {
  const getIcon = () => {
    switch (type) {
      case 'gainers':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'losers':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'active':
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toFixed(4)}`;
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={cn('text-sm font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </span>
    );
  };

  const formatVolume = (value: number) => {
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    }
    return `${value.toFixed(0)}`;
  };

  const getMetricValue = (coin: TrendingCoin) => {
    switch (type) {
      case 'gainers':
      case 'losers':
        return formatPercentage(coin.priceChange24h);
      case 'active':
        return `${formatVolume(coin.volumeChange24h)}% vol`;
    }
  };

  const getSecondaryMetric = (coin: TrendingCoin) => {
    switch (type) {
      case 'gainers':
      case 'losers':
        return `${coin.socialMentions} mentions`;
      case 'active':
        return `${coin.socialMentions} mentions`;
    }
  };

  if (!coins || coins.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {getIcon()}
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            <p>No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {getIcon()}
      </CardHeader>
      <CardContent className="space-y-3">
        {coins.slice(0, 5).map((trendingCoin, index) => {
          const { coin } = trendingCoin;
          return (
            <div key={coin.id} className="flex items-center justify-between space-x-3">
              <div className="flex min-w-0 flex-1 items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="truncate text-sm font-medium">{coin.symbol}</p>
                    <Badge variant="outline" className="text-xs">
                      {coin.network}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <div className="text-sm font-medium">
                  {coin.price ? formatPrice(coin.price.price) : 'N/A'}
                </div>
                <div className="flex items-center space-x-2">{getMetricValue(trendingCoin)}</div>
                <div className="text-xs text-muted-foreground">
                  {getSecondaryMetric(trendingCoin)}
                </div>
              </div>
              <Link href={`/coins/${coin.id}`}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          );
        })}

        {coins.length > 5 && (
          <div className="border-t pt-2">
            <Button variant="outline" size="sm" className="w-full">
              View All {title}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
