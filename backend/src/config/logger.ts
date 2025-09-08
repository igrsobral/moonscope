import type { FastifyLoggerOptions } from 'fastify';
import type { PinoLoggerOptions } from 'fastify/types/logger';

/**
 * Logger configuration for different environments
 */
export const getLoggerConfig = (nodeEnv: string, logLevel: string): FastifyLoggerOptions => {
  const baseConfig: PinoLoggerOptions = {
    level: logLevel,
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  if (nodeEnv === 'production') {
    // Production logging - structured JSON format
    return {
      ...baseConfig,
      serializers: {
        req: (request: any) => ({
          method: request.method,
          url: request.url,
          headers: {
            host: request.headers?.host,
            'user-agent': request.headers?.['user-agent'],
            'content-type': request.headers?.['content-type'],
          },
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort || 0,
        }),
        res: (response: any) => ({
          statusCode: response.statusCode,
          headers: {
            'content-type': response.getHeader?.('content-type') || '',
            'content-length': response.getHeader?.('content-length') || '',
          },
        }),
        err: (error: any) => ({
          type: error.constructor?.name || 'Error',
          message: error.message || 'Unknown error',
          stack: error.stack || '',
        }),
      },
    };
  }

  if (nodeEnv === 'test') {
    // Test environment - minimal logging
    return {
      level: 'silent',
    };
  }

  // Development logging - pretty print for better readability
  return {
    ...baseConfig,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
        hideObject: false,
      },
    },
  } as FastifyLoggerOptions;
};
