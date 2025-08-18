import { z } from 'zod';

// Environment validation schema using Zod
export const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),

  // External APIs
  COINGECKO_API_KEY: z.string().optional(),
  MORALIS_API_KEY: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),

  // Notification Services
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().min(1000).default(60000),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Fastify env plugin options
export const envOptions = {
  confKey: 'config',
  schema: {
    type: 'object',
    required: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'],
    properties: {
      NODE_ENV: {
        type: 'string',
        enum: ['development', 'production', 'test'],
        default: 'development',
      },
      PORT: {
        type: 'number',
        minimum: 1,
        maximum: 65535,
        default: 3001,
      },
      HOST: {
        type: 'string',
        default: '0.0.0.0',
      },
      LOG_LEVEL: {
        type: 'string',
        enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
        default: 'info',
      },
      DATABASE_URL: {
        type: 'string',
        pattern: '^postgresql://.+',
      },
      REDIS_URL: {
        type: 'string',
        pattern: '^redis://.+',
      },
      JWT_SECRET: {
        type: 'string',
        minLength: 32,
      },
      COINGECKO_API_KEY: {
        type: 'string',
      },
      MORALIS_API_KEY: {
        type: 'string',
      },
      TWITTER_BEARER_TOKEN: {
        type: 'string',
      },
      REDDIT_CLIENT_ID: {
        type: 'string',
      },
      REDDIT_CLIENT_SECRET: {
        type: 'string',
      },
      SENDGRID_API_KEY: {
        type: 'string',
      },
      TWILIO_ACCOUNT_SID: {
        type: 'string',
      },
      TWILIO_AUTH_TOKEN: {
        type: 'string',
      },
      RATE_LIMIT_MAX: {
        type: 'number',
        minimum: 1,
        default: 100,
      },
      RATE_LIMIT_WINDOW: {
        type: 'number',
        minimum: 1000,
        default: 60000,
      },
    },
  },
  dotenv: true,
};