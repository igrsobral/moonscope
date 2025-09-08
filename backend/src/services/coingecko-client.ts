import { HttpClient, HttpClientOptions, RateLimitError } from './http-client.js';
import { FastifyBaseLogger } from 'fastify';

export interface CoinGeckoConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  logger?: FastifyBaseLogger;
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface CoinGeckoMarketData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface CoinGeckoCoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: {
    en: string;
  };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    facebook_username: string;
    bitcointalk_thread_identifier: number;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string;
  genesis_date: string;
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  market_cap_rank: number;
  coingecko_rank: number;
  coingecko_score: number;
  developer_score: number;
  community_score: number;
  liquidity_score: number;
  public_interest_score: number;
  market_data: {
    current_price: Record<string, number>;
    total_value_locked: Record<string, number>;
    mcap_to_tvl_ratio: number;
    fdv_to_tvl_ratio: number;
    roi: {
      times: number;
      currency: string;
      percentage: number;
    };
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    market_cap: Record<string, number>;
    market_cap_rank: number;
    fully_diluted_valuation: Record<string, number>;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    total_supply: number;
    max_supply: number;
    circulating_supply: number;
    last_updated: string;
  };
  community_data: {
    facebook_likes: number;
    twitter_followers: number;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_subscribers: number;
    reddit_accounts_active_48h: number;
    telegram_channel_user_count: number;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    code_additions_deletions_4_weeks: {
      additions: number;
      deletions: number;
    };
    commit_count_4_weeks: number;
    last_4_weeks_commit_activity_series: number[];
  };
  public_interest_stats: {
    alexa_rank: number;
    bing_matches: number;
  };
}

export interface CoinGeckoSearchResult {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    large: string;
  }>;
}

export interface CoinGeckoTrendingResult {
  coins: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
    };
  }>;
}

export class CoinGeckoClient {
  private httpClient: HttpClient;
  private logger?: FastifyBaseLogger;

  constructor(config: CoinGeckoConfig) {
    this.logger = config.logger;

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['x-cg-demo-api-key'] = config.apiKey;
    }

    const httpOptions: HttpClientOptions = {
      baseUrl: config.baseUrl || 'https://api.coingecko.com/api/v3',
      timeout: config.timeout || 30000,
      headers,
      logger: config.logger,
    };

    // CoinGecko rate limits: 10-50 calls/minute for free tier
    this.httpClient = new HttpClient(
      httpOptions,
      {
        threshold: 3, // Lower threshold for external API
        timeout: 120000, // 2 minutes
        monitoringPeriod: 60000, // 1 minute
      },
      {
        maxRetries: 2, // Fewer retries for external API
        baseDelay: 2000, // Longer base delay
        maxDelay: 30000,
        backoffFactor: 2,
      }
    );
  }

  /**
   * Get list of coins with market data
   */
  async getCoinsMarkets(
    options: {
      vsCurrency?: string;
      ids?: string[];
      category?: string;
      order?:
        | 'market_cap_desc'
        | 'market_cap_asc'
        | 'volume_desc'
        | 'volume_asc'
        | 'id_asc'
        | 'id_desc';
      perPage?: number;
      page?: number;
      sparkline?: boolean;
      priceChangePercentage?: string;
    } = {}
  ): Promise<CoinGeckoCoin[]> {
    const params = new URLSearchParams({
      vs_currency: options.vsCurrency || 'usd',
      order: options.order || 'market_cap_desc',
      per_page: String(options.perPage || 100),
      page: String(options.page || 1),
      sparkline: String(options.sparkline || false),
    });

    if (options.ids && options.ids.length > 0) {
      params.append('ids', options.ids.join(','));
    }

    if (options.category) {
      params.append('category', options.category);
    }

    if (options.priceChangePercentage) {
      params.append('price_change_percentage', options.priceChangePercentage);
    }

    try {
      return await this.httpClient.get<CoinGeckoCoin[]>(`/coins/markets?${params.toString()}`);
    } catch (error) {
      this.handleApiError(error, 'getCoinsMarkets');
      throw error;
    }
  }

  /**
   * Get detailed coin information
   */
  async getCoinById(
    id: string,
    options: {
      localization?: boolean;
      tickers?: boolean;
      marketData?: boolean;
      communityData?: boolean;
      developerData?: boolean;
      sparkline?: boolean;
    } = {}
  ): Promise<CoinGeckoCoinDetail> {
    const params = new URLSearchParams({
      localization: String(options.localization || false),
      tickers: String(options.tickers || false),
      market_data: String(options.marketData !== false),
      community_data: String(options.communityData !== false),
      developer_data: String(options.developerData !== false),
      sparkline: String(options.sparkline || false),
    });

    try {
      return await this.httpClient.get<CoinGeckoCoinDetail>(`/coins/${id}?${params.toString()}`);
    } catch (error) {
      this.handleApiError(error, 'getCoinById');
      throw error;
    }
  }

  /**
   * Get historical market data for a coin
   */
  async getCoinMarketChart(
    id: string,
    vsCurrency: string = 'usd',
    days: number | 'max' = 7,
    interval?: 'daily'
  ): Promise<CoinGeckoMarketData> {
    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      days: String(days),
    });

    if (interval) {
      params.append('interval', interval);
    }

    try {
      return await this.httpClient.get<CoinGeckoMarketData>(
        `/coins/${id}/market_chart?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getCoinMarketChart');
      throw error;
    }
  }

  /**
   * Search for coins
   */
  async searchCoins(query: string): Promise<CoinGeckoSearchResult> {
    const params = new URLSearchParams({ query });

    try {
      return await this.httpClient.get<CoinGeckoSearchResult>(`/search?${params.toString()}`);
    } catch (error) {
      this.handleApiError(error, 'searchCoins');
      throw error;
    }
  }

  /**
   * Get trending coins
   */
  async getTrendingCoins(): Promise<CoinGeckoTrendingResult> {
    try {
      return await this.httpClient.get<CoinGeckoTrendingResult>('/search/trending');
    } catch (error) {
      this.handleApiError(error, 'getTrendingCoins');
      throw error;
    }
  }

  /**
   * Get simple price for multiple coins
   */
  async getSimplePrice(
    ids: string[],
    vsCurrencies: string[] = ['usd'],
    options: {
      includeMarketCap?: boolean;
      include24hrVol?: boolean;
      include24hrChange?: boolean;
      includeLastUpdatedAt?: boolean;
    } = {}
  ): Promise<Record<string, Record<string, number>>> {
    const params = new URLSearchParams({
      ids: ids.join(','),
      vs_currencies: vsCurrencies.join(','),
    });

    if (options.includeMarketCap) {
      params.append('include_market_cap', 'true');
    }
    if (options.include24hrVol) {
      params.append('include_24hr_vol', 'true');
    }
    if (options.include24hrChange) {
      params.append('include_24hr_change', 'true');
    }
    if (options.includeLastUpdatedAt) {
      params.append('include_last_updated_at', 'true');
    }

    try {
      return await this.httpClient.get<Record<string, Record<string, number>>>(
        `/simple/price?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getSimplePrice');
      throw error;
    }
  }

  /**
   * Get supported vs currencies
   */
  async getSupportedVsCurrencies(): Promise<string[]> {
    try {
      return await this.httpClient.get<string[]>('/simple/supported_vs_currencies');
    } catch (error) {
      this.handleApiError(error, 'getSupportedVsCurrencies');
      throw error;
    }
  }

  /**
   * Get ping status
   */
  async ping(): Promise<{ gecko_says: string }> {
    try {
      return await this.httpClient.get<{ gecko_says: string }>('/ping');
    } catch (error) {
      this.handleApiError(error, 'ping');
      throw error;
    }
  }

  private handleApiError(error: any, method: string): void {
    if (error.statusCode === 429) {
      this.logger?.warn(
        {
          method,
          error: error.message,
          statusCode: error.statusCode,
        },
        'CoinGecko API rate limit exceeded'
      );

      throw new RateLimitError('CoinGecko API rate limit exceeded');
    }

    this.logger?.error(
      {
        method,
        error: error.message,
        statusCode: error.statusCode,
        responseBody: error.responseBody,
      },
      'CoinGecko API error'
    );
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      circuitBreaker: this.httpClient.getCircuitBreakerState(),
    };
  }
}
