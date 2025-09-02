/**
 * Meme Coin Analyzer API - JavaScript Examples
 * 
 * This file contains practical examples of how to use the API
 * with JavaScript/Node.js applications.
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/ws';

/**
 * API Client Class
 */
class MemeCoinAnalyzerAPI {
  constructor(baseURL = API_BASE_URL, token = null) {
    this.baseURL = baseURL;
    this.token = token;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Authentication Methods
   */
  async register(userData) {
    const response = await this.client.post('/api/v1/auth/register', userData);
    if (response.data.success) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async login(email, password) {
    const response = await this.client.post('/api/v1/auth/login', {
      email,
      password
    });
    if (response.data.success) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/api/v1/auth/profile');
    return response.data;
  }

  async updatePreferences(preferences) {
    const response = await this.client.put('/api/v1/auth/preferences', preferences);
    return response.data;
  }

  /**
   * Coin Methods
   */
  async getCoins(params = {}) {
    const response = await this.client.get('/api/v1/coins', { params });
    return response.data;
  }

  async getCoinById(id) {
    const response = await this.client.get(`/api/v1/coins/${id}`);
    return response.data;
  }

  async getCoinByAddress(address) {
    const response = await this.client.get(`/api/v1/coins/address/${address}`);
    return response.data;
  }

  async createCoin(coinData) {
    const response = await this.client.post('/api/v1/coins', coinData);
    return response.data;
  }

  async searchCoins(query) {
    const response = await this.client.get('/api/v1/coins/search', {
      params: { q: query }
    });
    return response.data;
  }

  async getPriceHistory(coinId, params = {}) {
    const response = await this.client.get(`/api/v1/coins/${coinId}/price-history`, {
      params
    });
    return response.data;
  }

  /**
   * Risk Assessment Methods
   */
  async getRiskAssessment(coinId) {
    const response = await this.client.get(`/api/v1/risk-assessment/${coinId}`);
    return response.data;
  }

  /**
   * Portfolio Methods
   */
  async getPortfolio() {
    const response = await this.client.get('/api/v1/portfolio');
    return response.data;
  }

  async addToPortfolio(portfolioItem) {
    const response = await this.client.post('/api/v1/portfolio', portfolioItem);
    return response.data;
  }

  async updatePortfolioItem(id, updates) {
    const response = await this.client.put(`/api/v1/portfolio/${id}`, updates);
    return response.data;
  }

  async removeFromPortfolio(id) {
    const response = await this.client.delete(`/api/v1/portfolio/${id}`);
    return response.data;
  }

  /**
   * Alert Methods
   */
  async getAlerts() {
    const response = await this.client.get('/api/v1/alerts');
    return response.data;
  }

  async createAlert(alertData) {
    const response = await this.client.post('/api/v1/alerts', alertData);
    return response.data;
  }

  async updateAlert(id, updates) {
    const response = await this.client.put(`/api/v1/alerts/${id}`, updates);
    return response.data;
  }

  async deleteAlert(id) {
    const response = await this.client.delete(`/api/v1/alerts/${id}`);
    return response.data;
  }

  /**
   * WebSocket Connection
   */
  createWebSocketConnection() {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('WebSocket connected');
      
      // Authenticate if token is available
      if (this.token) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: this.token
        }));
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('WebSocket message:', message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket disconnected');
    });

    return ws;
  }
}

/**
 * Usage Examples
 */

// Example 1: Basic Authentication and Coin Fetching
async function basicExample() {
  console.log('=== Basic Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  try {
    // Login
    const loginResult = await api.login('user@example.com', 'password123');
    console.log('Login successful:', loginResult.success);
    
    // Get coins
    const coins = await api.getCoins({
      page: 1,
      limit: 10,
      sortBy: 'marketCap',
      sortOrder: 'desc'
    });
    
    console.log(`Found ${coins.data.length} coins`);
    coins.data.forEach(coin => {
      console.log(`- ${coin.name} (${coin.symbol}): ${coin.network}`);
    });
    
  } catch (error) {
    console.error('Error in basic example:', error.message);
  }
}

// Example 2: Portfolio Management
async function portfolioExample() {
  console.log('=== Portfolio Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  try {
    // Login first
    await api.login('user@example.com', 'password123');
    
    // Get current portfolio
    const portfolio = await api.getPortfolio();
    console.log('Current portfolio items:', portfolio.data.length);
    
    // Add a new coin to portfolio
    const newItem = await api.addToPortfolio({
      coinId: 1,
      amount: 1000,
      avgPrice: 0.08
    });
    
    console.log('Added to portfolio:', newItem.data.id);
    
    // Update portfolio item
    await api.updatePortfolioItem(newItem.data.id, {
      amount: 1500,
      avgPrice: 0.075
    });
    
    console.log('Portfolio item updated');
    
  } catch (error) {
    console.error('Error in portfolio example:', error.message);
  }
}

// Example 3: Alert Management
async function alertExample() {
  console.log('=== Alert Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  try {
    // Login first
    await api.login('user@example.com', 'password123');
    
    // Create price alert
    const alert = await api.createAlert({
      coinId: 1,
      type: 'price_above',
      condition: {
        targetPrice: 0.10
      },
      notificationMethods: ['email', 'push']
    });
    
    console.log('Alert created:', alert.data.id);
    
    // Create volume spike alert
    const volumeAlert = await api.createAlert({
      coinId: 1,
      type: 'volume_spike',
      condition: {
        volumeThreshold: 1000000
      },
      notificationMethods: ['email']
    });
    
    console.log('Volume alert created:', volumeAlert.data.id);
    
    // Get all alerts
    const alerts = await api.getAlerts();
    console.log(`Total alerts: ${alerts.data.length}`);
    
  } catch (error) {
    console.error('Error in alert example:', error.message);
  }
}

// Example 4: Real-time Data with WebSocket
async function websocketExample() {
  console.log('=== WebSocket Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  try {
    // Login first
    await api.login('user@example.com', 'password123');
    
    // Create WebSocket connection
    const ws = api.createWebSocketConnection();
    
    ws.on('open', () => {
      // Subscribe to price updates for a specific coin
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'price_updates',
        coinId: '1'
      }));
      
      // Subscribe to whale movements
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'whale_movements',
        coinId: '1'
      }));
      
      // Subscribe to portfolio updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'portfolio_updates'
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'price_update':
          console.log(`Price update for coin ${message.data.coinId}: $${message.data.price}`);
          break;
        case 'whale_movement':
          console.log(`Whale movement detected: ${message.data.amount} tokens`);
          break;
        case 'portfolio_update':
          console.log(`Portfolio value updated: $${message.data.totalValue}`);
          break;
        case 'alert_triggered':
          console.log(`Alert triggered: ${message.data.message}`);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    });
    
    // Keep connection alive for demo
    setTimeout(() => {
      ws.close();
      console.log('WebSocket connection closed');
    }, 30000);
    
  } catch (error) {
    console.error('Error in WebSocket example:', error.message);
  }
}

// Example 5: Advanced Coin Analysis
async function advancedAnalysisExample() {
  console.log('=== Advanced Analysis Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  try {
    // Login first
    await api.login('user@example.com', 'password123');
    
    // Search for a specific coin
    const searchResults = await api.searchCoins('dogecoin');
    if (searchResults.data.length === 0) {
      console.log('No coins found');
      return;
    }
    
    const coin = searchResults.data[0];
    console.log(`Analyzing: ${coin.name} (${coin.symbol})`);
    
    // Get detailed coin information
    const coinDetails = await api.getCoinById(coin.id);
    console.log('Contract verified:', coinDetails.data.contractVerified);
    
    // Get risk assessment
    const riskAssessment = await api.getRiskAssessment(coin.id);
    console.log('Risk score:', riskAssessment.data.overallScore);
    console.log('Risk factors:');
    Object.entries(riskAssessment.data.factors).forEach(([factor, data]) => {
      console.log(`  - ${factor}: ${data.score}/100`);
    });
    
    // Get price history
    const priceHistory = await api.getPriceHistory(coin.id, {
      timeframe: '7d',
      interval: '1h'
    });
    
    console.log(`Price history: ${priceHistory.data.length} data points`);
    
    // Calculate simple statistics
    const prices = priceHistory.data.map(p => p.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    console.log(`Price stats - Avg: $${avgPrice.toFixed(6)}, Max: $${maxPrice.toFixed(6)}, Min: $${minPrice.toFixed(6)}`);
    
  } catch (error) {
    console.error('Error in advanced analysis example:', error.message);
  }
}

// Example 6: Error Handling and Retry Logic
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');
  
  const api = new MemeCoinAnalyzerAPI();
  
  // Retry function with exponential backoff
  async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  try {
    // Example of handling authentication errors
    try {
      await api.login('invalid@email.com', 'wrongpassword');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('Authentication failed - invalid credentials');
      } else {
        console.log('Login error:', error.message);
      }
    }
    
    // Example of handling validation errors
    try {
      await api.createCoin({
        // Missing required fields
        symbol: 'TEST'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('Validation error:', error.response.data.error.details);
      }
    }
    
    // Example of retry logic for network errors
    const coinsWithRetry = await retryWithBackoff(async () => {
      return await api.getCoins({ limit: 5 });
    });
    
    console.log('Successfully retrieved coins with retry logic');
    
  } catch (error) {
    console.error('Final error in error handling example:', error.message);
  }
}

// Run examples
async function runExamples() {
  console.log('Starting Meme Coin Analyzer API Examples\n');
  
  // Uncomment the examples you want to run
  // await basicExample();
  // await portfolioExample();
  // await alertExample();
  // await websocketExample();
  // await advancedAnalysisExample();
  // await errorHandlingExample();
  
  console.log('\nExamples completed');
}

// Export for use in other modules
module.exports = {
  MemeCoinAnalyzerAPI,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}