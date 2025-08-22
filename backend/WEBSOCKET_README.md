# WebSocket Implementation

This document describes the WebSocket implementation for real-time data processing in the Meme Coin Analyzer backend.

## Overview

The WebSocket implementation provides real-time communication capabilities for:
- Price updates
- Alert notifications
- Whale movement alerts
- Social sentiment spikes
- Portfolio value updates

## Architecture

### Components

1. **WebSocket Plugin** (`src/plugins/websocket.ts`)
   - Manages WebSocket connections
   - Provides connection lifecycle management
   - Implements broadcasting capabilities

2. **Realtime Service** (`src/services/realtime.ts`)
   - High-level service for broadcasting events
   - Provides typed methods for different event types
   - Integrates with the WebSocket manager

3. **WebSocket Routes** (`src/routes/websocket.ts`)
   - Handles WebSocket connections at `/ws`
   - Processes incoming messages (ping, subscribe, authenticate)
   - Manages subscriptions and authentication

## Features

### Connection Management
- Automatic connection tracking
- Heartbeat/ping-pong mechanism
- Stale connection cleanup
- Connection authentication support

### Message Types

#### Client to Server
```json
{
  "type": "authenticate",
  "data": {
    "token": "jwt-token-here"
  }
}
```

```json
{
  "type": "subscribe",
  "data": {
    "coinId": "bitcoin"
  }
}
```

```json
{
  "type": "unsubscribe",
  "data": {
    "coinId": "bitcoin"
  }
}
```

```json
{
  "type": "ping"
}
```

#### Server to Client
```json
{
  "type": "price_update",
  "data": {
    "coinId": "bitcoin",
    "price": 50000,
    "marketCap": 1000000000,
    "volume24h": 50000000,
    "priceChange24h": 5.2,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "coinId": "bitcoin"
}
```

```json
{
  "type": "alert_triggered",
  "data": {
    "alertId": 1,
    "alertType": "price_above",
    "coinId": 1,
    "condition": {
      "targetPrice": 50000
    },
    "triggeredAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "userId": "1",
  "coinId": "1"
}
```

```json
{
  "type": "whale_movement",
  "data": {
    "coinId": "bitcoin",
    "txHash": "0x123456789abcdef",
    "fromAddress": "0xfrom123",
    "toAddress": "0xto456",
    "amount": 1000,
    "usdValue": 50000000,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "coinId": "bitcoin"
}
```

```json
{
  "type": "social_spike",
  "data": {
    "coinId": "bitcoin",
    "platform": "twitter",
    "mentions24h": 5000,
    "sentimentScore": 0.8,
    "trendingScore": 95,
    "change": 150,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "coinId": "bitcoin"
}
```

### Broadcasting Methods

#### Broadcast to All Connections
```typescript
fastify.realtime.broadcastGlobal({
  type: 'price_update',
  data: { message: 'Market update' },
  timestamp: new Date().toISOString(),
});
```

#### Broadcast to Specific User
```typescript
fastify.realtime.broadcastToUser(userId, {
  type: 'alert_triggered',
  data: alertData,
  timestamp: new Date().toISOString(),
});
```

#### Broadcast to Coin Subscribers
```typescript
fastify.realtime.broadcastToCoin('bitcoin', {
  type: 'price_update',
  data: priceData,
  timestamp: new Date().toISOString(),
});
```

## Usage Examples

### Basic Connection
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message);
});
```

### Authentication
```javascript
ws.send(JSON.stringify({
  type: 'authenticate',
  data: {
    token: 'your-jwt-token'
  }
}));
```

### Subscribe to Coin Updates
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  data: {
    coinId: 'bitcoin'
  }
}));
```

### Heartbeat
```javascript
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

## Testing

### Unit Tests
- WebSocket plugin functionality
- Connection management
- Broadcasting logic

### Integration Tests
- End-to-end WebSocket communication
- Message handling
- Subscription management

Run tests:
```bash
npm test -- --run src/integration/websocket-integration.test.ts
```

### Demo Server
A demo server is available to test WebSocket functionality:

```bash
node demo-websocket.js
```

This starts a server at `ws://127.0.0.1:3005/ws` with:
- Interactive WebSocket endpoint
- Demo price update API
- Connection status monitoring
- Automatic periodic updates

## Configuration

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level
- `JWT_SECRET`: JWT secret for authentication

### Plugin Dependencies
- `@fastify/websocket`: WebSocket support
- `@fastify/jwt`: JWT authentication
- `fastify-plugin`: Plugin wrapper

## Error Handling

### Connection Errors
- Automatic reconnection on client side
- Graceful degradation when WebSocket unavailable
- Error logging and monitoring

### Message Validation
- JSON parsing error handling
- Unknown message type handling
- Invalid subscription handling

### Authentication Errors
- Invalid token handling
- Expired token handling
- Unauthenticated access restrictions

## Performance Considerations

### Connection Limits
- Monitor active connection count
- Implement connection rate limiting if needed
- Clean up stale connections automatically

### Message Broadcasting
- Efficient message serialization
- Selective broadcasting based on subscriptions
- Batch updates when possible

### Memory Management
- Regular cleanup of closed connections
- Subscription cleanup on disconnect
- Memory usage monitoring

## Security

### Authentication
- JWT token validation
- User session verification
- Rate limiting on authentication attempts

### Message Validation
- Input sanitization
- Message size limits
- Type validation

### Connection Security
- Origin validation
- Rate limiting on connections
- DDoS protection considerations

## Monitoring

### Metrics to Track
- Active connection count
- Message throughput
- Error rates
- Authentication success/failure rates
- Subscription patterns

### Logging
- Connection lifecycle events
- Message processing
- Error conditions
- Performance metrics

## Future Enhancements

### Planned Features
- Message persistence for offline users
- Advanced subscription filtering
- Message compression
- Clustering support for horizontal scaling
- Advanced authentication (API keys, OAuth)

### Performance Optimizations
- Connection pooling
- Message batching
- Compression algorithms
- Caching strategies