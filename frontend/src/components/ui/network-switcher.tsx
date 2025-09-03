'use client';

import { useState } from 'react';
import { Check, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWallet } from '@/hooks/use-wallet';
import { cn } from '@/lib/utils';

interface NetworkSwitcherProps {
  className?: string;
}

export function NetworkSwitcher({ className }: NetworkSwitcherProps) {
  const { chainId, chainName, isConnected, isWrongNetwork, switchNetwork, supportedChains } =
    useWallet();

  const [switchingToChainId, setSwitchingToChainId] = useState<number | null>(null);

  const handleNetworkSwitch = async (targetChainId: number) => {
    if (!isConnected || targetChainId === chainId) return;

    setSwitchingToChainId(targetChainId);
    try {
      await switchNetwork(targetChainId);
    } catch (error) {
      console.error('Failed to switch network:', error);
    } finally {
      setSwitchingToChainId(null);
    }
  };

  if (!isConnected) {
    return null;
  }

  const currentChain = supportedChains.find(chain => chain.id === chainId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isWrongNetwork ? 'destructive' : 'outline'}
          size="sm"
          className={cn('gap-2', className)}
        >
          {isWrongNetwork && <AlertTriangle className="h-3 w-3" />}
          {currentChain ? (
            <>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: currentChain.id === 1 ? '#627EEA' : '#8247E5' }}
              />
              {chainName || currentChain.name}
            </>
          ) : (
            'Unknown Network'
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {supportedChains.map(chain => {
          const isCurrentChain = chain.id === chainId;
          const isSwitching = switchingToChainId === chain.id;

          return (
            <DropdownMenuItem
              key={chain.id}
              onClick={() => handleNetworkSwitch(chain.id)}
              disabled={isCurrentChain || isSwitching}
              className="flex cursor-pointer items-center gap-2"
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    chain.id === 1
                      ? '#627EEA'
                      : chain.id === 137
                        ? '#8247E5'
                        : chain.id === 10
                          ? '#FF0420'
                          : chain.id === 42161
                            ? '#28A0F0'
                            : chain.id === 8453
                              ? '#0052FF'
                              : '#666',
                }}
              />

              <span className="flex-1">{chain.name}</span>

              {isSwitching && <Loader2 className="h-3 w-3 animate-spin" />}

              {isCurrentChain && !isSwitching && <Check className="h-3 w-3 text-green-500" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
