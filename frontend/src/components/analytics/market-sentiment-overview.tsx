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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import {
  Heart,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { SentimentGauge } from './sentiment-gauge';

interface SentimentData {
  overview: {
    overallSentiment: number; // -1 to 1
    sentimentChange24h: number;
    totalMentions24h: number;
    mentionsChange24h: number;
    influencerMentions: number;
    trendingCoins: number;
  };
  sentimentTrends: {
    timestamp: string;
    sentiment: number;
    mentions: number;
    positiveRatio: number;
    negativeRatio: number;
  }[];
  platformBreakdown: {
    platform: 'twitter' | 'reddit' | 'telegram';
    sentiment: number;
    mentions: number;
    engagement: number;
    topHashtags: string[];
  }[];
  topSentimentCoins: {
    positive: {
      coinSymbol: string;
      coinName: string;
      sentiment: number;
      mentions: number;
      priceChange24h: number;
    }[];
    negative: {
      coinSymbol: string;
      coinName: string;
      sentiment: number;
      mentions: number;
      priceChange24h: number;
    }[];
  };
  sentimentDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  keywordAnalysis: {
    bullish: { keyword: string; count: number; sentiment: number }[];
    bearish: { keyword: string; count: number; sentiment: number }[];
  };
}

type TimeFrame = '24h' | '7d' | '30d';

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

export function MarketSentimentOverview() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');

  const {
    data: sentimentData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['market-sentiment', timeFrame],
    queryFn: async () => {
      const response = await apiClient.get<SentimentData>(
        `/api/v1/analytics/sentiment?timeframe=${timeFrame}`
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
            <Heart className="h-6 w-6" />
            <span>Market Sentiment Overview</span>
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

  if (error || !sentimentData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>Failed to load sentiment data</p>
      </div>
    );
  }

  const formatSentiment = (value: number) => {
    if (value > 0.3) return 'Bullish';
    if (value < -0.3) return 'Bearish';
    return 'Neutral';
  };

  const getSentimentColor = (value: number) => {
    if (value > 0.3) return 'text-green-600';
    if (value < -0.3) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSentimentIcon = (value: number) => {
    if (value > 0.3) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < -0.3) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <MessageCircle className="h-4 w-4 text-gray-600" />;
  };

  const formatNumber = (value: number) => {
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toString();
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(3)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-2xl font-bold">
            <Heart className="h-6 w-6" />
            <span>Market Sentiment Overview</span>
          </h2>
          <p className="text-muted-foreground">
            Aggregated social sentiment analysis across platforms
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Sentiment</CardTitle>
            {getSentimentIcon(sentimentData.overview.overallSentiment)}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                getSentimentColor(sentimentData.overview.overallSentiment)
              )}
            >
              {formatSentiment(sentimentData.overview.overallSentiment)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(sentimentData.overview.sentimentChange24h)} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mentions</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(sentimentData.overview.totalMentions24h)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(sentimentData.overview.mentionsChange24h)} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Influencer Mentions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentimentData.overview.influencerMentions}</div>
            <p className="text-xs text-muted-foreground">High-impact mentions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trending Coins</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentimentData.overview.trendingCoins}</div>
            <p className="text-xs text-muted-foreground">Coins with high social activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Gauge */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Market Sentiment Gauge</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentGauge value={sentimentData.overview.overallSentiment} size={200} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sentiment Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentimentData.sentimentTrends}>
                  <defs>
                    <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                  <YAxis domain={[-1, 1]} axisLine={false} tickLine={false} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sentiment"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#sentimentGradient)"
                    name="Sentiment"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
          <TabsTrigger value="coins">Top Sentiment Coins</TabsTrigger>
          <TabsTrigger value="keywords">Keyword Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {sentimentData.platformBreakdown.map(platform => (
              <Card key={platform.platform}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{platform.platform}</span>
                    <Badge variant={platform.sentiment > 0 ? 'default' : 'destructive'}>
                      {platform.sentiment > 0 ? 'Bullish' : 'Bearish'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Sentiment</span>
                      <span className={cn('font-medium', getSentimentColor(platform.sentiment))}>
                        {platform.sentiment.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Mentions</span>
                      <span className="font-medium">{formatNumber(platform.mentions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Engagement</span>
                      <span className="font-medium">{formatNumber(platform.engagement)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Top Hashtags</p>
                    <div className="flex flex-wrap gap-1">
                      {platform.topHashtags.map(hashtag => (
                        <Badge key={hashtag} variant="outline" className="text-xs">
                          #{hashtag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="coins" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                  <span>Most Positive Sentiment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sentimentData.topSentimentCoins.positive.map((coin, index) => (
                    <div
                      key={coin.coinSymbol}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-600">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{coin.coinSymbol}</p>
                          <p className="text-sm text-muted-foreground">{coin.coinName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">
                          {coin.sentiment.toFixed(3)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(coin.mentions)} mentions
                        </div>
                        <div className="text-xs">{formatPercentage(coin.priceChange24h)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ThumbsDown className="h-5 w-5 text-red-600" />
                  <span>Most Negative Sentiment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sentimentData.topSentimentCoins.negative.map((coin, index) => (
                    <div
                      key={coin.coinSymbol}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-medium text-red-600">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{coin.coinSymbol}</p>
                          <p className="text-sm text-muted-foreground">{coin.coinName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">{coin.sentiment.toFixed(3)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(coin.mentions)} mentions
                        </div>
                        <div className="text-xs">{formatPercentage(coin.priceChange24h)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Bullish Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sentimentData.keywordAnalysis.bullish.map((keyword, index) => (
                    <div
                      key={keyword.keyword}
                      className="flex items-center justify-between rounded border p-2"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span>{keyword.keyword}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatNumber(keyword.count)}</div>
                        <div className="text-xs text-green-600">{keyword.sentiment.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Bearish Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sentimentData.keywordAnalysis.bearish.map((keyword, index) => (
                    <div
                      key={keyword.keyword}
                      className="flex items-center justify-between rounded border p-2"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span>{keyword.keyword}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatNumber(keyword.count)}</div>
                        <div className="text-xs text-red-600">{keyword.sentiment.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
