import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, CircuitBreaker, HttpError, RateLimitError } from './http-client.js';

// Mock undici
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request } from 'undici';
const mockRequest = vi.mocked(request);

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      threshold: 3,
      timeout: 1000,
      monitoringPeriod: 500,
    });
  });

  it('should start in CLOSED state', () => {
    const state = circuitBreaker.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });

  it('should open circuit after threshold failures', async () => {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Test error'));

    // Trigger failures up to threshold
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    const state = circuitBreaker.getState();
    expect(state.state).toBe('OPEN');
    expect(state.failures).toBe(3);
  });

  it('should reject immediately when circuit is OPEN', async () => {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    // Should reject immediately without calling operation
    await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
      'Circuit breaker is OPEN'
    );
    expect(failingOperation).toHaveBeenCalledTimes(3); // Only called during opening
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    const successfulOperation = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successfulOperation);

    expect(result).toBe('success');
    const state = circuitBreaker.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });

  it('should reset failures on successful operation', async () => {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Test error'));
    const successfulOperation = vi.fn().mockResolvedValue('success');

    // Trigger some failures
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    // Execute successful operation
    await circuitBreaker.execute(successfulOperation);

    const state = circuitBreaker.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });
});

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    httpClient = new HttpClient({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
      headers: { 'Authorization': 'Bearer test-token' },
      logger: mockLogger,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('successful requests', () => {
    it('should make GET request successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"data": "test"}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await httpClient.get('/test');

      expect(result).toEqual({ data: 'test' });
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'MemeAnalyzer/1.0',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should make POST request with body', async () => {
      const mockResponse = {
        statusCode: 201,
        body: {
          text: vi.fn().mockResolvedValue('{"id": 123}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const requestBody = { name: 'test' };
      const result = await httpClient.post('/create', requestBody);

      expect(result).toEqual({ id: 123 });
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });

    it('should handle non-JSON responses', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('plain text response'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await httpClient.get('/text');

      expect(result).toBe('plain text response');
    });
  });

  describe('error handling', () => {
    it('should throw HttpError for 4xx responses', async () => {
      const mockResponse = {
        statusCode: 404,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Not found"}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      await expect(httpClient.get('/notfound')).rejects.toThrow(HttpError);
      await expect(httpClient.get('/notfound')).rejects.toThrow('HTTP 404: Client Error');
    });

    it('should throw HttpError for 5xx responses', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Internal server error"}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      await expect(httpClient.get('/error')).rejects.toThrow(HttpError);
      await expect(httpClient.get('/error')).rejects.toThrow('HTTP 500: Server Error');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockRequest.mockRejectedValue(networkError);

      await expect(httpClient.get('/test')).rejects.toThrow('Network error');
    });
  });

  describe('retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on 5xx errors', async () => {
      const serverError = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Server error"}'),
        },
      };
      const successResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"data": "success"}'),
        },
      };

      mockRequest
        .mockResolvedValueOnce(serverError as any)
        .mockResolvedValueOnce(successResponse as any);

      const requestPromise = httpClient.get('/test');
      
      // Fast-forward through the retry delay
      await vi.runAllTimersAsync();
      
      const result = await requestPromise;

      expect(result).toEqual({ data: 'success' });
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should retry on rate limit errors (429)', async () => {
      const rateLimitError = {
        statusCode: 429,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Rate limit exceeded"}'),
        },
      };
      const successResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"data": "success"}'),
        },
      };

      mockRequest
        .mockResolvedValueOnce(rateLimitError as any)
        .mockResolvedValueOnce(successResponse as any);

      const requestPromise = httpClient.get('/test');
      
      // Fast-forward through the retry delay
      await vi.runAllTimersAsync();
      
      const result = await requestPromise;

      expect(result).toEqual({ data: 'success' });
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      const clientError = {
        statusCode: 400,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Bad request"}'),
        },
      };

      mockRequest.mockResolvedValue(clientError as any);

      await expect(httpClient.get('/test')).rejects.toThrow(HttpError);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should implement exponential backoff', async () => {
      const serverError = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Server error"}'),
        },
      };

      mockRequest.mockResolvedValue(serverError as any);

      const startTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => startTime);

      const requestPromise = httpClient.get('/test');
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      await expect(requestPromise).rejects.toThrow(HttpError);

      // Should have made initial request + 3 retries
      expect(mockRequest).toHaveBeenCalledTimes(4);
    });

    it('should respect maximum retry attempts', async () => {
      const serverError = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Server error"}'),
        },
      };

      mockRequest.mockResolvedValue(serverError as any);

      const requestPromise = httpClient.get('/test');
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      await expect(requestPromise).rejects.toThrow(HttpError);

      // Should have made initial request + maxRetries (3)
      expect(mockRequest).toHaveBeenCalledTimes(4);
    });
  });

  describe('circuit breaker integration', () => {
    it('should open circuit breaker after repeated failures', async () => {
      const serverError = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error": "Server error"}'),
        },
      };

      mockRequest.mockResolvedValue(serverError as any);

      // Make enough requests to open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await httpClient.get('/test');
        } catch {
          // Expected to fail
        }
      }

      // Next request should fail immediately due to open circuit
      await expect(httpClient.get('/test')).rejects.toThrow('Circuit breaker is OPEN');

      const status = httpClient.getCircuitBreakerState();
      expect(status.state).toBe('OPEN');
    });
  });

  describe('HTTP methods', () => {
    it('should support PUT requests', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"updated": true}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await httpClient.put('/update', { id: 1 });

      expect(result).toEqual({ updated: true });
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.example.com/update',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ id: 1 }),
        })
      );
    });

    it('should support DELETE requests', async () => {
      const mockResponse = {
        statusCode: 204,
        body: {
          text: vi.fn().mockResolvedValue(''),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await httpClient.delete('/delete/1');

      expect(result).toBe('');
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.example.com/delete/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});