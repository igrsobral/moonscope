import { render, screen } from '@testing-library/react';
import { CoinCard } from '../coin-card';
import { Coin } from '@/types';
import React from 'react';
import { describe, expect, it } from 'vitest';

const mockCoin: Coin = {
  id: 1,
  address: '0x123',
  symbol: 'DOGE',
  name: 'Dogecoin',
  network: 'ethereum',
  contractVerified: true,
  logoUrl: 'https://example.com/logo.png',
  socialLinks: {},
  price: {
    id: 1,
    coinId: 1,
    price: 0.08,
    marketCap: 11000000000,
    volume24h: 500000000,
    liquidity: 1000000,
    priceChange24h: 5.2,
    volumeChange24h: 10.5,
    timestamp: '2023-01-01T00:00:00Z',
  },
  risk: {
    id: 1,
    coinId: 1,
    overallScore: 65,
    factors: {
      liquidity: { score: 70, value: 1000000, threshold: 500000 },
      holderDistribution: { score: 60, topHoldersPercentage: 15, holderCount: 5000 },
      contractSecurity: {
        score: 80,
        isVerified: true,
        hasProxyContract: false,
        hasOwnershipRenounced: true,
      },
      socialMetrics: { score: 50, sentimentScore: 0.7, communitySize: 10000 },
    },
    timestamp: '2023-01-01T00:00:00Z',
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

describe('CoinCard', () => {
  it('renders coin information correctly', () => {
    render(<CoinCard coin={mockCoin} />);

    expect(screen.getByText('DOGE')).toBeInTheDocument();
    expect(screen.getByText('Dogecoin')).toBeInTheDocument();
    expect(screen.getByText('$0.0800')).toBeInTheDocument();
    expect(screen.getByText('+5.20%')).toBeInTheDocument();
    expect(screen.getByText('$11.00B')).toBeInTheDocument();
    expect(screen.getByText('$500.00M')).toBeInTheDocument();
    expect(screen.getByText('Medium (65/100)')).toBeInTheDocument();
  });

  it('shows verified contract indicator', () => {
    render(<CoinCard coin={mockCoin} />);

    // Should show shield icon for verified contract
    const shieldIcon =
      screen.getByTestId('shield-icon') || document.querySelector('[data-testid="shield-icon"]');
    expect(shieldIcon || screen.getByText('ETHEREUM')).toBeInTheDocument();
  });

  it('handles missing price data gracefully', () => {
    const coinWithoutPrice = { ...mockCoin, price: undefined };
    render(<CoinCard coin={coinWithoutPrice} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
