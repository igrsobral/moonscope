'use client';

import { Coin } from '@/types';
import { Badge, Progress } from '@/components/ui';
import {
  Twitter,
  MessageCircle,
  Users,
  TrendingUp,
  Heart,
  MessageSquare,
  Hash,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialMetricsDashboardProps {
  coin: Coin;
}

export function SocialMetricsDashboard({ coin }: SocialMetricsDashboardProps) {
  const socialMetrics = coin.social || [];

  if (socialMetrics.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <p>Social metrics not available</p>
      </div>
    );
  }

  const getSentimentColor = (score: number) => {
    if (score >= 0.6) return 'text-green-600';
    if (score >= 0.3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSentimentBgColor = (score: number) => {
    if (score >= 0.6) return 'bg-green-100';
    if (score >= 0.3) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 0.7) return 'Very Positive';
    if (score >= 0.4) return 'Positive';
    if (score >= 0.1) return 'Neutral';
    if (score >= -0.3) return 'Negative';
    return 'Very Negative';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return Twitter;
      case 'reddit':
        return MessageCircle;
      case 'telegram':
        return MessageSquare;
      default:
        return MessageSquare;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return 'text-blue-500';
      case 'reddit':
        return 'text-orange-500';
      case 'telegram':
        return 'text-blue-400';
      default:
        return 'text-gray-500';
    }
  };

  // Calculate overall sentiment
  const overallSentiment =
    socialMetrics.reduce((acc, metric) => acc + metric.sentimentScore, 0) / socialMetrics.length;
  const totalMentions = socialMetrics.reduce((acc, metric) => acc + metric.mentions24h, 0);
  const totalFollowers = socialMetrics.reduce((acc, metric) => acc + metric.followers, 0);
  const avgTrendingScore =
    socialMetrics.reduce((acc, metric) => acc + metric.trendingScore, 0) / socialMetrics.length;

  return (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <div
        className={cn(
          'rounded-lg border-2 p-4',
          getSentimentBgColor(overallSentiment),
          overallSentiment >= 0.6
            ? 'border-green-200'
            : overallSentiment >= 0.3
              ? 'border-yellow-200'
              : 'border-red-200'
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className={cn('h-5 w-5', getSentimentColor(overallSentiment))} />
            <span className={cn('font-semibold', getSentimentColor(overallSentiment))}>
              {getSentimentLabel(overallSentiment)}
            </span>
          </div>
          <Badge variant="outline" className={cn('font-bold', getSentimentColor(overallSentiment))}>
            {(overallSentiment * 100).toFixed(0)}%
          </Badge>
        </div>

        <Progress
          value={(overallSentiment + 1) * 50} // Convert -1 to 1 range to 0 to 100
          className="h-3"
          indicatorClassName={
            overallSentiment >= 0.6
              ? 'bg-green-500'
              : overallSentiment >= 0.3
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">24h Mentions</span>
          </div>
          <div className="text-2xl font-bold">{formatNumber(totalMentions)}</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Total Followers</span>
          </div>
          <div className="text-2xl font-bold">{formatNumber(totalFollowers)}</div>
        </div>
      </div>

      {/* Trending Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Trending Score</span>
          </div>
          <span className="text-sm font-semibold">{avgTrendingScore.toFixed(0)}/100</span>
        </div>

        <Progress
          value={avgTrendingScore}
          className="h-2"
          indicatorClassName={
            avgTrendingScore >= 70
              ? 'bg-green-500'
              : avgTrendingScore >= 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }
        />
      </div>

      {/* Platform Breakdown */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Platform Breakdown
        </h4>

        {socialMetrics.map((metric, index) => {
          const PlatformIcon = getPlatformIcon(metric.platform);
          const platformColor = getPlatformColor(metric.platform);

          return (
            <div key={index} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PlatformIcon className={cn('h-5 w-5', platformColor)} />
                  <span className="font-medium capitalize">{metric.platform}</span>
                </div>
                <Badge variant="outline" className={getSentimentColor(metric.sentimentScore)}>
                  {getSentimentLabel(metric.sentimentScore)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Followers</span>
                  <div className="font-semibold">{formatNumber(metric.followers)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">24h Mentions</span>
                  <div className="font-semibold">{formatNumber(metric.mentions24h)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sentiment</span>
                  <span className={getSentimentColor(metric.sentimentScore)}>
                    {(metric.sentimentScore * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={(metric.sentimentScore + 1) * 50}
                  className="h-2"
                  indicatorClassName={
                    metric.sentimentScore >= 0.6
                      ? 'bg-green-500'
                      : metric.sentimentScore >= 0.3
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trending</span>
                  <span>{metric.trendingScore.toFixed(0)}/100</span>
                </div>
                <Progress
                  value={metric.trendingScore}
                  className="h-2"
                  indicatorClassName={
                    metric.trendingScore >= 70
                      ? 'bg-green-500'
                      : metric.trendingScore >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }
                />
              </div>

              {metric.influencerMentions > 0 && (
                <div className="flex items-center space-x-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">
                    {metric.influencerMentions} influencer mention
                    {metric.influencerMentions !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Social Links */}
      {coin.socialLinks && Object.keys(coin.socialLinks).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Social Links
          </h4>

          <div className="flex flex-wrap gap-2">
            {coin.socialLinks.twitter && (
              <a
                href={coin.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 rounded-lg bg-blue-50 px-3 py-2 text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Twitter className="h-4 w-4" />
                <span className="text-sm">Twitter</span>
              </a>
            )}

            {coin.socialLinks.telegram && (
              <a
                href={coin.socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 rounded-lg bg-blue-50 px-3 py-2 text-blue-700 transition-colors hover:bg-blue-100"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm">Telegram</span>
              </a>
            )}

            {coin.socialLinks.discord && (
              <a
                href={coin.socialLinks.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 rounded-lg bg-indigo-50 px-3 py-2 text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm">Discord</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
