import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SentimentGauge } from '../sentiment-gauge';
import { CorrelationHeatmap } from '../correlation-heatmap';
import { LiquidityMetricsCard } from '../liquidity-metrics-card';
import React from 'react';

// Mock data
const mockCorrelationData = [
  { coinA: 'BTC', coinB: 'ETH', correlation: 0.85, significance: 0.95 },
  { coinA: 'BTC', coinB: 'DOGE', correlation: 0.65, significance: 0.80 },
  { coinA: 'ETH', coinB: 'DOGE', correlation: 0.45, significance: 0.70 },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('Analytics Components', () => {
  describe('SentimentGauge', () => {
    it('renders sentiment gauge with positive value', () => {
      render(<SentimentGauge value={0.7} />);
      expect(screen.getByText('0.700')).toBeInTheDocument();
      expect(screen.getByText('Bullish')).toBeInTheDocument();
    });

    it('renders sentiment gauge with negative value', () => {
      render(<SentimentGauge value={-0.5} />);
      expect(screen.getByText('-0.500')).toBeInTheDocument();
      expect(screen.getByText('Bearish')).toBeInTheDocument();
    });

    it('renders sentiment gauge with neutral value', () => {
      render(<SentimentGauge value={0.1} />);
      expect(screen.getByText('0.100')).toBeInTheDocument();
      expect(screen.getByText('Slightly Bullish')).toBeInTheDocument();
    });
  });

  describe('CorrelationHeatmap', () => {
    it('renders correlation heatmap with data', () => {
      render(<CorrelationHeatmap data={mockCorrelationData} />);
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('DOGE')).toBeInTheDocument();
    });

    it('shows no data message when empty', () => {
      render(<CorrelationHeatmap data={[]} />);
      expect(screen.getByText('No correlation data available')).toBeInTheDocument();
    });
  });

  describe('LiquidityMetricsCard', () => {
    it('renders liquidity metrics card with change', () => {
      render(
        <LiquidityMetricsCard
          title="Total Liquidity"
          value="$1.2M"
          change={5.2}
          icon={<div>icon</div>}
        />
      );
      expect(screen.getByText('Total Liquidity')).toBeInTheDocument();
      expect(screen.getByText('$1.2M')).toBeInTheDocument();
      expect(screen.getByText('+5.20% from yesterday')).toBeInTheDocument();
    });

    it('renders liquidity metrics card without change', () => {
      render(
        <LiquidityMetricsCard title="Active Coins" value="150" icon={<div>icon</div>} />
      );
      expect(screen.getByText('Active Coins')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.queryByText('from yesterday')).not.toBeInTheDocument();
    });

    it('renders warning variant correctly', () => {
      const { container } = render(
        <LiquidityMetricsCard
          title="Warning Card"
          value="10"
          icon={<div>icon</div>}
          variant="warning"
        />
      );
      expect(container.querySelector('.border-yellow-200')).toBeInTheDocument();
    });
  });
});