'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { WalletConnectButton } from '@/components/ui/wallet-connect-button';
import { NetworkSwitcher } from '@/components/ui/network-switcher';
import { WebSocketStatus } from '@/components/ui/websocket-status';
import { RealTimeAlertNotifications } from '@/components/alerts/real-time-alert-notifications';
import { useWallet } from '@/hooks/use-wallet';
import { Coins, Menu, X, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isConnected } = useWallet();
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Coins', href: '/coins' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Alerts', href: '/alerts' },
    { name: 'Analytics', href: '/analytics' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center space-x-2">
          <Coins className="h-6 w-6 text-primary" />
          <span className="hidden text-xl font-bold sm:inline-block">MemeAnalyzer</span>
          <span className="text-xl font-bold sm:hidden">MA</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-1 md:flex">
          {navigation.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Search button - hidden on mobile */}
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>

          {/* Real-time alert notifications */}
          <RealTimeAlertNotifications />

          {/* WebSocket connection status */}
          <WebSocketStatus showLabel={false} className="hidden sm:flex" />

          <ThemeToggle />

          <div className="hidden items-center space-x-2 sm:flex">
            <WalletConnectButton size="sm" />
            {isConnected && <NetworkSwitcher />}
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <nav className="container space-y-1 py-4">
            {navigation.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="mt-4 space-y-2 border-t pt-4">
              <WalletConnectButton size="sm" className="w-full" />
              {isConnected && <NetworkSwitcher className="w-full" />}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
