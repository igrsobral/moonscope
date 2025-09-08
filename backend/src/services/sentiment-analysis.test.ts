import { describe, it, expect, beforeEach } from 'vitest';
import { SentimentAnalysisService } from './sentiment-analysis.js';

describe('SentimentAnalysisService', () => {
  let service: SentimentAnalysisService;

  beforeEach(() => {
    service = new SentimentAnalysisService();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', async () => {
      const result = await service.analyzeSentiment({
        text: 'This coin is amazing! Going to the moon! 🚀',
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.positive.length).toBeGreaterThan(0);
      expect(result.tokens).toContain('amazing');
    });

    it('should analyze negative sentiment correctly', async () => {
      const result = await service.analyzeSentiment({
        text: 'This is a terrible scam coin. Total rugpull!',
      });

      expect(result.score).toBeLessThan(0);
      expect(result.negative.length).toBeGreaterThan(0);
      expect(result.tokens).toContain('terrible');
    });

    it('should handle neutral sentiment', async () => {
      const result = await service.analyzeSentiment({
        text: 'The price is what it is today.',
      });

      expect(result.score).toBeCloseTo(0, 1);
    });

    it('should handle crypto-specific positive terms', async () => {
      const result = await service.analyzeSentiment({
        text: 'HODL diamond hands! This is going to moon!',
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.positive).toContain('diamond');
    });

    it('should handle crypto-specific negative terms', async () => {
      const result = await service.analyzeSentiment({
        text: 'Dump incoming! This is a rugpull scam!',
      });

      expect(result.score).toBeLessThan(0);
      expect(result.negative).toContain('dump');
      expect(result.negative).toContain('rugpull');
    });

    it('should preprocess Twitter text correctly', async () => {
      const result = await service.analyzeSentiment({
        text: 'RT @user: This coin is great! https://example.com #crypto',
        platform: 'twitter',
      });

      expect(result.tokens).not.toContain('RT');
      expect(result.tokens).not.toContain('https://example.com');
    });

    it('should preprocess Reddit text correctly', async () => {
      const result = await service.analyzeSentiment({
        text: '**This** is *amazing* coin discussion',
        platform: 'reddit',
      });

      expect(result.tokens).toContain('this');
      expect(result.tokens).toContain('amazing');
    });
  });

  describe('analyzeBatchSentiment', () => {
    it('should analyze multiple texts and return aggregated score', async () => {
      const texts = [
        'This coin is amazing!',
        'Great project with solid fundamentals',
        'Not sure about this one',
        'Terrible scam project',
      ];

      const result = await service.analyzeBatchSentiment(texts);

      expect(result.individual).toHaveLength(4);
      expect(result.aggregatedScore).toBeGreaterThanOrEqual(-1);
      expect(result.aggregatedScore).toBeLessThanOrEqual(1);
      expect(typeof result.aggregatedScore).toBe('number');
    });

    it('should handle empty array', async () => {
      const result = await service.analyzeBatchSentiment([]);

      expect(result.individual).toHaveLength(0);
      expect(result.aggregatedScore).toBe(0);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords, hashtags, and mentions', async () => {
      const text = 'Great #crypto project by @developer with amazing potential!';

      const result = service.extractKeywords(text);

      expect(result.hashtags).toContain('#crypto');
      expect(result.mentions).toContain('@developer');
      expect(result.keywords).toContain('great');
      expect(result.keywords).toContain('project');
      expect(result.keywords).toContain('amazing');
      expect(result.keywords).toContain('potential');
    });

    it('should filter out stop words', async () => {
      const text = 'This is a great project with the best team';

      const result = service.extractKeywords(text);

      expect(result.keywords).not.toContain('this');
      expect(result.keywords).not.toContain('is');
      expect(result.keywords).not.toContain('a');
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).toContain('great');
      expect(result.keywords).toContain('project');
    });

    it('should handle duplicate keywords', async () => {
      const text = 'Great great great project!';

      const result = service.extractKeywords(text);

      expect(result.keywords.filter(k => k === 'great')).toHaveLength(1);
    });
  });

  describe('calculateTrendingScore', () => {
    it('should calculate trending score correctly', () => {
      const score = service.calculateTrendingScore(
        0.8, // High positive sentiment
        500, // High mention count
        0.7, // Good engagement rate
        3 // Some influencer mentions
      );

      expect(score).toBeGreaterThan(60);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle negative sentiment', () => {
      const score = service.calculateTrendingScore(
        -0.5, // Negative sentiment
        100, // Moderate mentions
        0.3, // Low engagement
        0 // No influencer mentions
      );

      expect(score).toBeLessThan(50);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should cap values appropriately', () => {
      const score = service.calculateTrendingScore(
        1.0, // Max sentiment
        10000, // Very high mentions (should be capped)
        2.0, // Very high engagement (should be capped)
        100 // Very high influencer mentions (should be capped)
      );

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('detectViralPotential', () => {
    it('should detect high viral potential', () => {
      const potential = service.detectViralPotential(
        1000, // High mention increase
        0.8, // High sentiment
        true, // Influencer activity
        90 // High trending score
      );

      expect(potential).toBe('high');
    });

    it('should detect medium viral potential', () => {
      const potential = service.detectViralPotential(
        100, // Moderate mention increase
        0.3, // Moderate sentiment
        false, // No influencer activity
        70 // Moderate trending score
      );

      expect(potential).toBe('medium');
    });

    it('should detect low viral potential', () => {
      const potential = service.detectViralPotential(
        5, // Low mention increase
        -0.2, // Negative sentiment
        false, // No influencer activity
        30 // Low trending score
      );

      expect(potential).toBe('low');
    });

    it('should handle edge cases', () => {
      const potential = service.detectViralPotential(0, 0, false, 0);
      expect(potential).toBe('low');
    });
  });
});
