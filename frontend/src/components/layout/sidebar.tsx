'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bell,
  Coins,
  Home,
  TrendingUp,
  Wallet,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Coins', href: '/coins', icon: Coins },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'Alerts', href: '/alerts', icon: Bell, badge: '3' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Trending', href: '/trending', icon: TrendingUp },
];

const secondaryNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
}

export function Sidebar({ className, collapsed = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn('flex flex-col border-r bg-background', collapsed ? 'w-16' : 'w-64', className)}
    >
      <div className="flex-1 space-y-4 py-4">
        {/* Main Navigation */}
        <div className="px-3 py-2">
          {!collapsed && (
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Navigation</h2>
          )}
          <div className="space-y-1">
            {navigation.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        {!collapsed && (
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Quick Stats</h2>
            <div className="space-y-3 px-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Portfolio Value</span>
                <span className="font-medium">$0.00</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">24h Change</span>
                <span className="font-medium text-green-600">+0.00%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Alerts</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tracked Coins</span>
                <span className="font-medium">12</span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Secondary Navigation */}
        <div className="px-3 py-2">
          <div className="space-y-1">
            {secondaryNavigation.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                  {!collapsed && item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collapse Toggle */}
      {!collapsed && (
        <div className="border-t p-4">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <TrendingUp className="mr-2 h-4 w-4" />
            Market Status: Active
          </Button>
        </div>
      )}
    </div>
  );
}
