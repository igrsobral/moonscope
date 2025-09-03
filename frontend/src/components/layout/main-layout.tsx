'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { Footer } from './footer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  className?: string;
}

export function MainLayout({ children, showSidebar = false, className }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />

      <div className="flex flex-1">
        {showSidebar && (
          <>
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
          </>
        )}

        {/* Main Content */}
        <main className={cn('flex-1', className)}>
          <div className="container py-6">{children}</div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
