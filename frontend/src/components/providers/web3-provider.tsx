'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';

import { wagmiConfig } from '@/lib/wagmi-config';

import '@rainbow-me/rainbowkit/styles.css';

interface Web3ProviderProps {
  children: ReactNode;
}

function RainbowKitThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <RainbowKitProvider
      theme={theme === 'dark' ? darkTheme() : lightTheme()}
      showRecentTransactions={true}
      coolMode={true}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
      },
    },
  });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitThemeProvider>{children}</RainbowKitThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
