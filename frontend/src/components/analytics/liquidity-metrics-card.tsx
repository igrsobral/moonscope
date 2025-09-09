'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LiquidityMetricsCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger';
}

export function LiquidityMetricsCard({
  title,
  value,
  change,
  icon,
  variant = 'default',
}: LiquidityMetricsCardProps) {
  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </span>
    );
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'danger':
        return 'border-red-200 bg-red-50';
      default:
        return '';
    }
  };

  return (
    <Card className={getVariantStyles()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground">{formatPercentage(change)} from yesterday</p>
        )}
      </CardContent>
    </Card>
  );
}
