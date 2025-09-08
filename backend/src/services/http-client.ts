import { request } from 'undici';
import type { Dispatcher } from 'undici';
import { FastifyBaseLogger } from 'fastify';

export interface HttpClientOptions {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  logger?: FastifyBaseLogger;
}

export interface CircuitBreakerOptions {
  threshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private options: CircuitBreakerOptions = {
      threshold: 5,
      timeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export class HttpClient {
  private circuitBreaker: CircuitBreaker;
  private retryOptions: RetryOptions;

  constructor(
    private options: HttpClientOptions,
    circuitBreakerOptions?: CircuitBreakerOptions,
    retryOptions?: Partial<RetryOptions>
  ) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
    this.retryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      ...retryOptions,
    };
  }

  async get<T = any>(path: string, options?: Partial<Dispatcher.RequestOptions>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T = any>(
    path: string,
    body?: any,
    options?: Partial<Dispatcher.RequestOptions>
  ): Promise<T> {
    return this.request<T>('POST', path, { ...options, body: JSON.stringify(body) });
  }

  async put<T = any>(
    path: string,
    body?: any,
    options?: Partial<Dispatcher.RequestOptions>
  ): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body: JSON.stringify(body) });
  }

  async delete<T = any>(path: string, options?: Partial<Dispatcher.RequestOptions>): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(
    method: string,
    path: string,
    options?: Partial<Dispatcher.RequestOptions>
  ): Promise<T> {
    const url = `${this.options.baseUrl}${path}`;

    return this.circuitBreaker.execute(async () => {
      return this.executeWithRetry<T>(method, url, options);
    });
  }

  private async executeWithRetry<T>(
    method: string,
    url: string,
    options?: Partial<Dispatcher.RequestOptions>
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        const requestOptions: Dispatcher.RequestOptions = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MemeAnalyzer/1.0',
            ...this.options.headers,
            ...options?.headers,
          },
          bodyTimeout: this.options.timeout || 30000,
          headersTimeout: this.options.timeout || 30000,
          ...options,
        };

        this.options.logger?.debug(
          {
            method,
            url,
            attempt: attempt + 1,
            maxRetries: this.retryOptions.maxRetries + 1,
          },
          'Making HTTP request'
        );

        const response = await request(url, requestOptions);

        if (response.statusCode >= 400) {
          const errorBody = await response.body.text();
          throw new HttpError(
            `HTTP ${response.statusCode}: ${response.statusCode >= 500 ? 'Server Error' : 'Client Error'}`,
            response.statusCode,
            errorBody
          );
        }

        const responseText = await response.body.text();

        try {
          return JSON.parse(responseText) as T;
        } catch {
          return responseText as unknown as T;
        }
      } catch (error) {
        lastError = error as Error;

        this.options.logger?.warn(
          {
            method,
            url,
            attempt: attempt + 1,
            error: error instanceof Error ? error.message : String(error),
          },
          'HTTP request failed'
        );

        if (
          error instanceof HttpError &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 429
        ) {
          throw error;
        }

        if (attempt === this.retryOptions.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffFactor, attempt),
          this.retryOptions.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        this.options.logger?.debug(
          {
            attempt: attempt + 1,
            delay: jitteredDelay,
          },
          'Retrying HTTP request after delay'
        );

        await this.sleep(jitteredDelay);
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class RateLimitError extends HttpError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}
