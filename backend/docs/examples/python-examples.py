"""
Meme Coin Analyzer API - Python Examples

This file contains practical examples of how to use the API
with Python applications using requests and websockets.
"""

import requests
import websocket
import json
import time
import threading
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class APIConfig:
    """Configuration for API client"""
    base_url: str = "http://localhost:3001"
    ws_url: str = "ws://localhost:3001/ws"
    timeout: int = 10


class MemeCoinAnalyzerAPI:
    """Python client for Meme Coin Analyzer API"""
    
    def __init__(self, config: APIConfig = None, token: str = None):
        self.config = config or APIConfig()
        self.token = token
        self.session = requests.Session()
        self.session.timeout = self.config.timeout
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'MemeCoinAnalyzer-Python-Client/1.0'
        })
        
        if token:
            self.set_token(token)
    
    def set_token(self, token: str):
        """Set authentication token"""
        self.token = token
        self.session.headers['Authorization'] = f'Bearer {token}'
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.config.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error {e.response.status_code}: {e.response.text}")
            raise
        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            raise
    
    # Authentication Methods
    def register(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new user"""
        result = self._make_request('POST', '/api/v1/auth/register', json=user_data)
        if result.get('success') and 'data' in result:
            self.set_token(result['data']['token'])
        return result
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login user and get JWT token"""
        result = self._make_request('POST', '/api/v1/auth/login', json={
            'email': email,
            'password': password
        })
        if result.get('success') and 'data' in result:
            self.set_token(result['data']['token'])
        return result
    
    def get_profile(self) -> Dict[str, Any]:
        """Get current user profile"""
        return self._make_request('GET', '/api/v1/auth/profile')
    
    def update_preferences(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Update user preferences"""
        return self._make_request('PUT', '/api/v1/auth/preferences', json=preferences)
    
    # Coin Methods
    def get_coins(self, **params) -> Dict[str, Any]:
        """Get paginated list of coins"""
        return self._make_request('GET', '/api/v1/coins', params=params)
    
    def get_coin_by_id(self, coin_id: int) -> Dict[str, Any]:
        """Get coin by ID"""
        return self._make_request('GET', f'/api/v1/coins/{coin_id}')
    
    def get_coin_by_address(self, address: str) -> Dict[str, Any]:
        """Get coin by contract address"""
        return self._make_request('GET', f'/api/v1/coins/address/{address}')
    
    def create_coin(self, coin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new coin"""
        return self._make_request('POST', '/api/v1/coins', json=coin_data)
    
    def search_coins(self, query: str) -> Dict[str, Any]:
        """Search coins by name or symbol"""
        return self._make_request('GET', '/api/v1/coins/search', params={'q': query})
    
    def get_price_history(self, coin_id: int, **params) -> Dict[str, Any]:
        """Get price history for a coin"""
        return self._make_request('GET', f'/api/v1/coins/{coin_id}/price-history', params=params)
    
    # Risk Assessment Methods
    def get_risk_assessment(self, coin_id: int) -> Dict[str, Any]:
        """Get risk assessment for a coin"""
        return self._make_request('GET', f'/api/v1/risk-assessment/{coin_id}')
    
    # Portfolio Methods
    def get_portfolio(self) -> Dict[str, Any]:
        """Get user portfolio"""
        return self._make_request('GET', '/api/v1/portfolio')
    
    def add_to_portfolio(self, portfolio_item: Dict[str, Any]) -> Dict[str, Any]:
        """Add item to portfolio"""
        return self._make_request('POST', '/api/v1/portfolio', json=portfolio_item)
    
    def update_portfolio_item(self, item_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update portfolio item"""
        return self._make_request('PUT', f'/api/v1/portfolio/{item_id}', json=updates)
    
    def remove_from_portfolio(self, item_id: int) -> Dict[str, Any]:
        """Remove item from portfolio"""
        return self._make_request('DELETE', f'/api/v1/portfolio/{item_id}')
    
    # Alert Methods
    def get_alerts(self) -> Dict[str, Any]:
        """Get user alerts"""
        return self._make_request('GET', '/api/v1/alerts')
    
    def create_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new alert"""
        return self._make_request('POST', '/api/v1/alerts', json=alert_data)
    
    def update_alert(self, alert_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an alert"""
        return self._make_request('PUT', f'/api/v1/alerts/{alert_id}', json=updates)
    
    def delete_alert(self, alert_id: int) -> Dict[str, Any]:
        """Delete an alert"""
        return self._make_request('DELETE', f'/api/v1/alerts/{alert_id}')


class WebSocketClient:
    """WebSocket client for real-time data"""
    
    def __init__(self, ws_url: str, token: str = None):
        self.ws_url = ws_url
        self.token = token
        self.ws = None
        self.is_connected = False
        self.message_handlers = {}
    
    def on_message(self, message_type: str, handler):
        """Register message handler for specific message type"""
        self.message_handlers[message_type] = handler
    
    def on_open(self, ws):
        """Handle WebSocket connection open"""
        print("WebSocket connected")
        self.is_connected = True
        
        # Authenticate if token is available
        if self.token:
            self.send_message({
                'type': 'auth',
                'token': self.token
            })
    
    def on_message_received(self, ws, message):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            print(f"Received message: {message_type}")
            
            # Call registered handler if available
            if message_type in self.message_handlers:
                self.message_handlers[message_type](data)
            else:
                print(f"No handler for message type: {message_type}")
                
        except json.JSONDecodeError as e:
            print(f"Failed to parse WebSocket message: {e}")
    
    def on_error(self, ws, error):
        """Handle WebSocket error"""
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket connection close"""
        print("WebSocket disconnected")
        self.is_connected = False
    
    def connect(self):
        """Connect to WebSocket"""
        websocket.enableTrace(True)
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            on_open=self.on_open,
            on_message=self.on_message_received,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # Run in separate thread
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
        
        # Wait for connection
        time.sleep(1)
        return self.is_connected
    
    def send_message(self, message: Dict[str, Any]):
        """Send message to WebSocket"""
        if self.ws and self.is_connected:
            self.ws.send(json.dumps(message))
        else:
            print("WebSocket not connected")
    
    def subscribe(self, channel: str, coin_id: str = None):
        """Subscribe to a channel"""
        message = {
            'type': 'subscribe',
            'channel': channel
        }
        if coin_id:
            message['coinId'] = coin_id
        
        self.send_message(message)
    
    def disconnect(self):
        """Disconnect from WebSocket"""
        if self.ws:
            self.ws.close()


# Usage Examples

def basic_example():
    """Basic authentication and coin fetching example"""
    print("=== Basic Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login
        login_result = api.login('user@example.com', 'password123')
        print(f"Login successful: {login_result['success']}")
        
        # Get coins
        coins = api.get_coins(page=1, limit=10, sortBy='marketCap', sortOrder='desc')
        
        print(f"Found {len(coins['data'])} coins")
        for coin in coins['data']:
            print(f"- {coin['name']} ({coin['symbol']}): {coin['network']}")
            
    except Exception as e:
        print(f"Error in basic example: {e}")


def portfolio_example():
    """Portfolio management example"""
    print("=== Portfolio Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login first
        api.login('user@example.com', 'password123')
        
        # Get current portfolio
        portfolio = api.get_portfolio()
        print(f"Current portfolio items: {len(portfolio['data'])}")
        
        # Add a new coin to portfolio
        new_item = api.add_to_portfolio({
            'coinId': 1,
            'amount': 1000,
            'avgPrice': 0.08
        })
        
        print(f"Added to portfolio: {new_item['data']['id']}")
        
        # Update portfolio item
        api.update_portfolio_item(new_item['data']['id'], {
            'amount': 1500,
            'avgPrice': 0.075
        })
        
        print("Portfolio item updated")
        
    except Exception as e:
        print(f"Error in portfolio example: {e}")


def alert_example():
    """Alert management example"""
    print("=== Alert Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login first
        api.login('user@example.com', 'password123')
        
        # Create price alert
        alert = api.create_alert({
            'coinId': 1,
            'type': 'price_above',
            'condition': {
                'targetPrice': 0.10
            },
            'notificationMethods': ['email', 'push']
        })
        
        print(f"Alert created: {alert['data']['id']}")
        
        # Create volume spike alert
        volume_alert = api.create_alert({
            'coinId': 1,
            'type': 'volume_spike',
            'condition': {
                'volumeThreshold': 1000000
            },
            'notificationMethods': ['email']
        })
        
        print(f"Volume alert created: {volume_alert['data']['id']}")
        
        # Get all alerts
        alerts = api.get_alerts()
        print(f"Total alerts: {len(alerts['data'])}")
        
    except Exception as e:
        print(f"Error in alert example: {e}")


def websocket_example():
    """Real-time data with WebSocket example"""
    print("=== WebSocket Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login first
        api.login('user@example.com', 'password123')
        
        # Create WebSocket client
        ws_client = WebSocketClient(api.config.ws_url, api.token)
        
        # Register message handlers
        def handle_price_update(data):
            coin_id = data['data']['coinId']
            price = data['data']['price']
            print(f"Price update for coin {coin_id}: ${price}")
        
        def handle_whale_movement(data):
            amount = data['data']['amount']
            print(f"Whale movement detected: {amount} tokens")
        
        def handle_portfolio_update(data):
            total_value = data['data']['totalValue']
            print(f"Portfolio value updated: ${total_value}")
        
        def handle_alert_triggered(data):
            message = data['data']['message']
            print(f"Alert triggered: {message}")
        
        ws_client.on_message('price_update', handle_price_update)
        ws_client.on_message('whale_movement', handle_whale_movement)
        ws_client.on_message('portfolio_update', handle_portfolio_update)
        ws_client.on_message('alert_triggered', handle_alert_triggered)
        
        # Connect to WebSocket
        if ws_client.connect():
            print("WebSocket connected successfully")
            
            # Subscribe to channels
            ws_client.subscribe('price_updates', '1')
            ws_client.subscribe('whale_movements', '1')
            ws_client.subscribe('portfolio_updates')
            
            # Keep connection alive for demo
            time.sleep(30)
            
            ws_client.disconnect()
            print("WebSocket connection closed")
        else:
            print("Failed to connect to WebSocket")
            
    except Exception as e:
        print(f"Error in WebSocket example: {e}")


def advanced_analysis_example():
    """Advanced coin analysis example"""
    print("=== Advanced Analysis Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login first
        api.login('user@example.com', 'password123')
        
        # Search for a specific coin
        search_results = api.search_coins('dogecoin')
        if not search_results['data']:
            print("No coins found")
            return
        
        coin = search_results['data'][0]
        print(f"Analyzing: {coin['name']} ({coin['symbol']})")
        
        # Get detailed coin information
        coin_details = api.get_coin_by_id(coin['id'])
        print(f"Contract verified: {coin_details['data']['contractVerified']}")
        
        # Get risk assessment
        risk_assessment = api.get_risk_assessment(coin['id'])
        print(f"Risk score: {risk_assessment['data']['overallScore']}")
        print("Risk factors:")
        for factor, data in risk_assessment['data']['factors'].items():
            print(f"  - {factor}: {data['score']}/100")
        
        # Get price history
        price_history = api.get_price_history(coin['id'], timeframe='7d', interval='1h')
        print(f"Price history: {len(price_history['data'])} data points")
        
        # Calculate simple statistics
        prices = [p['price'] for p in price_history['data']]
        avg_price = sum(prices) / len(prices)
        max_price = max(prices)
        min_price = min(prices)
        
        print(f"Price stats - Avg: ${avg_price:.6f}, Max: ${max_price:.6f}, Min: ${min_price:.6f}")
        
    except Exception as e:
        print(f"Error in advanced analysis example: {e}")


def error_handling_example():
    """Error handling and retry logic example"""
    print("=== Error Handling Example ===")
    
    api = MemeCoinAnalyzerAPI()
    
    def retry_with_backoff(func, max_retries=3, base_delay=1):
        """Retry function with exponential backoff"""
        for attempt in range(1, max_retries + 1):
            try:
                return func()
            except Exception as e:
                if attempt == max_retries:
                    raise e
                
                delay = base_delay * (2 ** (attempt - 1))
                print(f"Attempt {attempt} failed, retrying in {delay}s...")
                time.sleep(delay)
    
    try:
        # Example of handling authentication errors
        try:
            api.login('invalid@email.com', 'wrongpassword')
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print("Authentication failed - invalid credentials")
            else:
                print(f"Login error: {e}")
        
        # Example of handling validation errors
        try:
            api.create_coin({
                # Missing required fields
                'symbol': 'TEST'
            })
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 400:
                error_data = e.response.json()
                print(f"Validation error: {error_data['error']['details']}")
        
        # Example of retry logic for network errors
        def get_coins_with_retry():
            return api.get_coins(limit=5)
        
        coins_with_retry = retry_with_backoff(get_coins_with_retry)
        print("Successfully retrieved coins with retry logic")
        
    except Exception as e:
        print(f"Final error in error handling example: {e}")


def data_analysis_example():
    """Data analysis and visualization example"""
    print("=== Data Analysis Example ===")
    
    try:
        import pandas as pd
        import matplotlib.pyplot as plt
    except ImportError:
        print("This example requires pandas and matplotlib: pip install pandas matplotlib")
        return
    
    api = MemeCoinAnalyzerAPI()
    
    try:
        # Login first
        api.login('user@example.com', 'password123')
        
        # Get top coins by market cap
        coins = api.get_coins(limit=20, sortBy='marketCap', sortOrder='desc')
        
        # Convert to DataFrame
        df = pd.DataFrame(coins['data'])
        print(f"Loaded {len(df)} coins into DataFrame")
        
        # Get price history for top coin
        if not df.empty:
            top_coin = df.iloc[0]
            price_history = api.get_price_history(
                top_coin['id'], 
                timeframe='30d', 
                interval='1d'
            )
            
            # Convert price history to DataFrame
            price_df = pd.DataFrame(price_history['data'])
            price_df['timestamp'] = pd.to_datetime(price_df['timestamp'])
            
            # Simple analysis
            print(f"\nPrice analysis for {top_coin['name']}:")
            print(f"Average price: ${price_df['price'].mean():.6f}")
            print(f"Price volatility (std): ${price_df['price'].std():.6f}")
            print(f"Max price: ${price_df['price'].max():.6f}")
            print(f"Min price: ${price_df['price'].min():.6f}")
            
            # Plot price chart (optional)
            # plt.figure(figsize=(12, 6))
            # plt.plot(price_df['timestamp'], price_df['price'])
            # plt.title(f'{top_coin["name"]} Price History')
            # plt.xlabel('Date')
            # plt.ylabel('Price ($)')
            # plt.xticks(rotation=45)
            # plt.tight_layout()
            # plt.show()
        
    except Exception as e:
        print(f"Error in data analysis example: {e}")


def run_examples():
    """Run all examples"""
    print("Starting Meme Coin Analyzer API Examples\n")
    
    # Uncomment the examples you want to run
    # basic_example()
    # portfolio_example()
    # alert_example()
    # websocket_example()
    # advanced_analysis_example()
    # error_handling_example()
    # data_analysis_example()
    
    print("\nExamples completed")


if __name__ == "__main__":
    run_examples()