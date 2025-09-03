'use client';

import { useRealTimeAlerts } from '@/hooks/use-real-time-alerts';
import { Bell, X, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface RealTimeAlertNotificationsProps {
  userId?: string;
  className?: string;
}

export function RealTimeAlertNotifications({ userId, className }: RealTimeAlertNotificationsProps) {
  const { recentAlerts, alertCount, clearAlertCount, clearRecentAlerts } =
    useRealTimeAlerts(userId);

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'price_above':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'price_below':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'volume_spike':
      case 'whale_movement':
      case 'social_spike':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatAlertTime = () => {
    // Since we don't have a timestamp in the event, we'll use current time
    return new Date().toLocaleTimeString();
  };

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative" onClick={clearAlertCount}>
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {alertCount > 99 ? '99+' : alertCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
              {recentAlerts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentAlerts}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {recentAlerts.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No recent alerts
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {recentAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-sm',
                        index === 0 && 'bg-accent/50' // Highlight most recent
                      )}
                    >
                      <div className="mt-0.5">{getAlertIcon(alert.alert.type)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">
                          {alert.coinSymbol} - {alert.coinName}
                        </div>
                        <div className="text-muted-foreground">{alert.message}</div>
                        <div className="text-xs text-muted-foreground">{formatAlertTime()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}
