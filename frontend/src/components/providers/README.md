# Web3 Integration Documentation

## Overview

The Web3 integration layer provides wallet connection, network switching, and blockchain interaction capabilities for the Meme Coin Analyzer application. It's built using modern Web3 libraries including Wagmi v2, Viem, and RainbowKit.

## Architecture

### Core Components

1. **Web3Provider** - Main provider component that wraps the application
2. **WalletConnectButton** - Customizable wallet connection button
3. **NetworkSwitcher** - Network switching dropdown component
4. **WalletStatus** - Status indicator showing connection state
5. **useWallet** - Custom hook for wallet state management

### Technology Stack

- **Wagmi v2** - React hooks for Ethereum
- **Viem** - TypeScript interface for Ethereum
- **RainbowKit** - Wallet connection UI library
- **TanStack Query** - Server state management

## Setup

### Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_INFURA_API_KEY=your_infura_key_here
```

### Supported Networks

The application supports the following networks:

- **Ethereum Mainnet** (Chain ID: 1)
- **Polygon** (Chain ID: 137)
- **Optimism** (Chain ID: 10)
- **Arbitrum** (Chain ID: 42161)
- **Base** (Chain ID: 8453)
- **Sepolia** (Development only)
- **Polygon Mumbai** (Development only)

## Usage

### Basic Setup

Wrap your application with the Web3Provider:

```tsx
import { Web3Provider } from '@/components/providers/web3-provider';

function App({ children }) {
  return <Web3Provider>{children}</Web3Provider>;
}
```

### Using the Wallet Hook

```tsx
import { useWallet } from '@/hooks/use-wallet';

function MyComponent() {
  const { isConnected, address, chainId, connect, disconnect, switchNetwork } = useWallet();

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {address}</p>
          <p>Network: {chainId}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Wallet Connection Button

```tsx
import { WalletConnectButton } from '@/components/ui/wallet-connect-button';

function Header() {
  return (
    <header>
      <WalletConnectButton variant="outline" size="sm" />
    </header>
  );
}
```

### Network Switcher

```tsx
import { NetworkSwitcher } from '@/components/ui/network-switcher';

function NetworkControls() {
  return (
    <div>
      <NetworkSwitcher />
    </div>
  );
}
```

### Wallet Status

```tsx
import { WalletStatus } from '@/components/ui/wallet-status';

function Dashboard() {
  return (
    <div>
      <WalletStatus showNetworkSwitcher={true} />
    </div>
  );
}
```

## API Reference

### useWallet Hook

Returns an object with the following properties:

#### Connection State

- `isConnected: boolean` - Whether wallet is connected
- `isConnecting: boolean` - Whether connection is in progress
- `isReconnecting: boolean` - Whether reconnection is in progress

#### Account Info

- `address?: string` - Connected wallet address
- `ensName?: string` - ENS name if available

#### Chain Info

- `chainId?: number` - Current chain ID
- `chainName?: string` - Current chain name
- `isWrongNetwork: boolean` - Whether connected to unsupported network

#### Methods

- `connect(): void` - Open wallet connection modal
- `disconnect(): void` - Disconnect wallet
- `switchNetwork(chainId: number): Promise<void>` - Switch to specified network

#### Data

- `supportedChains: Chain[]` - Array of supported chains

### WalletConnectButton Props

```tsx
interface WalletConnectButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}
```

### NetworkSwitcher Props

```tsx
interface NetworkSwitcherProps {
  className?: string;
}
```

### WalletStatus Props

```tsx
interface WalletStatusProps {
  className?: string;
  showNetworkSwitcher?: boolean;
}
```

## Features

### Wallet Connection

- Support for multiple wallet providers (MetaMask, WalletConnect, Coinbase Wallet, etc.)
- Automatic reconnection on page refresh
- Connection state persistence

### Network Management

- Automatic network detection
- Network switching with user confirmation
- Wrong network detection and warnings
- Support for multiple EVM-compatible chains

### User Experience

- Responsive design for mobile and desktop
- Dark/light theme integration
- Loading states and error handling
- Accessible UI components

### Security

- Type-safe blockchain interactions
- Proper error handling and validation
- Secure wallet connection patterns

## Testing

The Web3 integration includes comprehensive tests:

```bash
# Run all Web3 related tests
npm test -- --run use-wallet
npm test -- --run wallet-connect-button

# Run all tests
npm test
```

## Demo

Visit `/web3-demo` to see a comprehensive demo of all Web3 integration features including:

- Wallet connection/disconnection
- Network switching
- Connection status display
- Supported networks overview
- Integration status

## Troubleshooting

### Common Issues

1. **"No projectId found" error**
   - Ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in your environment variables
   - Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)

2. **Network not supported**
   - Check if the network is included in the `supportedChains` array
   - Add new networks to the wagmi configuration

3. **Connection issues**
   - Clear browser cache and local storage
   - Try connecting with a different wallet
   - Check browser console for detailed error messages

### Development Tips

1. Use the demo page (`/web3-demo`) for testing
2. Check browser console for detailed logs
3. Use development networks (Sepolia, Mumbai) for testing
4. Ensure proper environment variable configuration

## Contributing

When adding new Web3 features:

1. Update the wagmi configuration if adding new chains
2. Add proper TypeScript types
3. Include comprehensive tests
4. Update this documentation
5. Test with multiple wallet providers
