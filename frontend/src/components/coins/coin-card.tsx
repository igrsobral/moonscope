'use client';

import { Badge, Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Coin } from '@/types';
import { AlertTriangle, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface CoinCardProps {
  coin: Coin;
  onClick?: (coin: Coin) => void;
}

export function CoinCard({ coin, onClick }: CoinCardProps) {
  const router = useRouter();
  const priceChange = coin.price?.priceChange24h || 0;
  const isPositive = priceChange >= 0;
  const riskScore = coin.risk?.overallScore || 0;

  const handleClick = () => {
    if (onClick) {
      onClick(coin);
    } else {
      router.push(`/coins/${coin.id}`);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-700' };
    if (score >= 60)
      return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'High', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  const risk = getRiskLevel(riskScore);

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
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
        onClick && 'hover:bg-accent/50'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {coin.logoUrl ? (
              <Image
                src={coin.logoUrl}
                alt={coin.name}
                className="h-10 w-10 rounded-full"
                onError={e => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-sm font-bold text-white">
                {coin.symbol.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">{coin.symbol.toUpperCase()}</h3>
              <p className="max-w-[120px] truncate text-xs text-muted-foreground">{coin.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {coin.network.toUpperCase()}
            </Badge>
            {coin.contractVerified && <Shield className="h-4 w-4 text-green-500" />}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">
              {coin.price ? formatPrice(coin.price.price) : 'N/A'}
            </span>
            <div
              className={cn(
                'flex items-center space-x-1 text-sm font-medium',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="block">Market Cap</span>
              <span className="font-medium text-foreground">
                {coin.price ? formatMarketCap(coin.price.marketCap) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="block">Volume 24h</span>
              <span className="font-medium text-foreground">
                {coin.price ? formatVolume(coin.price.volume24h) : 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Risk Score</span>
              {riskScore < 40 && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="flex items-center space-x-2">
              <div className={cn('h-2 w-2 rounded-full', risk.color)} />
              <span className={cn('text-xs font-medium', risk.textColor)}>
                {risk.level} ({riskScore}/100)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
