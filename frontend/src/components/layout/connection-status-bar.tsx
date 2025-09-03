'use client';

import { useWebSocket } from '@/hooks/use-websocket';
import { WebSocketStatus } from '@/components/ui/websocket-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusBarProps {
  className?: string;
}

export function ConnectionStatusBar({ className }: ConnectionStatusBarProps) {
  const { isConnected, connectionState } = useWebSocket();

  // Only show the bar when there are connection issues
  if (isConnected) {
    return null;
  }

  const getStatusMessage = () => {
    switch (connectionState) {
      case 'CONNECTING':
        return 'Connecting to real-time data...';
      case 'CLOSING':
        return 'Disconnecting from real-time data...';
      case 'CLOSED':
      default:
        return 'Real-time data unavailable. Some features may not work properly.';
    }
  };

  const isError = connectionState === 'CLOSED';

  return (
    <div className={cn('w-full', className)}>
      <Alert variant={isError ? 'destructive' : 'default'} className="rounded-none border-x-0">
        {isError ? <AlertTriangle className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
        <AlertDescription className="flex items-center justify-between">
          <span>{getStatusMessage()}</span>
          <WebSocketStatus showLabel={false} />
        </AlertDescription>
      </Alert>
    </div>
  );
}
