'use client';

import { useWebSocket } from '@/hooks/use-websocket';
import { Badge } from './badge';
import { Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebSocketStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function WebSocketStatus({ className, showLabel = true }: WebSocketStatusProps) {
  const { connectionState } = useWebSocket();

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'OPEN':
        return {
          icon: Wifi,
          label: 'Connected',
          variant: 'default' as const,
          color: 'text-green-600',
        };
      case 'CONNECTING':
        return {
          icon: RefreshCw,
          label: 'Connecting',
          variant: 'secondary' as const,
          color: 'text-yellow-600',
          animate: true,
        };
      case 'CLOSING':
        return {
          icon: AlertCircle,
          label: 'Disconnecting',
          variant: 'secondary' as const,
          color: 'text-orange-600',
        };
      case 'CLOSED':
      default:
        return {
          icon: WifiOff,
          label: 'Disconnected',
          variant: 'destructive' as const,
          color: 'text-red-600',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className={cn('h-4 w-4', config.color, config.animate && 'animate-spin')} />
      {showLabel && (
        <Badge variant={config.variant} className="text-xs">
          {config.label}
        </Badge>
      )}
    </div>
  );
}
