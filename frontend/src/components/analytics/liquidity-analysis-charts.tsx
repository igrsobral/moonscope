'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Droplets, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

import { LiquidityMetricsCard } from './liquidity-metrics-card';

interface LiquidityData {
  overview: {
    totalLiquidity: number;
    liquidityChange24h: number;
    averageLiquidity: number;
    lowLiquidityCoins: number;
  };
  chartData: {
    timestamp: string;
    totalLiquidity: number;
    averageLiquidity: number;
    coinCount: number;
  }[];
  topPools: {
    coinId: number;
    coinSymbol: string;
    coinName: string;
    dex: string;
    liquidity: number;
    volume24h: number;
    apy: number;
    riskScore: number;
  }[];
  liquidityDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  riskAnalysis: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

type TimeFrame = '24h' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function LiquidityAnalysisCharts() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');

  const {
    data: liquidityData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['liquidity-analysis', timeFrame],
    queryFn: async () => {
      const response = await apiClient.get<LiquidityData>(
        `/api/v1/analytics/liquidity?timeframe=${timeFrame}`
      );
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <Droplets className="h-6 w-6" />
            <span>Liquidity Analysis</span>
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

  if (error || !liquidityData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>Failed to load liquidity analysis data</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return 'text-red-600';
    if (riskScore >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskBadgeVariant = (riskScore: number) => {
    if (riskScore >= 70) return 'destructive';
    if (riskScore >= 40) return 'secondary';
    return 'default';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <Droplets className="h-6 w-6" />
            <span>Liquidity Analysis</span>
          </h2>
          <p className="text-muted-foreground">
            Monitor liquidity pools and analyze market depth across DEXs
          </p>
        </div>
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

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LiquidityMetricsCard
          title="Total Liquidity"
          value={formatCurrency(liquidityData.overview.totalLiquidity)}
          change={liquidityData.overview.liquidityChange24h}
          icon={<Droplets className="h-4 w-4" />}
        />
        <LiquidityMetricsCard
          title="Average Liquidity"
          value={formatCurrency(liquidityData.overview.averageLiquidity)}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <LiquidityMetricsCard
          title="Low Liquidity Coins"
          value={liquidityData.overview.lowLiquidityCoins.toString()}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="warning"
        />
        <LiquidityMetricsCard
          title="Risk Distribution"
          value={`${liquidityData.riskAnalysis.highRisk} High Risk`}
          icon={<TrendingUp className="h-4 w-4" />}
          variant="danger"
        />
      </div>

      {/* Charts and Analysis */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Liquidity Trends</TabsTrigger>
          <TabsTrigger value="pools">Top Pools</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Liquidity Trends Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liquidityData.chartData}>
                    <defs>
                      <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      className="text-xs"
                      tickFormatter={value => new Date(value).toLocaleDateString()}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      className="text-xs"
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="totalLiquidity"
                      stroke="#0088FE"
                      strokeWidth={2}
                      fill="url(#liquidityGradient)"
                      name="Total Liquidity"
                    />
                    <Line
                      type="monotone"
                      dataKey="averageLiquidity"
                      stroke="#00C49F"
                      strokeWidth={2}
                      name="Average Liquidity"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Liquidity Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {liquidityData.topPools.map((pool, index) => (
                  <div
                    key={pool.coinId}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{pool.coinSymbol}</p>
                          <Badge variant="outline">{pool.dex}</Badge>
                          <Badge variant={getRiskBadgeVariant(pool.riskScore)} className="text-xs">
                            Risk: {pool.riskScore}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{pool.coinName}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="font-medium">{formatCurrency(pool.liquidity)}</div>
                      <div className="text-sm text-muted-foreground">
                        Vol: {formatCurrency(pool.volume24h)}
                      </div>
                      <div className="text-sm text-green-600">APY: {pool.apy.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Liquidity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={liquidityData.liquidityDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ range, percentage }) => `${range}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {liquidityData.liquidityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Liquidity by Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={liquidityData.liquidityDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="range"
                        axisLine={false}
                        tickLine={false}
                        className="text-xs"
                      />
                      <YAxis axisLine={false} tickLine={false} className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0088FE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">High Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {liquidityData.riskAnalysis.highRisk}
                </div>
                <p className="text-sm text-muted-foreground">Coins with liquidity below $10K</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600">Medium Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">
                  {liquidityData.riskAnalysis.mediumRisk}
                </div>
                <p className="text-sm text-muted-foreground">Coins with liquidity $10K-$100K</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Low Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {liquidityData.riskAnalysis.lowRisk}
                </div>
                <p className="text-sm text-muted-foreground">Coins with liquidity above $100K</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
