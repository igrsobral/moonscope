'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Portfolio } from '@/types';
import {
  ArrowUpDown,
  Edit,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

interface PortfolioHoldingsListProps {
  portfolioData: Portfolio[];
  onEditHolding: (holding: Portfolio) => void;
  onDeleteHolding: (holdingId: number) => void;
  onViewCoinDetails: (coinId: number) => void;
}

type SortOption = 'value' | 'profitLoss' | 'profitLossPercentage' | 'allocation' | 'symbol';
type SortOrder = 'asc' | 'desc';

export function PortfolioHoldingsList({
  portfolioData,
  onEditHolding,
  onDeleteHolding,
  onViewCoinDetails,
}: PortfolioHoldingsListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);

  const sortedHoldings = [...portfolioData].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (sortBy) {
      case 'value':
        aValue = a.currentValue;
        bValue = b.currentValue;
        break;
      case 'profitLoss':
        aValue = a.profitLoss;
        bValue = b.profitLoss;
        break;
      case 'profitLossPercentage':
        aValue = a.profitLossPercentage;
        bValue = b.profitLossPercentage;
        break;
      case 'allocation':
        aValue = totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
        bValue = totalValue > 0 ? (b.currentValue / totalValue) * 100 : 0;
        break;
      case 'symbol':
        aValue = a.coin?.symbol || 'Unknown';
        bValue = b.coin?.symbol || 'Unknown';
        break;
      default:
        aValue = a.currentValue;
        bValue = b.currentValue;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    const numA = typeof aValue === 'number' ? aValue : 0;
    const numB = typeof bValue === 'number' ? bValue : 0;

    return sortOrder === 'asc' ? numA - numB : numB - numA;
  });

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

  // const toggleSort = (option: SortOption) => {
  //   if (sortBy === option) {
  //     setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  //   } else {
  //     setSortBy(option);
  //     setSortOrder('desc');
  //   }
  // };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="value">Current Value</SelectItem>
              <SelectItem value="profitLoss">Profit/Loss</SelectItem>
              <SelectItem value="profitLossPercentage">P&L %</SelectItem>
              <SelectItem value="allocation">Allocation</SelectItem>
              <SelectItem value="symbol">Symbol</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('card')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      {/* Holdings List */}
      {viewMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedHoldings.map(holding => {
            const allocation = calculateAllocation(holding);
            const isPositive = holding.profitLoss >= 0;

            return (
              <Card key={holding.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-lg">
                          {holding.coin?.symbol || 'Unknown'}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {holding.coin?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewCoinDetails(holding.coinId)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditHolding(holding)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteHolding(holding.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>
                      <div className="font-medium">{holding.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Price:</span>
                      <div className="font-medium">${holding.avgPrice.toFixed(6)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Value:</span>
                      <div className="font-medium">{formatCurrency(holding.currentValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Allocation:</span>
                      <div className="font-medium">{allocation.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span
                        className={cn(
                          'font-medium',
                          isPositive ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {formatCurrency(Math.abs(holding.profitLoss))}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(isPositive ? 'text-green-600' : 'text-red-600')}
                    >
                      {formatPercentage(holding.profitLossPercentage)}
                    </Badge>
                  </div>

                  <Badge variant="outline" className="w-fit">
                    {holding.coin?.network || 'Unknown'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left font-medium">Asset</th>
                    <th className="p-4 text-right font-medium">Amount</th>
                    <th className="p-4 text-right font-medium">Avg Price</th>
                    <th className="p-4 text-right font-medium">Current Value</th>
                    <th className="p-4 text-right font-medium">P&L</th>
                    <th className="p-4 text-right font-medium">Allocation</th>
                    <th className="p-4 text-center font-medium">Network</th>
                    <th className="p-4 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map(holding => {
                    const allocation = calculateAllocation(holding);
                    const isPositive = holding.profitLoss >= 0;

                    return (
                      <tr key={holding.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{holding.coin?.symbol || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">
                              {holding.coin?.name || 'Unknown'}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">{holding.amount.toLocaleString()}</td>
                        <td className="p-4 text-right">${holding.avgPrice.toFixed(6)}</td>
                        <td className="p-4 text-right font-medium">
                          {formatCurrency(holding.currentValue)}
                        </td>
                        <td className="p-4 text-right">
                          <div
                            className={cn(
                              'font-medium',
                              isPositive ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {formatCurrency(Math.abs(holding.profitLoss))}
                          </div>
                          <div
                            className={cn(
                              'text-sm',
                              isPositive ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {formatPercentage(holding.profitLossPercentage)}
                          </div>
                        </td>
                        <td className="p-4 text-right">{allocation.toFixed(1)}%</td>
                        <td className="p-4 text-center">
                          <Badge variant="outline">{holding.coin?.network || 'Unknown'}</Badge>
                        </td>
                        <td className="p-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewCoinDetails(holding.coinId)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEditHolding(holding)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDeleteHolding(holding.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedHoldings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No holdings found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
