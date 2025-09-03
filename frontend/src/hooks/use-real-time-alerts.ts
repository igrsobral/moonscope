'use client';

import { useState, useCallback } from 'react';
import { useWebSocketEvent } from './use-websocket';
import { Alert } from '@/types';
import { toast } from '@/components/ui/use-toast';

interface AlertTriggeredEvent {
  userId: string;
  alert: Alert;
  coinSymbol: string;
  coinName: string;
  triggerValue: number;
  message: string;
}

export function useRealTimeAlerts(userId?: string) {
  const [recentAlerts, setRecentAlerts] = useState<AlertTriggeredEvent[]>([]);
  const [alertCount, setAlertCount] = useState<number>(0);

  const handleAlertTriggered = useCallback(
    (data: AlertTriggeredEvent) => {
      if (!userId || data.userId === userId) {
        setRecentAlerts(prev => [data, ...prev.slice(0, 9)]); // Keep last 10 alerts
        setAlertCount(prev => prev + 1);

        toast({
          title: `Alert Triggered: ${data.coinSymbol}`,
          description: data.message,
          duration: 5000,
        });
      }
    },
    [userId]
  );

  useWebSocketEvent('alert_triggered', handleAlertTriggered, [userId]);

  const clearAlertCount = useCallback(() => {
    setAlertCount(0);
  }, []);

  const clearRecentAlerts = useCallback(() => {
    setRecentAlerts([]);
    setAlertCount(0);
  }, []);

  return {
    recentAlerts,
    alertCount,
    clearAlertCount,
    clearRecentAlerts,
  };
}
