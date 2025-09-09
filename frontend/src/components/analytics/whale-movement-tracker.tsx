'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Fish, TrendingUp, ArrowUpRight, ExternalLink, Filter } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { WhaleTransaction } from '@/types';

import { WhaleTransactionsList } from './whale-transactions-list';

interface WhaleMovementData {
  recentTransactions: WhaleTransaction[];
  topFishs: {
    address: string;
    totalValue: number;
    transactionCount: number;
    coins: string[];
  }[];
  marketImpact: {
    priceImpactTransactions: WhaleTransaction[];
    totalImpactValue: number;
  };
  statistics: {
    totalTransactions24h: number;
    totalValue24h: number;
    averageTransactionSize: number;
    uniqueFishs: number;
  };
}

type TimeFrame = '1h' | '24h' | '7d';
type TransactionType = 'all' | 'buy' | 'sell';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
];

export function WhaleMovementTracker() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');
  const [transactionType] = useState<TransactionType>('all');

  const {
    data: whaleData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['whale-movements', timeFrame, transactionType],
    queryFn: async () => {
      const response = await apiClient.get<WhaleMovementData>(
        `/api/v1/analytics/whale-movements?timeframe=${timeFrame}&type=${transactionType}`
      );
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <Fish className="h-6 w-6" />
            <span>Fish Movement Tracker</span>
          </h2>
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

  if (error || !whaleData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>Failed to load whale movement data</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <Fish className="h-6 w-6" />
            <span>Fish Movement Tracker</span>
          </h2>
          <p className="text-muted-foreground">
            Monitor large transactions and whale activity across meme coins
          </p>
        </div>
        <div className="flex items-center space-x-2">
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
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {whaleData.statistics.totalTransactions24h.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">In the last {timeFrame}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(whaleData.statistics.totalValue24h)}
            </div>
            <p className="text-xs text-muted-foreground">Fish transaction volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(whaleData.statistics.averageTransactionSize)}
            </div>
            <p className="text-xs text-muted-foreground">Average whale transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Fishs</CardTitle>
            <Fish className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {whaleData.statistics.uniqueFishs.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Unique whale addresses</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="whales">Top Fishs</TabsTrigger>
          <TabsTrigger value="impact">Market Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <WhaleTransactionsList
            transactions={whaleData.recentTransactions}
            title="Recent Whale Transactions"
          />
        </TabsContent>

        <TabsContent value="whales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Fish Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {whaleData.topFishs.map((whale, index) => (
                  <div
                    key={whale.address}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{formatAddress(whale.address)}</p>
                        <p className="text-sm text-muted-foreground">
                          {whale.transactionCount} transactions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(whale.totalValue)}</p>
                      <div className="flex space-x-1">
                        {whale.coins.slice(0, 3).map((coin, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {coin}
                          </Badge>
                        ))}
                        {whale.coins.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{whale.coins.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>High Impact Transactions</span>
                <Badge variant="destructive">
                  {formatCurrency(whaleData.marketImpact.totalImpactValue)} impact
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WhaleTransactionsList
                transactions={whaleData.marketImpact.priceImpactTransactions}
                showImpact={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
