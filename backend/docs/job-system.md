# Job System Documentation

The Meme Coin Analyzer uses a robust background job processing system built with BullMQ and Redis to handle various automated tasks including price updates, social media scraping, risk assessments, and maintenance operations.

## Architecture Overview

The job system consists of several key components:

- **Queue Plugin** (`src/plugins/queue.ts`) - Manages BullMQ queues and provides a unified interface
- **Job Processors** (`src/services/job-processors.ts`) - Handles the actual job execution logic
- **Job Scheduler** (`src/services/job-scheduler.ts`) - Manages scheduled and recurring jobs
- **Job Monitor** (`src/services/job-monitor.ts`) - Provides monitoring, metrics, and health checks
- **Jobs Plugin** (`src/plugins/jobs.ts`) - Integrates all job services with Fastify
- **Jobs Routes** (`src/routes/jobs.ts`) - HTTP API for job management

## Job Queues

The system uses five main job queues:

### 1. Price Updates Queue (`price-updates`)
- **Purpose**: Fetch and update cryptocurrency price data
- **Concurrency**: 5 workers
- **Rate Limit**: 10 jobs per minute
- **Schedule**: Every 5 minutes per coin
- **Jobs**:
  - `update-coin-price`: Updates price data for a specific coin

### 2. Social Scraping Queue (`social-scraping`)
- **Purpose**: Collect social media metrics and sentiment data
- **Concurrency**: 3 workers
- **Rate Limit**: 20 jobs per minute
- **Schedule**: Every 30 minutes per coin
- **Jobs**:
  - `scrape-social-data`: Collects social metrics from Twitter, Reddit, Telegram

### 3. Alert Processing Queue (`alert-processing`)
- **Purpose**: Check alert conditions and send notifications
- **Concurrency**: 10 workers
- **Rate Limit**: 100 jobs per minute
- **Schedule**: Every minute (global check)
- **Jobs**:
  - `check-alerts`: Checks all active alerts
  - `check-specific-alert`: Checks a specific alert

### 4. Risk Assessment Queue (`risk-assessment`)
- **Purpose**: Calculate risk scores for coins
- **Concurrency**: 2 workers
- **Rate Limit**: 5 jobs per minute
- **Schedule**: Every 2 hours per coin
- **Jobs**:
  - `assess-coin-risk`: Calculates comprehensive risk score

### 5. Maintenance Queue (`maintenance`)
- **Purpose**: System maintenance and cleanup tasks
- **Concurrency**: 1 worker
- **Rate Limit**: 2 jobs per minute
- **Schedule**: Various (daily, every 6 hours)
- **Jobs**:
  - `cleanup-old-price-data`: Removes old price data (90 days retention)
  - `cleanup-old-social-metrics`: Removes old social metrics (30 days retention)
  - `warm-cache`: Preloads frequently accessed data into cache

## Job Processing

### Price Update Jobs

```typescript
// Job data structure
{
  coinId: number,
  coinAddress: string,
  symbol: string
}

// Processing steps:
1. Fetch latest price data from external APIs
2. Store price data in database
3. Broadcast real-time updates via WebSocket
4. Update job progress to 100%
```

### Social Scraping Jobs

```typescript
// Job data structure
{
  coinId: number,
  keywords: string[],
  platforms: string[],
  timeframe: string
}

// Processing steps:
1. Collect social metrics from specified platforms
2. Analyze sentiment using NLP
3. Detect trending status
4. Store metrics in database
```

### Alert Processing Jobs

```typescript
// Job data structure
{
  alertId?: number,
  coinId?: number,
  alertType: string,
  condition: object,
  userId: number
}

// Processing steps:
1. Retrieve alert configuration
2. Check current market conditions
3. Evaluate alert condition
4. Send notifications if triggered
5. Update alert last triggered timestamp
```

### Risk Assessment Jobs

```typescript
// Job data structure
{
  coinId: number,
  symbol: string
}

// Processing steps:
1. Gather liquidity data
2. Analyze holder distribution
3. Check contract security
4. Calculate social risk factors
5. Compute overall risk score (1-100)
6. Store risk assessment in database
```

### Maintenance Jobs

```typescript
// Cleanup jobs data structure
{
  retentionDays: number
}

// Cache warming job
{
  // No specific data required
}
```

## Job Scheduling

### Automatic Scheduling

The system automatically schedules recurring jobs when initialized:

```typescript
// Price updates - every 5 minutes
await queueManager.addJob('price-updates', 'update-coin-price', data, {
  repeat: { pattern: '*/5 * * * *' }
});

// Social scraping - every 30 minutes
await queueManager.addJob('social-scraping', 'scrape-social-data', data, {
  repeat: { pattern: '*/30 * * * *' }
});

// Risk assessment - every 2 hours
await queueManager.addJob('risk-assessment', 'assess-coin-risk', data, {
  repeat: { pattern: '0 */2 * * *' }
});

// Alert checking - every minute
await queueManager.addJob('alert-processing', 'check-alerts', {}, {
  repeat: { pattern: '* * * * *' }
});

// Maintenance - daily at specific times
await queueManager.addJob('maintenance', 'cleanup-old-price-data', data, {
  repeat: { pattern: '0 2 * * *' } // 2 AM daily
});
```

### Manual Scheduling

You can schedule one-time jobs programmatically:

```typescript
// Schedule immediate price update
await jobScheduler.scheduleCoinPriceUpdate(coinId);

// Schedule delayed social scraping
await jobScheduler.scheduleCoinSocialScraping(coinId, 5000); // 5 second delay

// Schedule risk assessment
await jobScheduler.scheduleCoinRiskAssessment(coinId);
```

## Job Monitoring

### Metrics Collection

The job monitor automatically tracks:

- Job completion rates
- Processing times
- Failure rates
- Queue sizes
- Last processed timestamps

### Health Monitoring

Health status is calculated based on:

- Success rates (< 50% = critical, < 80% = warning)
- Recent failures
- Stalled jobs
- Queue backlogs

### Failure Tracking

All job failures are logged with:

- Error messages and stack traces
- Job data and configuration
- Retry attempts made
- Timestamp and queue information

## HTTP API

### Get Job Statistics

```http
GET /api/v1/jobs/stats
```

Returns metrics for all job queues including completion rates, active jobs, and processing statistics.

### Get Health Status

```http
GET /api/v1/jobs/health
```

Returns overall system health and individual queue health status.

### Get Recent Failures

```http
GET /api/v1/jobs/failures?queueName=price-updates&limit=20
```

Returns recent job failures with error details.

### Trigger One-Time Job

```http
POST /api/v1/jobs/trigger
Content-Type: application/json

{
  "queueName": "price-updates",
  "jobName": "update-coin-price",
  "data": {
    "coinId": 1,
    "coinAddress": "0x123",
    "symbol": "DOGE"
  },
  "delay": 5000
}
```

### Queue Management

```http
POST /api/v1/jobs/queue-action
Content-Type: application/json

{
  "queueName": "price-updates",
  "action": "pause" // or "resume", "clear"
}
```

### Schedule Coin-Specific Jobs

```http
POST /api/v1/jobs/price-update/1
POST /api/v1/jobs/social-scraping/1
POST /api/v1/jobs/risk-assessment/1
```

## Configuration

### Environment Variables

```bash
# Redis connection for job queues
REDIS_URL=redis://localhost:6379

# Enable/disable scheduled jobs
ENABLE_SCHEDULED_JOBS=true

# Job-specific configuration
TWITTER_BEARER_TOKEN=your_token
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
```

### Queue Options

```typescript
// Default job options
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: 100,
  removeOnFail: 50
}
```

## Error Handling

### Retry Logic

- **Exponential backoff**: Delays increase exponentially between retries
- **Maximum attempts**: Configurable per job type (default: 3)
- **Circuit breaker**: Prevents cascading failures

### Failure Recovery

- Failed jobs are logged with full context
- Automatic retry with backoff
- Dead letter queue for permanently failed jobs
- Manual retry capability via API

### Monitoring Alerts

The system can be configured to alert on:

- High failure rates
- Queue backlogs
- Processing delays
- System health degradation

## Performance Optimization

### Concurrency Control

Each queue has optimized concurrency limits:

- Price updates: 5 concurrent workers
- Social scraping: 3 concurrent workers (API rate limits)
- Alert processing: 10 concurrent workers
- Risk assessment: 2 concurrent workers (CPU intensive)
- Maintenance: 1 worker (sequential processing)

### Rate Limiting

BullMQ rate limiting prevents API overload:

- External API calls are throttled
- Respects third-party rate limits
- Prevents system overload

### Memory Management

- Automatic cleanup of completed jobs
- Configurable retention policies
- Memory-efficient job data structures

## Testing

### Unit Tests

```bash
npm test -- src/services/job-scheduler.test.ts
npm test -- src/services/job-processors.test.ts
```

### Integration Tests

```bash
npm test -- src/integration/job-system-integration.test.ts
```

### Demo Scripts

#### Mock Demo (No Redis Required)
```bash
npm run demo:jobs-mock
```
Demonstrates job system concepts using in-memory simulation. Perfect for understanding the system without infrastructure setup.

#### Simple Demo (Requires Redis)
```bash
npm run demo:jobs-simple
```
Tests basic BullMQ functionality with Redis. Requires Redis to be running on `localhost:6379`.

#### Full System Demo (Requires Redis + Database)
```bash
npm run demo:jobs
```
Complete demonstration using the full application stack. Requires both Redis and PostgreSQL to be running.

### Prerequisites

For demos that require Redis:
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Using Homebrew (macOS)
brew install redis
brew services start redis

# Using apt (Ubuntu/Debian)
sudo apt install redis-server
sudo systemctl start redis-server
```

## Troubleshooting

### Common Issues

1. **Jobs not processing**
   - Check Redis connection
   - Verify worker initialization
   - Check queue pause status

2. **High failure rates**
   - Review error logs
   - Check external API availability
   - Verify database connectivity

3. **Memory issues**
   - Adjust job retention settings
   - Monitor queue sizes
   - Check for memory leaks

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

Monitor queue status:

```bash
curl http://localhost:3001/api/v1/jobs/stats
curl http://localhost:3001/api/v1/jobs/health
```

### Recovery Procedures

1. **Clear stuck queues**:
   ```http
   POST /api/v1/jobs/queue-action
   {"queueName": "price-updates", "action": "clear"}
   ```

2. **Restart job processing**:
   ```bash
   # Restart the application
   npm run dev
   ```

3. **Manual job triggering**:
   ```http
   POST /api/v1/jobs/trigger
   {"queueName": "maintenance", "jobName": "warm-cache"}
   ```

## Best Practices

1. **Job Design**
   - Keep jobs idempotent
   - Use appropriate timeouts
   - Handle partial failures gracefully

2. **Monitoring**
   - Set up health check alerts
   - Monitor queue depths
   - Track success rates

3. **Scaling**
   - Adjust concurrency based on load
   - Use horizontal scaling for workers
   - Monitor resource usage

4. **Maintenance**
   - Regular cleanup of old jobs
   - Monitor disk usage
   - Update retry policies based on failure patterns

## Future Enhancements

- [ ] Job priority queues
- [ ] Dynamic scaling based on load
- [ ] Advanced job dependencies
- [ ] Job result caching
- [ ] Enhanced monitoring dashboard
- [ ] Automated failure recovery
- [ ] Job scheduling UI
- [ ] Performance analytics