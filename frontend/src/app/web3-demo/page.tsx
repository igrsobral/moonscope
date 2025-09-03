'use client';

import { WalletStatus } from '@/components/ui/wallet-status';
import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';

export default function Web3DemoPage() {
  const {
    isConnected,
    isConnecting,
    address,
    chainId,
    chainName,
    isWrongNetwork,
    supportedChains,
  } = useWallet();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  const openEtherscan = () => {
    if (address && chainId === 1) {
      window.open(`https://etherscan.io/address/${address}`, '_blank');
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Web3 Integration Demo</h1>
        <p className="text-muted-foreground">
          Test wallet connection, network switching, and Web3 functionality
        </p>
      </div>

      {/* Wallet Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Connection</CardTitle>
          <CardDescription>Connect your wallet to test Web3 integration</CardDescription>
        </CardHeader>
        <CardContent>
          <WalletStatus />
        </CardContent>
      </Card>

      {/* Connection Details */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>Information about your current wallet connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Wallet Address</label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                  </code>
                  {address && (
                    <>
                      <Button size="sm" variant="ghost" onClick={copyAddress}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {chainId === 1 && (
                        <Button size="sm" variant="ghost" onClick={openEtherscan}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Network</label>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={isWrongNetwork ? 'destructive' : 'default'}>
                    {chainName || 'Unknown'} ({chainId})
                  </Badge>
                  {isWrongNetwork && <Badge variant="outline">Unsupported</Badge>}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Connection Status</label>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supported Networks */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Networks</CardTitle>
          <CardDescription>Networks supported by this application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {supportedChains.map(chain => (
              <div
                key={chain.id}
                className={`rounded-lg border p-3 ${
                  chainId === chain.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{chain.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {chain.id}
                  </Badge>
                </div>
                {chainId === chain.id && (
                  <Badge variant="default" className="mt-2 text-xs">
                    Current
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>Web3 integration components and features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Components</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  WalletConnectButton
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  NetworkSwitcher
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  WalletStatus
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  useWallet Hook
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Features</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  Wallet Connection
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  Network Switching
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  Multi-wallet Support
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  Theme Integration
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
