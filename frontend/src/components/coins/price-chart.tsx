'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { Button, LoadingState } from '@/components/ui';
import { ChartDataPoint } from '@/types';
import { cn } from '@/lib/utils';

interface PriceChartProps {
  coinId: string;
}

type TimeFrame = '1h' | '24h' | '7d' | '30d';
type ChartType = 'price' | 'volume' | 'combined';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const chartTypeOptions: { value: ChartType; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'volume', label: 'Volume' },
  { value: 'combined', label: 'Combined' },
];

export function PriceChart({ coinId }: PriceChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');
  const [chartType, setChartType] = useState<ChartType>('price');

  const {
    data: chartData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['coin-chart', coinId, timeFrame],
    queryFn: async () => {
      const response = await apiClient.get<ChartDataPoint[]>(
        `/api/v1/coins/${coinId}/chart?timeframe=${timeFrame}`
      );
      return response.data || [];
    },
    enabled: !!coinId,
    staleTime: 60 * 1000, // 1 minute
  });

  const processedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    return chartData.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
      formattedTime: formatTimestamp(point.timestamp, timeFrame),
      price: Number(point.price),
      volume: point.volume ? Number(point.volume) : 0,
      marketCap: point.marketCap ? Number(point.marketCap) : 0,
    }));
  }, [chartData, timeFrame]);

  const priceChange = useMemo(() => {
    if (!processedData || processedData.length < 2)
      return { value: 0, percentage: 0, isPositive: true };

    const firstPrice = processedData[0]?.price || 0;
    const lastPrice = processedData[processedData.length - 1]?.price || 0;
    const change = lastPrice - firstPrice;
    const percentage = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

    return {
      value: change,
      percentage,
      isPositive: change >= 0,
    };
  }, [processedData]);

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <LoadingState size="lg" />
      </div>
    );
  }

  if (error || !processedData || processedData.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>No chart data available</p>
      </div>
    );
  }

  const formatPrice = (value: number) => {
    if (value < 0.01) {
      return `$${value.toFixed(6)}`;
    }
    return `$${value.toFixed(4)}`;
  };

  const formatVolume = (value: number) => {
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
              {entry.name}:{' '}
              {entry.dataKey === 'price'
                ? formatPrice(entry.value)
                : entry.dataKey === 'volume'
                  ? formatVolume(entry.value)
                  : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'price':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={priceChange.isPositive ? '#10b981' : '#ef4444'}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={priceChange.isPositive ? '#10b981' : '#ef4444'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="formattedTime" axisLine={false} tickLine={false} className="text-xs" />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tickFormatter={formatPrice}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={priceChange.isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#priceGradient)"
              name="Price"
            />
          </AreaChart>
        );

      case 'volume':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="formattedTime" axisLine={false} tickLine={false} className="text-xs" />
            <YAxis
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tickFormatter={formatVolume}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="volume" fill="#8884d8" name="Volume" radius={[2, 2, 0, 0]} />
          </BarChart>
        );

      case 'combined':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="formattedTime" axisLine={false} tickLine={false} className="text-xs" />
            <YAxis
              yAxisId="price"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tickFormatter={formatPrice}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              axisLine={false}
              tickLine={false}
              className="text-xs"
              tickFormatter={formatVolume}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke={priceChange.isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill={priceChange.isPositive ? '#10b981' : '#ef4444'}
              fillOpacity={0.1}
              name="Price"
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#8884d8"
              fillOpacity={0.3}
              name="Volume"
              radius={[2, 2, 0, 0]}
            />
          </ComposedChart>
        );

      default:
        return <div>Invalid chart type</div>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Timeframe:</span>
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

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Chart:</span>
          <div className="flex space-x-1">
            {chartTypeOptions.map(option => (
              <Button
                key={option.value}
                variant={chartType === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Change Indicator */}
      <div className="flex items-center space-x-4">
        <div
          className={cn(
            'text-lg font-semibold',
            priceChange.isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {priceChange.isPositive ? '+' : ''}
          {priceChange.percentage.toFixed(2)}%
        </div>
        <div className="text-sm text-muted-foreground">
          {timeFrameOptions.find(opt => opt.value === timeFrame)?.label} change
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string, timeFrame: TimeFrame): string {
  const date = new Date(timestamp);

  switch (timeFrame) {
    case '1h':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '24h':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '7d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case '30d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleString();
  }
}
