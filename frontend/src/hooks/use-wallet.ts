'use client';

import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useCallback, useEffect, useState } from 'react';
import { chainConfig, supportedChains } from '@/lib/wagmi-config';

export interface WalletState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;

  // Account info
  address?: `0x${string}` | undefined;
  ensName?: string;

  // Chain info
  chainId?: number;
  chainName?: string | undefined;
  isWrongNetwork: boolean;

  // Connection methods
  connect: () => void;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;

  // Supported chains
  supportedChains: typeof supportedChains;
}

export function useWallet(): WalletState {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  // Check if current chain is supported
  useEffect(() => {
    if (isConnected && chainId) {
      const isSupported = supportedChains.some(chain => chain.id === chainId);
      setIsWrongNetwork(!isSupported);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chainId]);

  // Get chain name from config
  const chainName = chainId ? chainConfig[chainId]?.name : undefined;

  // Connect wallet function
  const connect = useCallback(() => {
    if (openConnectModal) {
      openConnectModal();
    }
  }, [openConnectModal]);

  // Switch network function
  const switchNetwork = useCallback(
    async (targetChainId: number) => {
      try {
        if (switchChain) {
          await switchChain({ chainId: targetChainId });
        }
      } catch (error) {
        console.error('Failed to switch network:', error);
        throw error;
      }
    },
    [switchChain]
  );

  return {
    // Connection state
    isConnected,
    isConnecting: isConnecting || isSwitchingChain,
    isReconnecting,

    // Account info
    address,

    // Chain info
    chainId,
    chainName,
    isWrongNetwork,

    // Methods
    connect,
    disconnect,
    switchNetwork,

    // Supported chains
    supportedChains,
  };
}
