'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Bell,
  Edit,
  MoreVertical,
  Pause,
  Play,
  TestTube,
  Trash2,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Alert } from '@/types';
import { useAlertAction, useDeleteAlert } from '@/hooks/use-alerts';
import { formatDistanceToNow } from 'date-fns';

interface AlertCardProps {
  alert: Alert;
  onEdit?: (alert: Alert) => void;
  onViewHistory?: (alert: Alert) => void;
}

export function AlertCard({ alert, onEdit, onViewHistory }: AlertCardProps) {
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const alertAction = useAlertAction();
  const deleteAlert = useDeleteAlert();

  const getAlertTypeIcon = () => {
    switch (alert.type) {
      case 'price_above':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'price_below':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'volume_spike':
        return <BarChart3 className="h-4 w-4 text-blue-600" />;
      case 'whale_movement':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'social_spike':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertTypeLabel = () => {
    switch (alert.type) {
      case 'price_above':
        return 'Price Above';
      case 'price_below':
        return 'Price Below';
      case 'volume_spike':
        return 'Volume Spike';
      case 'whale_movement':
        return 'Whale Movement';
      case 'social_spike':
        return 'Social Spike';
      default:
        return alert.type;
    }
  };

  const getConditionSummary = () => {
    const condition = alert.condition;
    const parts = [];

    if (condition.targetPrice) {
      parts.push(`$${condition.targetPrice.toFixed(6)}`);
    }
    if (condition.percentageChange) {
      parts.push(`${condition.percentageChange > 0 ? '+' : ''}${condition.percentageChange}%`);
    }
    if (condition.volumeThreshold) {
      parts.push(`$${condition.volumeThreshold.toLocaleString()}`);
    }
    if (condition.socialThreshold) {
      parts.push(`${condition.socialThreshold}/100`);
    }

    return parts.join(' • ') || 'No conditions set';
  };

  const handleAction = async (action: 'pause' | 'resume' | 'test') => {
    setIsActionLoading(action);
    try {
      await alertAction.mutateAsync({ alertId: alert.id, action: { action } });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      await deleteAlert.mutateAsync(alert.id);
    }
  };

  return (
    <Card className={`transition-colors ${alert.isActive ? 'border-primary/20' : 'border-muted'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="mt-0.5">{getAlertTypeIcon()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="truncate font-semibold">
                  {alert.coin?.name || 'Unknown Coin'} ({alert.coin?.symbol || 'N/A'})
                </h3>
                <Badge variant={alert.isActive ? 'default' : 'secondary'}>
                  {alert.isActive ? 'Active' : 'Paused'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{getAlertTypeLabel()}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(alert)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Alert
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => handleAction(alert.isActive ? 'pause' : 'resume')}
                disabled={isActionLoading === (alert.isActive ? 'pause' : 'resume')}
              >
                {alert.isActive ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Alert
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Alert
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAction('test')}
                disabled={isActionLoading === 'test'}
              >
                <TestTube className="mr-2 h-4 w-4" />
                Test Alert
              </DropdownMenuItem>
              {onViewHistory && (
                <DropdownMenuItem onClick={() => onViewHistory(alert)}>
                  <Clock className="mr-2 h-4 w-4" />
                  View History
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
                disabled={deleteAlert.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Alert
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Alert Name */}
        {alert.name && (
          <div>
            <p className="text-sm font-medium">{alert.name}</p>
          </div>
        )}

        {/* Condition Summary */}
        <div>
          <p className="text-sm text-muted-foreground">Condition:</p>
          <p className="font-mono text-sm">{getConditionSummary()}</p>
        </div>

        {/* Notification Methods */}
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Notifications:</p>
          <div className="flex flex-wrap gap-1">
            {alert.notificationMethods.map(method => (
              <Badge key={method} variant="outline" className="text-xs">
                {method}
              </Badge>
            ))}
          </div>
        </div>

        {/* Last Triggered */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            {alert.lastTriggered ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>Last triggered {formatDistanceToNow(new Date(alert.lastTriggered))} ago</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span>Never triggered</span>
              </>
            )}
          </div>
          <span>Created {formatDistanceToNow(new Date(alert.createdAt))} ago</span>
        </div>
      </CardContent>
    </Card>
  );
}
