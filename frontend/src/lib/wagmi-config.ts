import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum, base, sepolia, polygonMumbai } from 'wagmi/chains';

// Get environment variables
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set, using demo project ID');
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Meme Coin Analyzer',
  projectId,
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    ...(process.env.NODE_ENV === 'development' ? [sepolia, polygonMumbai] : []),
  ],
  ssr: true,
});

export const supportedChains = wagmiConfig.chains;

export const chainConfig: Record<
  number,
  {
    name: string;
    nativeCurrency: string;
    blockExplorer: string;
    rpcUrl: string;
  }
> = {
  [mainnet.id]: {
    name: 'Ethereum',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://etherscan.io',
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`,
  },
  [polygon.id]: {
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
    rpcUrl: `https://polygon-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`,
  },
  [optimism.id]: {
    name: 'Optimism',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://optimistic.etherscan.io',
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`,
  },
  [arbitrum.id]: {
    name: 'Arbitrum',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://arbiscan.io',
    rpcUrl: `https://arbitrum-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`,
  },
  [base.id]: {
    name: 'Base',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://basescan.org',
    rpcUrl: 'https://mainnet.base.org',
  },
};
