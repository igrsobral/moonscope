import Sentiment from 'sentiment';
import * as natural from 'natural';
import type {
  SentimentAnalysisRequest,
  SentimentAnalysisResponse,
  SocialPlatform,
} from '../schemas/social.js';

export class SentimentAnalysisService {
  private sentiment: Sentiment;
  private tokenizer: any;

  constructor() {
    this.sentiment = new Sentiment();
    this.tokenizer = new natural.WordTokenizer();

    // Add crypto-specific sentiment words
    this.addCryptoSentimentWords();
  }

  /**
   * Analyze sentiment of a given text
   */
  async analyzeSentiment(request: SentimentAnalysisRequest): Promise<SentimentAnalysisResponse> {
    const { text, platform } = request;

    // Preprocess text based on platform
    const processedText = this.preprocessText(text, platform);

    // Perform sentiment analysis
    const result = this.sentiment.analyze(processedText);

    // Normalize score to -1 to 1 range
    const normalizedScore = this.normalizeScore(result.score, result.tokens.length);

    return {
      score: normalizedScore,
      comparative: result.comparative,
      calculation: result.calculation.map(calc => ({
        word: String(calc.word),
        score: calc.score,
      })),
      tokens: result.tokens,
      words: result.words,
      positive: result.positive,
      negative: result.negative,
    };
  }

  /**
   * Analyze sentiment for multiple texts and return aggregated score
   */
  async analyzeBatchSentiment(
    texts: string[],
    platform?: SocialPlatform
  ): Promise<{ aggregatedScore: number; individual: SentimentAnalysisResponse[] }> {
    if (texts.length === 0) {
      return {
        aggregatedScore: 0,
        individual: [],
      };
    }

    const results = await Promise.all(texts.map(text => this.analyzeSentiment({ text, platform })));

    const aggregatedScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;

    return {
      aggregatedScore: Math.max(-1, Math.min(1, aggregatedScore)),
      individual: results,
    };
  }

  /**
   * Extract keywords and hashtags from text
   */
  extractKeywords(
    text: string,
    platform?: SocialPlatform
  ): {
    keywords: string[];
    hashtags: string[];
    mentions: string[];
  } {
    const processedText = this.preprocessText(text, platform);

    // Extract hashtags
    const hashtags = (text.match(/#\w+/g) || []).map(tag => tag.toLowerCase());

    // Extract mentions
    const mentions = (text.match(/@\w+/g) || []).map(mention => mention.toLowerCase());

    // Extract keywords using tokenization and filtering
    const tokens = this.tokenizer.tokenize(processedText.toLowerCase());
    const keywords = tokens
      .filter((token: string) => token.length > 2)
      .filter((token: string) => !this.isStopWord(token))
      .filter((token: string) => /^[a-zA-Z]+$/.test(token));

    return {
      keywords: [...new Set(keywords as string[])],
      hashtags: [...new Set(hashtags)],
      mentions: [...new Set(mentions)],
    };
  }

  /**
   * Calculate trending score based on sentiment and engagement metrics
   */
  calculateTrendingScore(
    sentimentScore: number,
    mentionCount: number,
    engagementRate: number,
    influencerMentions: number
  ): number {
    // Weighted scoring algorithm
    const sentimentWeight = 0.3;
    const mentionWeight = 0.4;
    const engagementWeight = 0.2;
    const influencerWeight = 0.1;

    // Normalize inputs
    const normalizedSentiment = (sentimentScore + 1) / 2; // Convert -1,1 to 0,1
    const normalizedMentions = Math.min(mentionCount / 1000, 1); // Cap at 1000 mentions
    const normalizedEngagement = Math.min(engagementRate, 1);
    const normalizedInfluencer = Math.min(influencerMentions / 10, 1); // Cap at 10 influencer mentions

    const trendingScore =
      normalizedSentiment * sentimentWeight +
      normalizedMentions * mentionWeight +
      normalizedEngagement * engagementWeight +
      normalizedInfluencer * influencerWeight;

    return Math.round(trendingScore * 100);
  }

  /**
   * Detect viral potential based on social metrics
   */
  detectViralPotential(
    mentionIncrease: number,
    sentimentScore: number,
    influencerActivity: boolean,
    trendingScore: number
  ): 'low' | 'medium' | 'high' {
    let score = 0;

    // Mention increase factor (0-40 points)
    if (mentionIncrease > 500) score += 40;
    else if (mentionIncrease > 200) score += 30;
    else if (mentionIncrease > 50) score += 20;
    else if (mentionIncrease > 10) score += 10;

    // Sentiment factor (0-30 points)
    if (sentimentScore > 0.5) score += 30;
    else if (sentimentScore > 0.2) score += 20;
    else if (sentimentScore > -0.2) score += 10;

    // Influencer activity factor (0-20 points)
    if (influencerActivity) score += 20;

    // Trending score factor (0-10 points)
    if (trendingScore > 80) score += 10;
    else if (trendingScore > 60) score += 5;

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Preprocess text based on platform-specific characteristics
   */
  private preprocessText(text: string, platform?: SocialPlatform): string {
    let processed = text;

    // Remove URLs
    processed = processed.replace(/https?:\/\/[^\s]+/g, '');

    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // Platform-specific preprocessing
    switch (platform) {
      case 'twitter':
        // Remove retweet indicators
        processed = processed.replace(/^RT\s+/i, '');
        break;
      case 'reddit':
        // Remove Reddit-specific formatting
        processed = processed.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
        processed = processed.replace(/\*(.*?)\*/g, '$1'); // Italic
        break;
      case 'telegram':
        // Remove Telegram-specific formatting
        processed = processed.replace(/`(.*?)`/g, '$1'); // Code
        break;
    }

    return processed;
  }

  /**
   * Normalize sentiment score to -1 to 1 range
   */
  private normalizeScore(score: number, tokenCount: number): number {
    if (tokenCount === 0) return 0;

    // Use comparative score and apply sigmoid function for normalization
    const comparative = score / tokenCount;
    const normalized = 2 / (1 + Math.exp(-comparative)) - 1;

    return Math.max(-1, Math.min(1, normalized));
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Add crypto-specific sentiment words to the sentiment analyzer
   */
  private addCryptoSentimentWords(): void {
    // Positive crypto terms
    const positiveWords = {
      moon: 3,
      mooning: 3,
      bullish: 2,
      hodl: 2,
      diamond: 2,
      hands: 1,
      pump: 2,
      rocket: 2,
      lambo: 2,
      gains: 2,
      profit: 2,
      breakout: 2,
      rally: 2,
      surge: 2,
      spike: 1,
      gem: 2,
      golden: 2,
      bullrun: 3,
      ath: 2, // All-time high
      buy: 1,
      accumulate: 1,
      strong: 1,
      solid: 1,
      promising: 2,
      potential: 1,
      undervalued: 2,
    };

    // Negative crypto terms
    const negativeWords = {
      dump: -2,
      crash: -3,
      bearish: -2,
      rekt: -3,
      rug: -3,
      rugpull: -3,
      scam: -3,
      ponzi: -3,
      shitcoin: -2,
      fud: -2,
      panic: -2,
      sell: -1,
      drop: -1,
      fall: -1,
      decline: -1,
      bear: -1,
      bearmarket: -2,
      correction: -1,
      dip: -1,
      overvalued: -1,
      bubble: -2,
      manipulation: -2,
      whale: -1, // Can be negative in context of manipulation
      terrible: -3,
    };

    // Register custom words with the sentiment analyzer
    this.sentiment.registerLanguage('en', {
      labels: { ...positiveWords, ...negativeWords },
    });
  }
}
