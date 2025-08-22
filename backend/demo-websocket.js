import Fastify from 'fastify';
import websocket from '@fastify/websocket';

async function createWebSocketDemo() {
  const fastify = Fastify({ logger: true });

  // Register websocket plugin
  await fastify.register(websocket);

  // Create a simple websocket manager
  const connections = new Map();
  
  const websocketManager = {
    connections,
    addConnection: (conn) => {
      connections.set(conn.id, conn);
      console.log(`✅ Connection added: ${conn.id} (Total: ${connections.size})`);
    },
    removeConnection: (id) => {
      connections.delete(id);
      console.log(`❌ Connection removed: ${id} (Total: ${connections.size})`);
    },
    broadcast: (event) => {
      const message = JSON.stringify(event);
      let sent = 0;
      for (const conn of connections.values()) {
        if (conn.socket.readyState === conn.socket.OPEN) {
          conn.socket.send(message);
          sent++;
        }
      }
      console.log(`📡 Broadcasted to ${sent} connections:`, event.type);
    },
    broadcastToCoin: (coinId, event) => {
      const message = JSON.stringify(event);
      let sent = 0;
      for (const conn of connections.values()) {
        if (conn.subscriptions.has(`coin:${coinId}`) && conn.socket.readyState === conn.socket.OPEN) {
          conn.socket.send(message);
          sent++;
        }
      }
      console.log(`🪙 Broadcasted ${coinId} update to ${sent} subscribers:`, event.type);
    },
  };

  fastify.decorate('websocketManager', websocketManager);

  // WebSocket route
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const wsConnection = {
      id: connectionId,
      socket: connection,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: false,
    };

    websocketManager.addConnection(wsConnection);

    // Send welcome message
    connection.send(JSON.stringify({
      type: 'welcome',
      data: {
        message: 'Connected to Meme Coin Analyzer WebSocket Demo',
        connectionId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }));

    connection.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        console.log(`📨 Received from ${connectionId}:`, message);
        
        switch (message.type) {
          case 'ping':
            wsConnection.lastPing = new Date();
            connection.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            }));
            break;
            
          case 'subscribe':
            if (message.data?.coinId) {
              wsConnection.subscriptions.add(`coin:${message.data.coinId}`);
              connection.send(JSON.stringify({
                type: 'subscribed',
                data: {
                  message: 'Subscribed to coin updates',
                  coinId: message.data.coinId,
                  subscription: `coin:${message.data.coinId}`,
                },
                timestamp: new Date().toISOString(),
              }));
              console.log(`🔔 ${connectionId} subscribed to coin:${message.data.coinId}`);
            }
            break;
            
          case 'unsubscribe':
            if (message.data?.coinId) {
              wsConnection.subscriptions.delete(`coin:${message.data.coinId}`);
              connection.send(JSON.stringify({
                type: 'unsubscribed',
                data: {
                  message: 'Unsubscribed from coin updates',
                  coinId: message.data.coinId,
                  subscription: `coin:${message.data.coinId}`,
                },
                timestamp: new Date().toISOString(),
              }));
              console.log(`🔕 ${connectionId} unsubscribed from coin:${message.data.coinId}`);
            }
            break;
        }
      } catch (error) {
        console.error(`❌ Error parsing message from ${connectionId}:`, error);
        connection.send(JSON.stringify({
          type: 'error',
          data: { 
            error: 'Invalid message format',
            message: 'Message must be valid JSON' 
          },
          timestamp: new Date().toISOString(),
        }));
      }
    });

    connection.on('close', () => {
      websocketManager.removeConnection(connectionId);
    });

    connection.on('error', (error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error);
      websocketManager.removeConnection(connectionId);
    });
  });

  // Demo price update endpoint
  fastify.post('/demo/price-update', async (request, reply) => {
    const { coinId, price, change } = request.body;
    
    const priceUpdate = {
      type: 'price_update',
      data: {
        coinId,
        price,
        change,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      coinId,
    };

    websocketManager.broadcastToCoin(coinId, priceUpdate);

    return { 
      success: true, 
      message: `Price update broadcasted for ${coinId}`,
      data: priceUpdate 
    };
  });

  // Demo global broadcast endpoint
  fastify.post('/demo/broadcast', async (request, reply) => {
    const { message, data } = request.body;
    
    const broadcastEvent = {
      type: 'announcement',
      data: {
        message,
        ...data,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    websocketManager.broadcast(broadcastEvent);

    return { 
      success: true, 
      message: 'Broadcast sent to all connections',
      data: broadcastEvent 
    };
  });

  // Status endpoint
  fastify.get('/demo/status', async (request, reply) => {
    const connectionStats = {};
    for (const conn of connections.values()) {
      connectionStats[conn.id] = {
        subscriptions: Array.from(conn.subscriptions),
        lastPing: conn.lastPing,
        isAuthenticated: conn.isAuthenticated,
      };
    }

    return {
      totalConnections: connections.size,
      connections: connectionStats,
    };
  });

  try {
    await fastify.listen({ port: 3005, host: '127.0.0.1' });
    
    console.log('\n🚀 WebSocket Demo Server Started!');
    console.log('📍 Server: http://127.0.0.1:3005');
    console.log('🔌 WebSocket: ws://127.0.0.1:3005/ws');
    console.log('\n📋 Available endpoints:');
    console.log('  GET  /demo/status - View connection status');
    console.log('  POST /demo/price-update - Broadcast price update');
    console.log('  POST /demo/broadcast - Broadcast to all connections');
    console.log('\n🧪 Test WebSocket with:');
    console.log('  wscat -c ws://127.0.0.1:3005/ws');
    console.log('\n📨 Example messages to send:');
    console.log('  {"type":"ping"}');
    console.log('  {"type":"subscribe","data":{"coinId":"bitcoin"}}');
    console.log('  {"type":"unsubscribe","data":{"coinId":"bitcoin"}}');
    console.log('\n🔥 Test price updates:');
    console.log('  curl -X POST http://127.0.0.1:3005/demo/price-update \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"coinId":"bitcoin","price":50000,"change":5.2}\'');
    console.log('\n📢 Test global broadcast:');
    console.log('  curl -X POST http://127.0.0.1:3005/demo/broadcast \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"message":"Market alert!","data":{"severity":"high"}}\'');
    console.log('\n🛑 Press Ctrl+C to stop\n');

    // Simulate periodic price updates
    setInterval(() => {
      const coins = ['bitcoin', 'ethereum', 'dogecoin'];
      const randomCoin = coins[Math.floor(Math.random() * coins.length)];
      const randomPrice = Math.floor(Math.random() * 100000) + 1000;
      const randomChange = (Math.random() - 0.5) * 20; // -10% to +10%

      const priceUpdate = {
        type: 'price_update',
        data: {
          coinId: randomCoin,
          price: randomPrice,
          change: randomChange,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        coinId: randomCoin,
      };

      websocketManager.broadcastToCoin(randomCoin, priceUpdate);
    }, 10000); // Every 10 seconds

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down WebSocket demo server...');
      await fastify.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start WebSocket demo server:', error);
    process.exit(1);
  }
}

createWebSocketDemo();