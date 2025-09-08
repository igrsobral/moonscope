import { fetch } from 'undici';
import type { SocialPlatform } from '../schemas/social.js';

export interface SocialPost {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
  };
  platform: SocialPlatform;
  isInfluencer?: boolean;
}

export interface SocialMetrics {
  platform: SocialPlatform;
  followers: number;
  mentions24h: number;
  posts: SocialPost[];
  hashtags: string[];
  topInfluencers: string[];
}

export class TwitterClient {
  private apiKey: string;
  private apiSecret: string;
  private bearerToken: string;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(apiKey: string, apiSecret: string, bearerToken: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.bearerToken = bearerToken;
  }

  /**
   * Search for tweets containing specific keywords
   */
  async searchTweets(
    keywords: string[],
    options: {
      maxResults?: number;
      startTime?: Date;
      endTime?: Date;
    } = {}
  ): Promise<SocialPost[]> {
    try {
      const query = keywords.map(k => `"${k}"`).join(' OR ');
      const params = new URLSearchParams({
        query,
        'tweet.fields': 'created_at,author_id,public_metrics,context_annotations',
        'user.fields': 'public_metrics,verified',
        expansions: 'author_id',
        max_results: (options.maxResults || 100).toString(),
      });

      if (options.startTime) {
        params.append('start_time', options.startTime.toISOString());
      }
      if (options.endTime) {
        params.append('end_time', options.endTime.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/tweets/search/recent?${params}`, {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      return this.transformTwitterData(data);
    } catch (error) {
      console.error('Error fetching Twitter data:', error);
      return [];
    }
  }

  /**
   * Get user metrics for a specific account
   */
  async getUserMetrics(username: string): Promise<{
    followers: number;
    following: number;
    tweets: number;
    verified: boolean;
  } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/users/by/username/${username}?user.fields=public_metrics,verified`,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.data) return null;

      return {
        followers: data.data.public_metrics.followers_count,
        following: data.data.public_metrics.following_count,
        tweets: data.data.public_metrics.tweet_count,
        verified: data.data.verified || false,
      };
    } catch (error) {
      console.error('Error fetching Twitter user metrics:', error);
      return null;
    }
  }

  private transformTwitterData(data: any): SocialPost[] {
    if (!data.data) return [];

    const users = data.includes?.users || [];
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    return data.data.map((tweet: any) => {
      const user = userMap.get(tweet.author_id);
      const isInfluencer = user?.verified || user?.public_metrics?.followers_count > 10000;

      return {
        id: tweet.id,
        text: tweet.text,
        author: user?.username || 'unknown',
        timestamp: new Date(tweet.created_at),
        engagement: {
          likes: tweet.public_metrics?.like_count || 0,
          shares: tweet.public_metrics?.retweet_count || 0,
          comments: tweet.public_metrics?.reply_count || 0,
        },
        platform: 'twitter' as SocialPlatform,
        isInfluencer,
      };
    });
  }
}

export class RedditClient {
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;
  private baseUrl = 'https://www.reddit.com';

  constructor(clientId: string, clientSecret: string, userAgent: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.userAgent = userAgent;
  }

  /**
   * Search for Reddit posts containing specific keywords
   */
  async searchPosts(
    keywords: string[],
    options: {
      subreddits?: string[];
      limit?: number;
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
    } = {}
  ): Promise<SocialPost[]> {
    try {
      const query = keywords.join(' OR ');
      const subredditQuery = options.subreddits?.length
        ? `subreddit:${options.subreddits.join(' OR subreddit:')}`
        : '';

      const fullQuery = [query, subredditQuery].filter(Boolean).join(' ');

      const params = new URLSearchParams({
        q: fullQuery,
        limit: (options.limit || 100).toString(),
        t: options.timeframe || 'day',
        sort: options.sort || 'relevance',
        type: 'link,sr',
      });

      const response = await fetch(`${this.baseUrl}/search.json?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      return this.transformRedditData(data);
    } catch (error) {
      console.error('Error fetching Reddit data:', error);
      return [];
    }
  }

  /**
   * Get subreddit metrics
   */
  async getSubredditMetrics(subreddit: string): Promise<{
    subscribers: number;
    activeUsers: number;
    description: string;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/r/${subreddit}/about.json`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.data) return null;

      return {
        subscribers: data.data.subscribers || 0,
        activeUsers: data.data.accounts_active || 0,
        description: data.data.public_description || '',
      };
    } catch (error) {
      console.error('Error fetching Reddit subreddit metrics:', error);
      return null;
    }
  }

  private transformRedditData(data: any): SocialPost[] {
    if (!data.data?.children) return [];

    return data.data.children
      .filter((child: any) => child.kind === 't3') // Only posts, not comments
      .map((child: any) => {
        const post = child.data;
        const isInfluencer =
          post.author_flair_text?.includes('Moderator') ||
          post.distinguished === 'moderator' ||
          post.score > 1000;

        return {
          id: post.id,
          text: post.title + (post.selftext ? ` ${post.selftext}` : ''),
          author: post.author,
          timestamp: new Date(post.created_utc * 1000),
          engagement: {
            likes: post.score || 0,
            shares: 0, // Reddit doesn't have shares
            comments: post.num_comments || 0,
          },
          platform: 'reddit' as SocialPlatform,
          isInfluencer,
        };
      });
  }
}

export class TelegramClient {
  private botToken: string;
  private baseUrl = 'https://api.telegram.org/bot';

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Get channel information and recent messages
   * Note: This requires the bot to be added to the channel
   */
  async getChannelMetrics(channelId: string): Promise<{
    memberCount: number;
    title: string;
    description: string;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}${this.botToken}/getChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.ok) return null;

      const chat = data.result;

      // Get member count
      const memberResponse = await fetch(`${this.baseUrl}${this.botToken}/getChatMemberCount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
        }),
      });

      let memberCount = 0;
      if (memberResponse.ok) {
        const memberData = (await memberResponse.json()) as any;
        memberCount = memberData.ok ? memberData.result : 0;
      }

      return {
        memberCount,
        title: chat.title || '',
        description: chat.description || '',
      };
    } catch (error) {
      console.error('Error fetching Telegram channel metrics:', error);
      return null;
    }
  }

  /**
   * Search for messages in a channel (limited functionality)
   * Note: This is a simplified implementation as Telegram Bot API has limitations
   */
  async searchMessages(
    channelId: string,
    keywords: string[],
    options: {
      limit?: number;
    } = {}
  ): Promise<SocialPost[]> {
    // Note: Telegram Bot API doesn't provide full search functionality
    // This is a placeholder implementation that would need to be enhanced
    // with proper message history access or third-party services

    console.warn('Telegram message search has limited functionality via Bot API');
    return [];
  }
}

export class SocialMediaClientManager {
  private twitterClient?: TwitterClient;
  private redditClient?: RedditClient;
  private telegramClient?: TelegramClient;

  constructor(config: {
    twitter?: {
      apiKey: string;
      apiSecret: string;
      bearerToken: string;
    };
    reddit?: {
      clientId: string;
      clientSecret: string;
      userAgent: string;
    };
    telegram?: {
      botToken: string;
    };
  }) {
    if (config.twitter) {
      this.twitterClient = new TwitterClient(
        config.twitter.apiKey,
        config.twitter.apiSecret,
        config.twitter.bearerToken
      );
    }

    if (config.reddit) {
      this.redditClient = new RedditClient(
        config.reddit.clientId,
        config.reddit.clientSecret,
        config.reddit.userAgent
      );
    }

    if (config.telegram) {
      this.telegramClient = new TelegramClient(config.telegram.botToken);
    }
  }

  /**
   * Collect social data from all available platforms
   */
  async collectSocialData(
    keywords: string[],
    options: {
      platforms?: SocialPlatform[];
      timeframe?: string;
      limit?: number;
    } = {}
  ): Promise<SocialMetrics[]> {
    const results: SocialMetrics[] = [];
    const platforms = options.platforms || ['twitter', 'reddit', 'telegram'];

    // Collect Twitter data
    if (platforms.includes('twitter') && this.twitterClient) {
      try {
        const posts = await this.twitterClient.searchTweets(keywords, {
          maxResults: options.limit || 100,
        });

        results.push({
          platform: 'twitter',
          followers: 0, // Would need to aggregate from user data
          mentions24h: posts.length,
          posts,
          hashtags: this.extractHashtags(posts),
          topInfluencers: this.getTopInfluencers(posts),
        });
      } catch (error) {
        console.error('Error collecting Twitter data:', error);
      }
    }

    // Collect Reddit data
    if (platforms.includes('reddit') && this.redditClient) {
      try {
        const posts = await this.redditClient.searchPosts(keywords, {
          limit: options.limit || 100,
          timeframe: 'day',
        });

        results.push({
          platform: 'reddit',
          followers: 0, // Would need to aggregate from subreddit data
          mentions24h: posts.length,
          posts,
          hashtags: [], // Reddit doesn't use hashtags
          topInfluencers: this.getTopInfluencers(posts),
        });
      } catch (error) {
        console.error('Error collecting Reddit data:', error);
      }
    }

    // Collect Telegram data
    if (platforms.includes('telegram') && this.telegramClient) {
      // Telegram implementation would be more complex and require
      // specific channel access or third-party services
      console.warn('Telegram data collection requires additional setup');
    }

    return results;
  }

  private extractHashtags(posts: SocialPost[]): string[] {
    const hashtags = new Set<string>();

    posts.forEach(post => {
      const matches = post.text.match(/#\w+/g);
      if (matches) {
        matches.forEach(tag => hashtags.add(tag.toLowerCase()));
      }
    });

    return Array.from(hashtags);
  }

  private getTopInfluencers(posts: SocialPost[]): string[] {
    const influencers = posts.filter(post => post.isInfluencer).map(post => post.author);

    return [...new Set(influencers)].slice(0, 10);
  }
}
