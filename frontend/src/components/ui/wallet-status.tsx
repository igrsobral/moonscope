'use client';

import { useWallet } from '@/hooks/use-wallet';
import { WalletConnectButton } from './wallet-connect-button';
import { NetworkSwitcher } from './network-switcher';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from './alert';

interface WalletStatusProps {
  className?: string;
  showNetworkSwitcher?: boolean;
}

export function WalletStatus({ className, showNetworkSwitcher = true }: WalletStatusProps) {
  const { isConnected, isConnecting, isWrongNetwork, chainName } = useWallet();

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <WalletConnectButton />
        {isConnected && showNetworkSwitcher && <NetworkSwitcher />}
      </div>

      {/* Connection Status Indicators */}
      {isConnecting && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-3 w-3 animate-pulse" />
          Connecting to wallet...
        </div>
      )}

      {isConnected && !isWrongNetwork && (
        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
          <Wifi className="h-3 w-3" />
          Connected to {chainName}
        </div>
      )}

      {isWrongNetwork && (
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You&apos;re connected to an unsupported network. Please switch to a supported network.
          </AlertDescription>
        </Alert>
      )}

      {!isConnected && !isConnecting && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-3 w-3" />
          Wallet not connected
        </div>
      )}
    </div>
  );
}
