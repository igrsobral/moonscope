'use client';

import { useEffect, useState } from 'react';
import { useRealTimePortfolio } from '@/hooks/use-real-time-portfolio';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RealTimePortfolioValueProps {
  userId?: string;
  initialValue?: number;
  initialProfitLoss?: number;
  initialProfitLossPercentage?: number;
}

export function RealTimePortfolioValue({
  userId,
  initialValue = 0,
  initialProfitLoss = 0,
  initialProfitLossPercentage = 0,
}: RealTimePortfolioValueProps) {
  const { totalValue, totalProfitLoss, totalProfitLossPercentage, lastUpdate } =
    useRealTimePortfolio(userId);

  const [valueChangeAnimation, setValueChangeAnimation] = useState<'up' | 'down' | null>(null);
  const [previousValue, setPreviousValue] = useState(initialValue);

  const currentValue = totalValue || initialValue;
  const currentProfitLoss = totalProfitLoss || initialProfitLoss;
  const currentProfitLossPercentage = totalProfitLossPercentage || initialProfitLossPercentage;
  const isPositive = currentProfitLoss >= 0;

  // Handle value change animations
  useEffect(() => {
    if (totalValue && previousValue !== currentValue) {
      if (currentValue > previousValue) {
        setValueChangeAnimation('up');
      } else if (currentValue < previousValue) {
        setValueChangeAnimation('down');
      }

      setPreviousValue(currentValue);

      // Clear animation after a short delay
      const timer = setTimeout(() => {
        setValueChangeAnimation(null);
      }, 1500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentValue, previousValue, totalValue]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card
      className={cn(
        'transition-all duration-500',
        valueChangeAnimation === 'up' &&
          'bg-green-50 ring-2 ring-green-500/50 dark:bg-green-950/20',
        valueChangeAnimation === 'down' && 'bg-red-50 ring-2 ring-red-500/50 dark:bg-red-950/20'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div
            className={cn(
              'text-2xl font-bold transition-all duration-300',
              valueChangeAnimation === 'up' && 'scale-105 text-green-600',
              valueChangeAnimation === 'down' && 'scale-105 text-red-600'
            )}
          >
            {formatCurrency(currentValue)}
          </div>

          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>
              {formatCurrency(Math.abs(currentProfitLoss))} ({isPositive ? '+' : ''}
              {currentProfitLossPercentage.toFixed(2)}%)
            </span>
          </div>

          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
