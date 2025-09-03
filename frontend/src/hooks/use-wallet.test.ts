import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWallet } from './use-wallet';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useConnect: vi.fn(),
  useDisconnect: vi.fn(),
  useChainId: vi.fn(),
  useSwitchChain: vi.fn(),
}));

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: vi.fn(),
}));

// Mock wagmi config
vi.mock('@/lib/wagmi-config', () => ({
  supportedChains: [
    { id: 1, name: 'Ethereum' },
    { id: 137, name: 'Polygon' },
  ],
  chainConfig: {
    1: { name: 'Ethereum' },
    137: { name: 'Polygon' },
  },
}));

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct initial state when not connected', async () => {
    const { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } = await import(
      'wagmi'
    );
    const { useConnectModal } = await import('@rainbow-me/rainbowkit');

    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
    });

    vi.mocked(useConnect).mockReturnValue({
      connect: vi.fn(),
      connectors: [],
      error: null,
      isError: false,
      isPending: false,
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
    });

    vi.mocked(useDisconnect).mockReturnValue({
      disconnect: vi.fn(),
    });

    vi.mocked(useChainId).mockReturnValue(undefined);

    vi.mocked(useSwitchChain).mockReturnValue({
      switchChain: vi.fn(),
      isPending: false,
    });

    vi.mocked(useConnectModal).mockReturnValue({
      openConnectModal: vi.fn(),
    });

    const { result } = renderHook(() => useWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.address).toBeUndefined();
    expect(result.current.chainId).toBeUndefined();
    expect(result.current.isWrongNetwork).toBe(false);
  });

  it('should return correct state when connected to supported network', async () => {
    const { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } = await import(
      'wagmi'
    );
    const { useConnectModal } = await import('@rainbow-me/rainbowkit');

    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
    });

    vi.mocked(useConnect).mockReturnValue({
      connect: vi.fn(),
      connectors: [],
      error: null,
      isError: false,
      isPending: false,
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
    });

    vi.mocked(useDisconnect).mockReturnValue({
      disconnect: vi.fn(),
    });

    vi.mocked(useChainId).mockReturnValue(1); // Ethereum mainnet

    vi.mocked(useSwitchChain).mockReturnValue({
      switchChain: vi.fn(),
      isPending: false,
    });

    vi.mocked(useConnectModal).mockReturnValue({
      openConnectModal: vi.fn(),
      connectModalOpen: false,
    });

    const { result } = renderHook(() => useWallet());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890');
    expect(result.current.chainId).toBe(1);
    expect(result.current.chainName).toBe('Ethereum');
    expect(result.current.isWrongNetwork).toBe(false);
  });

  it('should detect wrong network when connected to unsupported chain', async () => {
    const { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } = await import(
      'wagmi'
    );
    const { useConnectModal } = await import('@rainbow-me/rainbowkit');

    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
    });

    vi.mocked(useConnect).mockReturnValue({
      connect: vi.fn(),
      connectors: [],
      error: null,
      isError: false,
      isPending: false,
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
    });

    vi.mocked(useDisconnect).mockReturnValue({
      disconnect: vi.fn(),
    });

    vi.mocked(useChainId).mockReturnValue(999); // Unsupported chain

    vi.mocked(useSwitchChain).mockReturnValue({
      switchChain: vi.fn(),
      isPending: false,
    });

    vi.mocked(useConnectModal).mockReturnValue({
      openConnectModal: vi.fn(),
    });

    const { result } = renderHook(() => useWallet());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.chainId).toBe(999);
    expect(result.current.isWrongNetwork).toBe(true);
  });
});
