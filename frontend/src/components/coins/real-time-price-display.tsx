'use client';

import { useEffect, useState } from 'react';
import { useRealTimePrice } from '@/hooks/use-real-time-price';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimePriceDisplayProps {
  coinId: string;
  initialPrice?: number;
  initialChange?: number;
  className?: string;
  showChange?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RealTimePriceDisplay({
  coinId,
  initialPrice = 0,
  initialChange = 0,
  className,
  showChange = true,
  size = 'md',
}: RealTimePriceDisplayProps) {
  const { priceData, lastUpdate } = useRealTimePrice(coinId);
  const [priceChangeAnimation, setPriceChangeAnimation] = useState<'up' | 'down' | null>(null);
  const [previousPrice, setPreviousPrice] = useState(initialPrice);

  const currentPrice = priceData?.price || initialPrice;
  const currentChange = priceData?.priceChange24h || initialChange;
  const isPositive = currentChange >= 0;

  // Handle price change animations
  useEffect(() => {
    if (priceData && previousPrice !== currentPrice) {
      if (currentPrice > previousPrice) {
        setPriceChangeAnimation('up');
      } else if (currentPrice < previousPrice) {
        setPriceChangeAnimation('down');
      }

      setPreviousPrice(currentPrice);

      // Clear animation after a short delay
      const timer = setTimeout(() => {
        setPriceChangeAnimation(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentPrice, previousPrice, priceData]);

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toFixed(4)}`;
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          price: 'text-sm font-semibold',
          change: 'text-xs',
          icon: 'h-3 w-3',
        };
      case 'lg':
        return {
          price: 'text-2xl font-bold',
          change: 'text-base',
          icon: 'h-5 w-5',
        };
      default:
        return {
          price: 'text-lg font-semibold',
          change: 'text-sm',
          icon: 'h-4 w-4',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          sizeClasses.price,
          'transition-all duration-300',
          priceChangeAnimation === 'up' && 'scale-105 text-green-600',
          priceChangeAnimation === 'down' && 'scale-105 text-red-600'
        )}
      >
        {formatPrice(currentPrice)}
      </span>

      {showChange && (
        <div
          className={cn(
            'flex items-center gap-1 font-medium transition-colors',
            sizeClasses.change,
            isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isPositive ? (
            <TrendingUp className={sizeClasses.icon} />
          ) : (
            <TrendingDown className={sizeClasses.icon} />
          )}
          <span>
            {isPositive ? '+' : ''}
            {currentChange.toFixed(2)}%
          </span>
        </div>
      )}

      {lastUpdate && (
        <div className="text-xs text-muted-foreground">{lastUpdate.toLocaleTimeString()}</div>
      )}
    </div>
  );
}
