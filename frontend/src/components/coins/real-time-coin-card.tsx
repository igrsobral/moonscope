'use client';

import { useEffect, useState } from 'react';
import { CoinCard } from './coin-card';
import { useRealTimePrice } from '@/hooks/use-real-time-price';
import { Coin } from '@/types';
import { cn } from '@/lib/utils';

interface RealTimeCoinCardProps {
  coin: Coin;
  onClick?: (coin: Coin) => void;
}

export function RealTimeCoinCard({ coin, onClick }: RealTimeCoinCardProps) {
  const { priceData, lastUpdate } = useRealTimePrice(coin.id.toString());
  const [isUpdating, setIsUpdating] = useState(false);
  const [priceChangeAnimation, setPriceChangeAnimation] = useState<'up' | 'down' | null>(null);

  // Create updated coin object with real-time price data
  const updatedCoin: Coin = {
    ...coin,
    ...(priceData && { price: priceData }),
  };

  // Handle price change animations
  useEffect(() => {
    if (priceData && coin.price) {
      const oldPrice = coin.price.price;
      const newPrice = priceData.price;

      if (newPrice > oldPrice) {
        setPriceChangeAnimation('up');
      } else if (newPrice < oldPrice) {
        setPriceChangeAnimation('down');
      }

      setIsUpdating(true);

      // Clear animation after a short delay
      const timer = setTimeout(() => {
        setPriceChangeAnimation(null);
        setIsUpdating(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [priceData, coin.price]);

  return (
    <div
      className={cn(
        'transition-all duration-300',
        isUpdating && 'ring-2 ring-blue-500/50',
        priceChangeAnimation === 'up' && 'bg-green-50 dark:bg-green-950/20',
        priceChangeAnimation === 'down' && 'bg-red-50 dark:bg-red-950/20'
      )}
    >
      <CoinCard coin={updatedCoin} {...(onClick && { onClick })} />
      {lastUpdate && (
        <div className="px-4 pb-2">
          <div className="text-xs text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
