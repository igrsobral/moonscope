'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Portfolio } from '@/types';
import { TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface PortfolioComparisonProps {
  portfolioData: Portfolio[];
}

interface BenchmarkData {
  name: string;
  symbol: string;
  performance: number;
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface ComparisonData {
  date: string;
  portfolio: number;
  benchmark: number;
  outperformance: number;
}

const BENCHMARKS: BenchmarkData[] = [
  {
    name: 'Crypto Market Cap',
    symbol: 'TOTAL',
    performance: 45.2,
    volatility: 65.8,
    maxDrawdown: 23.4,
    sharpeRatio: 0.68,
  },
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    performance: 67.3,
    volatility: 58.2,
    maxDrawdown: 19.8,
    sharpeRatio: 1.15,
  },
  {
    name: 'Ethereum',
    symbol: 'ETH',
    performance: 52.1,
    volatility: 72.4,
    maxDrawdown: 28.6,
    sharpeRatio: 0.72,
  },
  {
    name: 'Meme Coin Index',
    symbol: 'MEME',
    performance: 89.4,
    volatility: 95.2,
    maxDrawdown: 45.7,
    sharpeRatio: 0.94,
  },
  {
    name: 'DeFi Index',
    symbol: 'DEFI',
    performance: 38.7,
    volatility: 68.9,
    maxDrawdown: 32.1,
    sharpeRatio: 0.56,
  },
];

export function PortfolioComparison({ portfolioData }: PortfolioComparisonProps) {
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('BTC');
  const [timeRange, setTimeRange] = useState<string>('30d');

  // Calculate portfolio metrics
  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvested = portfolioData.reduce(
    (sum, holding) => sum + holding.amount * holding.avgPrice,
    0
  );
  const portfolioPerformance =
    totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

  // Mock portfolio volatility calculation
  const returns = portfolioData.map(h => h.profitLossPercentage);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const portfolioVolatility = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );

  const portfolioSharpe = portfolioVolatility > 0 ? (avgReturn - 2) / portfolioVolatility : 0;

  const selectedBenchmarkData =
    BENCHMARKS.find(b => b.symbol === selectedBenchmark) || BENCHMARKS[0]!;

  // Generate comparison chart data
  const generateComparisonData = (): ComparisonData[] => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const data: ComparisonData[] = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Mock performance data with some correlation
      const portfolioValue =
        100 +
        (((portfolioPerformance / 100) * (days - i)) / days) * 100 +
        (Math.random() - 0.5) * 10;
      const benchmarkValue =
        100 +
        (((selectedBenchmarkData.performance / 100) * (days - i)) / days) * 100 +
        (Math.random() - 0.5) * 8;

      data.push({
        date: date.toISOString().split('T')[0] || date.toLocaleDateString(),
        portfolio: portfolioValue,
        benchmark: benchmarkValue,
        outperformance: portfolioValue - benchmarkValue,
      });
    }

    return data;
  };

  const comparisonData = generateComparisonData();
  const outperformance = portfolioPerformance - selectedBenchmarkData.performance;

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getPerformanceBadge = (value: number) => {
    if (value > 10) return { text: 'Excellent', color: 'bg-green-500' };
    if (value > 0) return { text: 'Outperforming', color: 'bg-blue-500' };
    if (value > -10) return { text: 'Underperforming', color: 'bg-yellow-500' };
    return { text: 'Poor', color: 'bg-red-500' };
  };

  const performanceBadge = getPerformanceBadge(outperformance);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={selectedBenchmark} onValueChange={setSelectedBenchmark}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select benchmark" />
            </SelectTrigger>
            <SelectContent>
              {BENCHMARKS.map(benchmark => (
                <SelectItem key={benchmark.symbol} value={benchmark.symbol}>
                  {benchmark.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Performance Comparison Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Portfolio</span>
                <span
                  className={`text-sm font-medium ${getPerformanceColor(portfolioPerformance)}`}
                >
                  {portfolioPerformance >= 0 ? '+' : ''}
                  {portfolioPerformance.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{selectedBenchmarkData.name}</span>
                <span
                  className={`text-sm font-medium ${getPerformanceColor(selectedBenchmarkData.performance)}`}
                >
                  +{selectedBenchmarkData.performance.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-xs font-medium">Difference</span>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${getPerformanceColor(outperformance)}`}>
                    {outperformance >= 0 ? '+' : ''}
                    {outperformance.toFixed(2)}%
                  </span>
                  {outperformance >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volatility</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Portfolio</span>
                <span className="text-sm font-medium">{portfolioVolatility.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{selectedBenchmarkData.name}</span>
                <span className="text-sm font-medium">
                  {selectedBenchmarkData.volatility.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-xs font-medium">Risk Level</span>
                <Badge
                  variant="outline"
                  className={
                    portfolioVolatility < selectedBenchmarkData.volatility
                      ? 'text-green-700'
                      : 'text-red-700'
                  }
                >
                  {portfolioVolatility < selectedBenchmarkData.volatility ? 'Lower' : 'Higher'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Portfolio</span>
                <span className="text-sm font-medium">{portfolioSharpe.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{selectedBenchmarkData.name}</span>
                <span className="text-sm font-medium">
                  {selectedBenchmarkData.sharpeRatio.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-xs font-medium">Efficiency</span>
                <Badge
                  variant="outline"
                  className={
                    portfolioSharpe > selectedBenchmarkData.sharpeRatio
                      ? 'text-green-700'
                      : 'text-red-700'
                  }
                >
                  {portfolioSharpe > selectedBenchmarkData.sharpeRatio ? 'Better' : 'Worse'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-center">
                <Badge className={performanceBadge.color}>{performanceBadge.text}</Badge>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                vs {selectedBenchmarkData.name}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={value => new Date(value).toLocaleDateString()}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={value => new Date(value).toLocaleDateString()}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}`,
                    name === 'portfolio' ? 'Portfolio' : selectedBenchmarkData.name,
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                  name="Portfolio"
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                  name={selectedBenchmarkData.name}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Outperformance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Outperformance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={value => new Date(value).toLocaleDateString()}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={value => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [`${value.toFixed(2)}`, 'Outperformance']}
                />
                <Bar dataKey="outperformance" fill="#8884d8" name="Outperformance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
