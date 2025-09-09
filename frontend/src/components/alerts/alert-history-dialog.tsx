'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Alert } from '@/types';
import {
  useNotificationHistory,
  useRetryNotification,
  NotificationHistory,
} from '@/hooks/use-alerts';
import { formatDistanceToNow, format } from 'date-fns';

interface AlertHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert?: Alert;
}

export function AlertHistoryDialog({ open, onOpenChange, alert }: AlertHistoryDialogProps) {
  const [page, setPage] = useState(1);
  const {
    data: historyData,
    isLoading,
    refetch,
  } = useNotificationHistory(alert?.id || 0, { page, limit: 20 });
  const retryNotification = useRetryNotification();

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'push':
        return <Smartphone className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'retrying':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'sent':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'retrying':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleRetry = async (notificationId: number) => {
    if (!alert) return;
    await retryNotification.mutateAsync({ alertId: alert.id, notificationId });
  };

  const notifications = historyData?.data || [];
  const pagination = historyData?.meta?.pagination;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Alert History</DialogTitle>
          <DialogDescription>
            {alert && `Notification history for ${alert.coin?.name} (${alert.coin?.symbol}) alert`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4 overflow-hidden">
          {/* Alert Summary */}
          {alert && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Alert Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 font-medium">{alert.type.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="ml-2" variant={alert.isActive ? 'default' : 'secondary'}>
                      {alert.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2">{format(new Date(alert.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Triggered:</span>
                    <span className="ml-2">
                      {alert.lastTriggered
                        ? formatDistanceToNow(new Date(alert.lastTriggered)) + ' ago'
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Notification History */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Notification History</h3>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading history...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No notifications have been sent for this alert yet.
              </div>
            ) : (
              notifications.map((notification: NotificationHistory) => (
                <Card key={notification.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5">{getMethodIcon(notification.method)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium capitalize">{notification.method}</span>
                            <Badge variant={getStatusColor(notification.status) as any}>
                              {notification.status}
                            </Badge>
                            {notification.retryCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Retry {notification.retryCount}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            To: {notification.recipient}
                          </p>
                          <p className="mt-1 text-sm font-medium">{notification.subject}</p>
                          {notification.error && (
                            <p className="mt-1 text-sm text-destructive">
                              Error: {notification.error}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {getStatusIcon(notification.status)}
                        {notification.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(notification.id)}
                            disabled={retryNotification.isPending}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      {format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}({pagination.total} total
                notifications)
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
