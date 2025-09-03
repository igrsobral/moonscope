'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} />
      </aside>

      {/* Sidebar Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-20 z-40 hidden lg:flex"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Main Content */}
      <div className={cn('flex-1 lg:pl-4', className)}>{children}</div>
    </div>
  );
}
