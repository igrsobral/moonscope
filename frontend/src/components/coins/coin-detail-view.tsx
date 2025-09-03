'use client';

import { useCoin } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle, Badge, LoadingState } from '@/components/ui';
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PriceChart } from './price-chart';
import { RiskAssessmentDisplay } from './risk-assessment-display';
import { SocialMetricsDashboard } from './social-metrics-dashboard';
import { cn } from '@/lib/utils';

interface CoinDetailViewProps {
  coinId: string;
}

export function CoinDetailView({ coinId }: CoinDetailViewProps) {
  const router = useRouter();
  const { data: coin, isLoading, error } = useCoin(coinId);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState size="lg" />
      </div>
    );
  }

  if (error || !coin) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Coin not found</h2>
        <p className="text-muted-foreground">The requested coin could not be found.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Go back</span>
        </button>
      </div>
    );
  }

  const priceChange = coin.price?.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toFixed(4)}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    }
    if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    }
    if (marketCap >= 1e3) {
      return `$${(marketCap / 1e3).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    }
    if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 items-center space-x-4">
          {coin.logoUrl ? (
            <img
              src={coin.logoUrl}
              alt={coin.name}
              className="h-12 w-12 rounded-full"
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-lg font-bold text-white">
              {coin.symbol.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold">{coin.name}</h1>
              <Badge variant="outline" className="text-sm">
                {coin.symbol.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-sm">
                {coin.network.toUpperCase()}
              </Badge>
              {coin.contractVerified && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Verified</span>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold">
                  {coin.price ? formatPrice(coin.price.price) : 'N/A'}
                </span>
                <div
                  className={cn(
                    'flex items-center space-x-1 text-lg font-medium',
                    isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  <span>
                    {isPositive ? '+' : ''}
                    {priceChange.toFixed(2)}%
                  </span>
                </div>
              </div>

              {coin.website && (
                <a
                  href={coin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm">Website</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coin.price ? formatMarketCap(coin.price.marketCap) : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coin.price ? formatVolume(coin.price.volume24h) : 'N/A'}
            </div>
            <div
              className={cn(
                'text-sm',
                coin.price && coin.price.volumeChange24h >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {coin.price && coin.price.volumeChange24h >= 0 ? '+' : ''}
              {coin.price?.volumeChange24h?.toFixed(2) || 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Liquidity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coin.price ? formatVolume(coin.price.liquidity) : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Price Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart coinId={coinId} />
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskAssessmentDisplay coin={coin} />
          </CardContent>
        </Card>

        {/* Social Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Social Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <SocialMetricsDashboard coin={coin} />
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {coin.description && (
        <Card>
          <CardHeader>
            <CardTitle>About {coin.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-muted-foreground">{coin.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
