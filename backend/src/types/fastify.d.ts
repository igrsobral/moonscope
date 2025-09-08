import 'fastify';
import type { EnvConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: EnvConfig;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      walletAddress?: string;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number;
      email: string;
      walletAddress?: string;
    };
    user: {
      id: number;
      email: string;
      walletAddress?: string;
    };
  }
}
