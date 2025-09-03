'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Portfolio } from '@/types';
import {
  BarChart3,
  DollarSign,
  Download,
  PieChart,
  Plus,
  Share2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface PortfolioOverviewProps {
  portfolioData: Portfolio[];
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  onAddHolding: () => void;
  onExport: (format: 'csv' | 'json') => void;
  onShare: () => void;
}

export function PortfolioOverview({
  portfolioData,
  totalValue,
  totalProfitLoss,
  totalProfitLossPercentage,
  onAddHolding,
  onExport,
  onShare,
}: PortfolioOverviewProps) {
  // const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const isPositive = totalProfitLoss >= 0;
  const topPerformers = portfolioData
    .filter(p => p.profitLossPercentage > 0)
    .sort((a, b) => b.profitLossPercentage - a.profitLossPercentage)
    .slice(0, 3);

  const worstPerformers = portfolioData
    .filter(p => p.profitLossPercentage < 0)
    .sort((a, b) => a.profitLossPercentage - b.profitLossPercentage)
    .slice(0, 3);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const calculateAllocation = (holding: Portfolio) => {
    return totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Portfolio Overview</h2>
          <p className="text-muted-foreground">Track your meme coin investments and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('json')}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button onClick={onAddHolding}>
            <Plus className="mr-2 h-4 w-4" />
            Add Holding
          </Button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn('text-2xl font-bold', isPositive ? 'text-green-600' : 'text-red-600')}
            >
              {formatCurrency(Math.abs(totalProfitLoss))}
            </div>
            <p className={cn('text-xs', isPositive ? 'text-green-600' : 'text-red-600')}>
              {formatPercentage(totalProfitLossPercentage)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioData.length}</div>
            <p className="text-xs text-muted-foreground">Active positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {topPerformers.length > 0 ? (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(topPerformers?.[0]?.profitLossPercentage || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {topPerformers?.[0]?.coin?.symbol || 0 || 'Unknown'}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top and Worst Performers */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.length > 0 ? (
              topPerformers.map(holding => (
                <div key={holding.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{holding.coin?.symbol || 'Unknown'}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(holding.currentValue)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-green-600">
                    {formatPercentage(holding.profitLossPercentage)}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No profitable positions</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Worst Performers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {worstPerformers.length > 0 ? (
              worstPerformers.map(holding => (
                <div key={holding.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{holding.coin?.symbol || 'Unknown'}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(holding.currentValue)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-red-600">
                    {formatPercentage(holding.profitLossPercentage)}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No losing positions</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {portfolioData.map(holding => {
            const allocation = calculateAllocation(holding);
            return (
              <div key={holding.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{holding.coin?.symbol || 'Unknown'}</span>
                    <span className="text-sm text-muted-foreground">
                      {holding.amount.toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{allocation.toFixed(1)}%</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(holding.currentValue)}
                    </span>
                  </div>
                </div>
                <Progress value={allocation} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
