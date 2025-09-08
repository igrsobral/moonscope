'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Portfolio } from '@/types';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  Grid3X3,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface PortfolioAnalyticsChartProps {
  portfolioData: Portfolio[];
  historicalData?: HistoricalPortfolioData[];
}

interface HistoricalPortfolioData {
  date: string;
  totalValue: number;
  profitLoss: number;
  profitLossPercentage: number;
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
  '#FFC658',
  '#FF7C7C',
  '#8DD1E1',
  '#D084D0',
];

export function PortfolioAnalyticsChart({
  portfolioData,
  historicalData = [],
}: PortfolioAnalyticsChartProps) {
  const [chartType, setChartType] = useState<
    'performance' | 'allocation' | 'comparison' | 'volatility' | 'correlation' | 'risk-return'
  >('performance');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);

  const allocationData = portfolioData.map((holding, index) => ({
    name: holding.coin?.symbol || 'Unknown',
    value: holding.currentValue,
    percentage: totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0,
    color: COLORS[index % COLORS.length],
  }));

  const comparisonData = portfolioData.map(holding => ({
    name: holding.coin?.symbol || 'Unknown',
    invested: holding.amount * holding.avgPrice,
    current: holding.currentValue,
    profitLoss: holding.profitLoss,
    profitLossPercentage: holding.profitLossPercentage,
  }));

  // Volatility data for each holding
  const volatilityData = portfolioData.map(holding => ({
    name: holding.coin?.symbol || 'Unknown',
    volatility: Math.abs(holding.profitLossPercentage) * 0.3 + Math.random() * 10, // Mock volatility
    returns: holding.profitLossPercentage,
    allocation: totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0,
  }));

  // Risk-return scatter data
  const riskReturnData = portfolioData.map(holding => ({
    name: holding.coin?.symbol || 'Unknown',
    risk: Math.abs(holding.profitLossPercentage) * 0.3 + Math.random() * 10,
    return: holding.profitLossPercentage,
    size: holding.currentValue,
  }));

  // Correlation matrix data (mock)
  const correlationData = portfolioData.slice(0, 5).map((holding, i) => {
    const row: any = { name: holding.coin?.symbol || 'Unknown' };
    portfolioData.slice(0, 5).forEach((other, j) => {
      row[other.coin?.symbol || 'Unknown'] = i === j ? 1 : (Math.random() - 0.5) * 2;
    });
    return row;
  });

  // Generate mock historical data if not provided
  const mockHistoricalData =
    historicalData.length > 0 ? historicalData : generateMockHistoricalData(timeRange);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}:{' '}
              {entry.name.includes('%')
                ? formatPercentage(entry.value)
                : formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p>Value: {formatCurrency(data.value)}</p>
          <p>Allocation: {formatPercentage(data.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={chartType === 'performance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('performance')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Performance
          </Button>
          <Button
            variant={chartType === 'allocation' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('allocation')}
          >
            <PieChartIcon className="mr-2 h-4 w-4" />
            Allocation
          </Button>
          <Button
            variant={chartType === 'comparison' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('comparison')}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Comparison
          </Button>
          <Button
            variant={chartType === 'volatility' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('volatility')}
          >
            <Activity className="mr-2 h-4 w-4" />
            Volatility
          </Button>
          <Button
            variant={chartType === 'correlation' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('correlation')}
          >
            <Grid3X3 className="mr-2 h-4 w-4" />
            Correlation
          </Button>
          <Button
            variant={chartType === 'risk-return' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('risk-return')}
          >
            <Target className="mr-2 h-4 w-4" />
            Risk vs Return
          </Button>
        </div>

        {chartType === 'performance' && (
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
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
        )}
      </div>

      {/* Performance Chart */}
      {chartType === 'performance' && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockHistoricalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={value => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalValue"
                    stroke="#0088FE"
                    strokeWidth={2}
                    dot={false}
                    name="Portfolio Value"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocation Chart */}
      {chartType === 'allocation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allocationData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(item.value)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatPercentage(item.percentage)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison Chart */}
      {chartType === 'comparison' && (
        <Card>
          <CardHeader>
            <CardTitle>Investment vs Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="invested" fill="#8884d8" name="Invested" />
                  <Bar dataKey="current" fill="#82ca9d" name="Current Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volatility Chart */}
      {chartType === 'volatility' && (
        <Card>
          <CardHeader>
            <CardTitle>Volatility Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volatilityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'volatility' ? `${value.toFixed(2)}%` : `${value.toFixed(2)}%`,
                      name === 'volatility' ? 'Volatility' : 'Returns',
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="volatility" fill="#ff7c7c" name="Volatility (%)" />
                  <Bar dataKey="returns" fill="#82ca9d" name="Returns (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk-Return Scatter Plot */}
      {chartType === 'risk-return' && (
        <Card>
          <CardHeader>
            <CardTitle>Risk vs Return Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={riskReturnData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="risk"
                    name="Risk"
                    unit="%"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="return"
                    name="Return"
                    unit="%"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)}%`,
                      name === 'return' ? 'Return' : 'Risk',
                    ]}
                    labelFormatter={label => `Asset: ${label}`}
                  />
                  <Scatter dataKey="return" fill="#8884d8" name="Assets" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Correlation Matrix */}
      {chartType === 'correlation' && (
        <Card>
          <CardHeader>
            <CardTitle>Asset Correlation Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-2 text-sm">
                <div></div>
                {correlationData.map(item => (
                  <div key={item.name} className="text-center font-medium">
                    {item.name}
                  </div>
                ))}
                {correlationData.map((row, i) => (
                  <>
                    <div key={`row-${i}`} className="font-medium">
                      {row.name}
                    </div>
                    {correlationData.map((col, j) => {
                      const correlation = row[col.name];
                      const intensity = Math.abs(correlation);
                      const isPositive = correlation > 0;
                      return (
                        <div
                          key={`cell-${i}-${j}`}
                          className="flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-white"
                          style={{
                            backgroundColor: isPositive
                              ? `rgba(34, 197, 94, ${intensity})`
                              : `rgba(239, 68, 68, ${intensity})`,
                          }}
                        >
                          {correlation.toFixed(2)}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to generate mock historical data
function generateMockHistoricalData(timeRange: string): HistoricalPortfolioData[] {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
  const data: HistoricalPortfolioData[] = [];
  const baseValue = 10000;

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Generate some realistic-looking portfolio performance data
    const volatility = 0.05; // 5% daily volatility
    const trend = 0.001; // Slight upward trend
    const randomChange = (Math.random() - 0.5) * volatility;
    const trendChange = trend * (days - i);

    const totalValue = baseValue * (1 + trendChange + randomChange);
    const profitLoss = totalValue - baseValue;
    const profitLossPercentage = (profitLoss / baseValue) * 100;

    data.push({
      date: date.toISOString().split('T')[0] as string,
      totalValue,
      profitLoss,
      profitLossPercentage,
    });
  }

  return data;
}
