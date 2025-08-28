import { FastifyBaseLogger } from 'fastify';
import { HttpClient } from './http-client.js';

export interface DexPoolData {
  pairAddress: string;
  baseToken: string;
  quoteToken: string;
  baseSymbol: string;
  quoteSymbol: string;
  totalLiquidity: number;
  baseReserve: number;
  quoteReserve: number;
  volume24h: number;
  fees24h: number;
  apr?: number;
  priceImpact1k: number;
  priceImpact10k: number;
  priceImpact100k: number;
}

export interface DexTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface DexPairInfo {
  pairAddress: string;
  token0: DexTokenInfo;
  token1: DexTokenInfo;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  price: string;
}

export abstract class BaseDexClient {
  protected httpClient: HttpClient;
  protected logger?: FastifyBaseLogger;
  protected exchange: string;

  constructor(
    baseUrl: string,
    exchange: string,
    options: {
      timeout?: number;
      logger?: FastifyBaseLogger;
      apiKey?: string;
    } = {}
  ) {
    this.exchange = exchange;
    this.logger = options.logger;
    this.httpClient = new HttpClient(baseUrl, {
      timeout: options.timeout || 10000,
      headers: options.apiKey ? { 'X-API-Key': options.apiKey } : {},
      logger: options.logger,
    });
  }

  abstract getPoolData(tokenAddress: string): Promise<DexPoolData[]>;
  abstract getPairInfo(pairAddress: string): Promise<DexPairInfo>;
  abstract getTopPools(limit?: number): Promise<DexPoolData[]>;
  abstract searchPools(query: string): Promise<DexPoolData[]>;

  getExchangeName(): string {
    return this.exchange;
  }

  protected calculatePriceImpact(
    inputAmount: number,
    inputReserve: number,
    outputReserve: number
  ): number {
    if (inputReserve === 0 || outputReserve === 0) return 100;
    
    const k = inputReserve * outputReserve;
    const newInputReserve = inputReserve + inputAmount;
    const newOutputReserve = k / newInputReserve;
    const outputAmount = outputReserve - newOutputReserve;
    
    const expectedOutput = (inputAmount * outputReserve) / inputReserve;
    const priceImpact = ((expectedOutput - outputAmount) / expectedOutput) * 100;
    
    return Math.max(0, priceImpact);
  }
}

export class UniswapV2Client extends BaseDexClient {
  constructor(options: { timeout?: number; logger?: FastifyBaseLogger } = {}) {
    super('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', 'uniswap-v2', options);
  }

  async getPoolData(tokenAddress: string): Promise<DexPoolData[]> {
    try {
      const query = `
        query GetPairs($token: String!) {
          pairs(
            where: { 
              or: [
                { token0: $token },
                { token1: $token }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 10
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
            token0Price
            token1Price
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { token: tokenAddress.toLowerCase() },
      });

      const pools: DexPoolData[] = [];
      
      for (const pair of response.data.pairs) {
        const isToken0 = pair.token0.id.toLowerCase() === tokenAddress.toLowerCase();
        const baseToken = isToken0 ? pair.token0 : pair.token1;
        const quoteToken = isToken0 ? pair.token1 : pair.token0;
        const baseReserve = parseFloat(isToken0 ? pair.reserve0 : pair.reserve1);
        const quoteReserve = parseFloat(isToken0 ? pair.reserve1 : pair.reserve0);

        pools.push({
          pairAddress: pair.id,
          baseToken: baseToken.id,
          quoteToken: quoteToken.id,
          baseSymbol: baseToken.symbol,
          quoteSymbol: quoteToken.symbol,
          totalLiquidity: parseFloat(pair.reserveUSD),
          baseReserve,
          quoteReserve,
          volume24h: parseFloat(pair.volumeUSD),
          fees24h: parseFloat(pair.volumeUSD) * 0.003, // 0.3% fee
          priceImpact1k: this.calculatePriceImpact(1000, baseReserve, quoteReserve),
          priceImpact10k: this.calculatePriceImpact(10000, baseReserve, quoteReserve),
          priceImpact100k: this.calculatePriceImpact(100000, baseReserve, quoteReserve),
        });
      }

      this.logger?.info({ tokenAddress, poolCount: pools.length }, 'Fetched Uniswap V2 pool data');
      return pools;
    } catch (error) {
      this.logger?.error({ error, tokenAddress }, 'Failed to fetch Uniswap V2 pool data');
      throw error;
    }
  }

  async getPairInfo(pairAddress: string): Promise<DexPairInfo> {
    try {
      const query = `
        query GetPair($id: String!) {
          pair(id: $id) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            totalSupply
            token0Price
            token1Price
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { id: pairAddress.toLowerCase() },
      });

      const pair = response.data.pair;
      if (!pair) {
        throw new Error(`Pair not found: ${pairAddress}`);
      }

      return {
        pairAddress: pair.id,
        token0: {
          address: pair.token0.id,
          symbol: pair.token0.symbol,
          name: pair.token0.name,
          decimals: parseInt(pair.token0.decimals),
        },
        token1: {
          address: pair.token1.id,
          symbol: pair.token1.symbol,
          name: pair.token1.name,
          decimals: parseInt(pair.token1.decimals),
        },
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        totalSupply: pair.totalSupply,
        price: pair.token0Price,
      };
    } catch (error) {
      this.logger?.error({ error, pairAddress }, 'Failed to fetch Uniswap V2 pair info');
      throw error;
    }
  }

  async getTopPools(limit = 50): Promise<DexPoolData[]> {
    try {
      const query = `
        query GetTopPairs($limit: Int!) {
          pairs(
            orderBy: reserveUSD
            orderDirection: desc
            first: $limit
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
            token0Price
            token1Price
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { limit },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.003,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ poolCount: pools.length }, 'Fetched top Uniswap V2 pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error }, 'Failed to fetch top Uniswap V2 pools');
      throw error;
    }
  }

  async searchPools(query: string): Promise<DexPoolData[]> {
    try {
      const graphQuery = `
        query SearchPairs($search: String!) {
          pairs(
            where: {
              or: [
                { token0_: { symbol_contains_nocase: $search } },
                { token1_: { symbol_contains_nocase: $search } },
                { token0_: { name_contains_nocase: $search } },
                { token1_: { name_contains_nocase: $search } }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 20
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query: graphQuery,
        variables: { search: query },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.003,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ query, poolCount: pools.length }, 'Searched Uniswap V2 pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error, query }, 'Failed to search Uniswap V2 pools');
      throw error;
    }
  }
}

export class SushiSwapClient extends BaseDexClient {
  constructor(options: { timeout?: number; logger?: FastifyBaseLogger } = {}) {
    super('https://api.thegraph.com/subgraphs/name/sushiswap/exchange', 'sushiswap', options);
  }

  async getPoolData(tokenAddress: string): Promise<DexPoolData[]> {
    // Similar implementation to UniswapV2Client but for SushiSwap
    // Using the same GraphQL structure as they're both AMM DEXs
    return this.getUniswapStylePoolData(tokenAddress);
  }

  async getPairInfo(pairAddress: string): Promise<DexPairInfo> {
    return this.getUniswapStylePairInfo(pairAddress);
  }

  async getTopPools(limit = 50): Promise<DexPoolData[]> {
    return this.getUniswapStyleTopPools(limit);
  }

  async searchPools(query: string): Promise<DexPoolData[]> {
    return this.getUniswapStyleSearchPools(query);
  }

  private async getUniswapStylePoolData(tokenAddress: string): Promise<DexPoolData[]> {
    // Implementation similar to UniswapV2Client but with SushiSwap-specific adjustments
    try {
      const query = `
        query GetPairs($token: String!) {
          pairs(
            where: { 
              or: [
                { token0: $token },
                { token1: $token }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 10
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { token: tokenAddress.toLowerCase() },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => {
        const isToken0 = pair.token0.id.toLowerCase() === tokenAddress.toLowerCase();
        const baseToken = isToken0 ? pair.token0 : pair.token1;
        const quoteToken = isToken0 ? pair.token1 : pair.token0;
        const baseReserve = parseFloat(isToken0 ? pair.reserve0 : pair.reserve1);
        const quoteReserve = parseFloat(isToken0 ? pair.reserve1 : pair.reserve0);

        return {
          pairAddress: pair.id,
          baseToken: baseToken.id,
          quoteToken: quoteToken.id,
          baseSymbol: baseToken.symbol,
          quoteSymbol: quoteToken.symbol,
          totalLiquidity: parseFloat(pair.reserveUSD),
          baseReserve,
          quoteReserve,
          volume24h: parseFloat(pair.volumeUSD),
          fees24h: parseFloat(pair.volumeUSD) * 0.0025, // 0.25% fee for SushiSwap
          priceImpact1k: this.calculatePriceImpact(1000, baseReserve, quoteReserve),
          priceImpact10k: this.calculatePriceImpact(10000, baseReserve, quoteReserve),
          priceImpact100k: this.calculatePriceImpact(100000, baseReserve, quoteReserve),
        };
      });

      this.logger?.info({ tokenAddress, poolCount: pools.length }, 'Fetched SushiSwap pool data');
      return pools;
    } catch (error) {
      this.logger?.error({ error, tokenAddress }, 'Failed to fetch SushiSwap pool data');
      throw error;
    }
  }

  private async getUniswapStylePairInfo(pairAddress: string): Promise<DexPairInfo> {
    // Similar to UniswapV2Client implementation
    try {
      const query = `
        query GetPair($id: String!) {
          pair(id: $id) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            totalSupply
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { id: pairAddress.toLowerCase() },
      });

      const pair = response.data.pair;
      if (!pair) {
        throw new Error(`Pair not found: ${pairAddress}`);
      }

      return {
        pairAddress: pair.id,
        token0: {
          address: pair.token0.id,
          symbol: pair.token0.symbol,
          name: pair.token0.name,
          decimals: parseInt(pair.token0.decimals),
        },
        token1: {
          address: pair.token1.id,
          symbol: pair.token1.symbol,
          name: pair.token1.name,
          decimals: parseInt(pair.token1.decimals),
        },
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        totalSupply: pair.totalSupply,
        price: '0', // Calculate from reserves
      };
    } catch (error) {
      this.logger?.error({ error, pairAddress }, 'Failed to fetch SushiSwap pair info');
      throw error;
    }
  }

  private async getUniswapStyleTopPools(limit = 50): Promise<DexPoolData[]> {
    // Similar implementation for top pools
    try {
      const query = `
        query GetTopPairs($limit: Int!) {
          pairs(
            orderBy: reserveUSD
            orderDirection: desc
            first: $limit
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { limit },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.0025,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ poolCount: pools.length }, 'Fetched top SushiSwap pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error }, 'Failed to fetch top SushiSwap pools');
      throw error;
    }
  }

  private async getUniswapStyleSearchPools(query: string): Promise<DexPoolData[]> {
    // Similar search implementation
    try {
      const graphQuery = `
        query SearchPairs($search: String!) {
          pairs(
            where: {
              or: [
                { token0_: { symbol_contains_nocase: $search } },
                { token1_: { symbol_contains_nocase: $search } },
                { token0_: { name_contains_nocase: $search } },
                { token1_: { name_contains_nocase: $search } }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 20
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query: graphQuery,
        variables: { search: query },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.0025,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ query, poolCount: pools.length }, 'Searched SushiSwap pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error, query }, 'Failed to search SushiSwap pools');
      throw error;
    }
  }
}

export class PancakeSwapClient extends BaseDexClient {
  constructor(options: { timeout?: number; logger?: FastifyBaseLogger } = {}) {
    super('https://api.thegraph.com/subgraphs/name/pancakeswap/exchange', 'pancakeswap', options);
  }

  async getPoolData(tokenAddress: string): Promise<DexPoolData[]> {
    // PancakeSwap implementation for BSC
    try {
      const query = `
        query GetPairs($token: String!) {
          pairs(
            where: { 
              or: [
                { token0: $token },
                { token1: $token }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 10
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { token: tokenAddress.toLowerCase() },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => {
        const isToken0 = pair.token0.id.toLowerCase() === tokenAddress.toLowerCase();
        const baseToken = isToken0 ? pair.token0 : pair.token1;
        const quoteToken = isToken0 ? pair.token1 : pair.token0;
        const baseReserve = parseFloat(isToken0 ? pair.reserve0 : pair.reserve1);
        const quoteReserve = parseFloat(isToken0 ? pair.reserve1 : pair.reserve0);

        return {
          pairAddress: pair.id,
          baseToken: baseToken.id,
          quoteToken: quoteToken.id,
          baseSymbol: baseToken.symbol,
          quoteSymbol: quoteToken.symbol,
          totalLiquidity: parseFloat(pair.reserveUSD),
          baseReserve,
          quoteReserve,
          volume24h: parseFloat(pair.volumeUSD),
          fees24h: parseFloat(pair.volumeUSD) * 0.0025, // 0.25% fee for PancakeSwap
          priceImpact1k: this.calculatePriceImpact(1000, baseReserve, quoteReserve),
          priceImpact10k: this.calculatePriceImpact(10000, baseReserve, quoteReserve),
          priceImpact100k: this.calculatePriceImpact(100000, baseReserve, quoteReserve),
        };
      });

      this.logger?.info({ tokenAddress, poolCount: pools.length }, 'Fetched PancakeSwap pool data');
      return pools;
    } catch (error) {
      this.logger?.error({ error, tokenAddress }, 'Failed to fetch PancakeSwap pool data');
      throw error;
    }
  }

  async getPairInfo(pairAddress: string): Promise<DexPairInfo> {
    // Similar implementation to other DEXs
    try {
      const query = `
        query GetPair($id: String!) {
          pair(id: $id) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            totalSupply
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { id: pairAddress.toLowerCase() },
      });

      const pair = response.data.pair;
      if (!pair) {
        throw new Error(`Pair not found: ${pairAddress}`);
      }

      return {
        pairAddress: pair.id,
        token0: {
          address: pair.token0.id,
          symbol: pair.token0.symbol,
          name: pair.token0.name,
          decimals: parseInt(pair.token0.decimals),
        },
        token1: {
          address: pair.token1.id,
          symbol: pair.token1.symbol,
          name: pair.token1.name,
          decimals: parseInt(pair.token1.decimals),
        },
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        totalSupply: pair.totalSupply,
        price: '0',
      };
    } catch (error) {
      this.logger?.error({ error, pairAddress }, 'Failed to fetch PancakeSwap pair info');
      throw error;
    }
  }

  async getTopPools(limit = 50): Promise<DexPoolData[]> {
    // Implementation for top pools
    try {
      const query = `
        query GetTopPairs($limit: Int!) {
          pairs(
            orderBy: reserveUSD
            orderDirection: desc
            first: $limit
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query,
        variables: { limit },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.0025,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ poolCount: pools.length }, 'Fetched top PancakeSwap pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error }, 'Failed to fetch top PancakeSwap pools');
      throw error;
    }
  }

  async searchPools(query: string): Promise<DexPoolData[]> {
    // Search implementation
    try {
      const graphQuery = `
        query SearchPairs($search: String!) {
          pairs(
            where: {
              or: [
                { token0_: { symbol_contains_nocase: $search } },
                { token1_: { symbol_contains_nocase: $search } },
                { token0_: { name_contains_nocase: $search } },
                { token1_: { name_contains_nocase: $search } }
              ]
            }
            orderBy: reserveUSD
            orderDirection: desc
            first: 20
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            volumeUSD
          }
        }
      `;

      const response = await this.httpClient.post('', {
        query: graphQuery,
        variables: { search: query },
      });

      const pools: DexPoolData[] = response.data.pairs.map((pair: any) => ({
        pairAddress: pair.id,
        baseToken: pair.token0.id,
        quoteToken: pair.token1.id,
        baseSymbol: pair.token0.symbol,
        quoteSymbol: pair.token1.symbol,
        totalLiquidity: parseFloat(pair.reserveUSD),
        baseReserve: parseFloat(pair.reserve0),
        quoteReserve: parseFloat(pair.reserve1),
        volume24h: parseFloat(pair.volumeUSD),
        fees24h: parseFloat(pair.volumeUSD) * 0.0025,
        priceImpact1k: this.calculatePriceImpact(1000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact10k: this.calculatePriceImpact(10000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
        priceImpact100k: this.calculatePriceImpact(100000, parseFloat(pair.reserve0), parseFloat(pair.reserve1)),
      }));

      this.logger?.info({ query, poolCount: pools.length }, 'Searched PancakeSwap pools');
      return pools;
    } catch (error) {
      this.logger?.error({ error, query }, 'Failed to search PancakeSwap pools');
      throw error;
    }
  }
}