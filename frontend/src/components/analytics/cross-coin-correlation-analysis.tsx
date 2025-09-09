'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitBranch, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { CorrelationHeatmap } from './correlation-heatmap';

interface CorrelationData {
  correlationMatrix: {
    coinA: string;
    coinB: string;
    correlation: number;
    significance: number;
  }[];
  topCorrelations: {
    positive: {
      coinA: string;
      coinB: string;
      correlation: number;
      priceChangeA: number;
      priceChangeB: number;
    }[];
    negative: {
      coinA: string;
      coinB: string;
      correlation: number;
      priceChangeA: number;
      priceChangeB: number;
    }[];
  };
  marketSegments: {
    segment: string;
    coins: string[];
    avgCorrelation: number;
    performance24h: number;
  }[];
  statistics: {
    avgCorrelation: number;
    strongCorrelations: number;
    weakCorrelations: number;
    negativeCorrelations: number;
  };
}

type TimeFrame = '24h' | '7d' | '30d';
type AnalysisType = 'price' | 'volume' | 'social';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const analysisTypeOptions: { value: AnalysisType; label: string }[] = [
  { value: 'price', label: 'Price Correlation' },
  { value: 'volume', label: 'Volume Correlation' },
  { value: 'social', label: 'Social Correlation' },
];

export function CrossCoinCorrelationAnalysis() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('price');
  const [selectedCoin, setSelectedCoin] = useState<string>('');

  const {
    data: correlationData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['correlation-analysis', timeFrame, analysisType, selectedCoin],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe: timeFrame,
        type: analysisType,
      });
      if (selectedCoin) {
        params.append('coin', selectedCoin);
      }

      const response = await apiClient.get<CorrelationData>(
        `/api/v1/analytics/correlation?${params}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: availableCoins } = useQuery({
    queryKey: ['available-coins-for-correlation'],
    queryFn: async () => {
      const response = await apiClient.get<{ symbol: string; name: string }[]>(
        '/api/v1/coins?limit=50&sortBy=marketCap'
      );
      return response.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <GitBranch className="h-6 w-6" />
            <span>Cross-Coin Correlation Analysis</span>
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

  if (error || !correlationData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>Failed to load correlation analysis data</p>
      </div>
    );
  }

  const formatCorrelation = (value: number) => {
    return value.toFixed(3);
  };

  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return correlation > 0 ? 'text-green-600' : 'text-red-600';
    if (abs >= 0.3) return correlation > 0 ? 'text-green-500' : 'text-red-500';
    return 'text-gray-500';
  };

  const getCorrelationStrength = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.3) return 'Moderate';
    return 'Weak';
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {value.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <GitBranch className="h-6 w-6" />
            <span>Cross-Coin Correlation Analysis</span>
          </h2>
          <p className="text-muted-foreground">
            Analyze price and volume correlations between meme coins
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select
            value={analysisType}
            onValueChange={(value: AnalysisType) => setAnalysisType(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {analysisTypeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Correlation</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCorrelation(correlationData.statistics.avgCorrelation)}
            </div>
            <p className="text-xs text-muted-foreground">Market-wide correlation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strong Correlations</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {correlationData.statistics.strongCorrelations}
            </div>
            <p className="text-xs text-muted-foreground">|r| ≥ 0.7</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weak Correlations</CardTitle>
            <TrendingDown className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {correlationData.statistics.weakCorrelations}
            </div>
            <p className="text-xs text-muted-foreground">|r| &lt; 0.3</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Correlations</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {correlationData.statistics.negativeCorrelations}
            </div>
            <p className="text-xs text-muted-foreground">r &lt; -0.3</p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Tabs */}
      <Tabs defaultValue="heatmap" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heatmap">Correlation Heatmap</TabsTrigger>
          <TabsTrigger value="top-correlations">Top Correlations</TabsTrigger>
          <TabsTrigger value="segments">Market Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Correlation Heatmap</CardTitle>
              <div className="flex items-center space-x-2">
                <Select value={selectedCoin} onValueChange={setSelectedCoin}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by coin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Coins</SelectItem>
                    {availableCoins?.map(coin => (
                      <SelectItem key={coin.symbol} value={coin.symbol}>
                        {coin.symbol} - {coin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <CorrelationHeatmap
                data={correlationData.correlationMatrix}
                selectedCoin={selectedCoin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-correlations" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Strongest Positive Correlations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {correlationData.topCorrelations.positive.map((pair, index) => (
                    <div
                      key={`${pair.coinA}-${pair.coinB}`}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-600">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{pair.coinA}</Badge>
                            <span className="text-muted-foreground">↔</span>
                            <Badge variant="outline">{pair.coinB}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getCorrelationStrength(pair.correlation)} correlation
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn('text-lg font-bold', getCorrelationColor(pair.correlation))}
                        >
                          {formatCorrelation(pair.correlation)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercentage(pair.priceChangeA)} /{' '}
                          {formatPercentage(pair.priceChangeB)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span>Strongest Negative Correlations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {correlationData.topCorrelations.negative.map((pair, index) => (
                    <div
                      key={`${pair.coinA}-${pair.coinB}`}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-medium text-red-600">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{pair.coinA}</Badge>
                            <span className="text-muted-foreground">↔</span>
                            <Badge variant="outline">{pair.coinB}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getCorrelationStrength(pair.correlation)} negative correlation
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn('text-lg font-bold', getCorrelationColor(pair.correlation))}
                        >
                          {formatCorrelation(pair.correlation)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercentage(pair.priceChangeA)} /{' '}
                          {formatPercentage(pair.priceChangeB)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Market Segments Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {correlationData.marketSegments.map((segment, index) => (
                  <div key={segment.segment} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium">{segment.segment}</h3>
                          <p className="text-sm text-muted-foreground">
                            {segment.coins.length} coins in segment
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatCorrelation(segment.avgCorrelation)}
                        </div>
                        <div className="text-sm">{formatPercentage(segment.performance24h)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {segment.coins.map(coin => (
                        <Badge key={coin} variant="secondary" className="text-xs">
                          {coin}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
