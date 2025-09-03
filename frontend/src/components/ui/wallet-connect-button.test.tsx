import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletConnectButton } from './wallet-connect-button';
import React from 'react';

// Mock RainbowKit ConnectButton
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: any) => React.ReactNode }) => {
      // Mock different connection states for testing
      const mockProps = {
        account: undefined,
        chain: undefined,
        openAccountModal: vi.fn(),
        openChainModal: vi.fn(),
        openConnectModal: vi.fn(),
        authenticationStatus: 'authenticated',
        mounted: true,
      };

      return <div data-testid="connect-button-custom">{children(mockProps)}</div>;
    },
  },
}));

describe('WalletConnectButton', () => {
  it('should render connect wallet button when not connected', () => {
    render(<WalletConnectButton />);

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByTestId('connect-button-custom')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<WalletConnectButton className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should render with different variants', () => {
    const { rerender } = render(<WalletConnectButton variant="outline" />);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('border');

    rerender(<WalletConnectButton variant="ghost" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent');
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<WalletConnectButton size="sm" />);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');

    rerender(<WalletConnectButton size="lg" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');
  });
});
