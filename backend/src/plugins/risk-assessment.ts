import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { RiskAssessmentService } from '../services/risk-assessment.js';
import { MoralisClient } from '../services/moralis-client.js';
import { CoinGeckoClient } from '../services/coingecko-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    riskAssessmentService: RiskAssessmentService;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  const moralisClient = new MoralisClient({
    apiKey: fastify.config.MORALIS_API_KEY || 'dummy-key',
    logger: fastify.log,
  });

  const coinGeckoClient = new CoinGeckoClient({
    apiKey: fastify.config.COINGECKO_API_KEY!,
    logger: fastify.log,
  });

  const defaultConfig = {
    weights: {
      liquidity: 0.35,
      holderDistribution: 0.25,
      contractSecurity: 0.25,
      socialMetrics: 0.15,
    },
    thresholds: {
      liquidity: {
        excellent: 10000000, // $10M+
        good: 1000000,       // $1M+
        fair: 100000,        // $100K+
        poor: 10000,         // $10K+
      },
      holderDistribution: {
        maxTopHoldersPercentage: 50, // Top 10 holders should own <50%
        minHolderCount: 100,
      },
      contractSecurity: {
        verificationRequired: true,
        proxyContractPenalty: 20,
        ownershipRenouncedBonus: 15,
      },
      socialMetrics: {
        minSentimentScore: 0.3,
        minCommunitySize: 1000,
      },
    },
  };

  const riskAssessmentService = new RiskAssessmentService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    moralisClient,
    coinGeckoClient,
    defaultConfig
  );

  fastify.decorate('riskAssessmentService', riskAssessmentService);

  fastify.log.info('Risk assessment service initialized');

  fastify.addHook('onClose', async () => {
    fastify.log.info('Risk assessment service shutting down');
  });
}, {
  name: 'risk-assessment',
  dependencies: ['env', 'database', 'cache'],
});