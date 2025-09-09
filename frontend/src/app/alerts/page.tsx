'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Plus,
  Search,
  Zap,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAlerts, AlertQuery } from '@/hooks/use-alerts';
import { Alert, Coin } from '@/types';
import { AlertCard } from '@/components/alerts/alert-card';
import { CreateAlertDialog } from '@/components/alerts/create-alert-dialog';
import { AlertTemplatesDialog } from '@/components/alerts/alert-templates-dialog';
import { AlertHistoryDialog } from '@/components/alerts/alert-history-dialog';
import { NotificationPreferences } from '@/components/alerts/notification-preferences';

export default function AlertsPage() {
  const [query, setQuery] = useState<AlertQuery>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | undefined>();
  const [selectedCoin, setSelectedCoin] = useState<Coin | undefined>();

  const { data: alertsData, isLoading } = useAlerts(query);

  const alerts = alertsData?.data || [];
  const pagination = alertsData?.meta?.pagination;

  const handleFilterChange = (field: keyof AlertQuery, value: any) => {
    setQuery(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handleEditAlert = (alert: Alert) => {
    setSelectedAlert(alert);
    setSelectedCoin(alert.coin);
    setShowCreateDialog(true);
  };

  const handleViewHistory = (alert: Alert) => {
    setSelectedAlert(alert);
    setShowHistoryDialog(true);
  };

  const handleCreateFromTemplate = () => {
    setSelectedAlert(undefined);
    setSelectedCoin(undefined);
    setShowCreateDialog(true);
  };

  const getAlertStats = () => {
    const activeAlerts = alerts.filter(alert => alert.isActive).length;
    const pausedAlerts = alerts.filter(alert => !alert.isActive).length;
    const recentlyTriggered = alerts.filter(
      alert =>
        alert.lastTriggered &&
        new Date(alert.lastTriggered) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return { activeAlerts, pausedAlerts, recentlyTriggered };
  };

  const stats = getAlertStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Manage your price alerts and notifications for meme coins.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowTemplatesDialog(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Alert
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pausedAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Triggered (24h)</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.recentlyTriggered}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">My Alerts</TabsTrigger>
          <TabsTrigger value="preferences">Notification Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[200px] flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search alerts..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={query.type || 'all'}
                  onValueChange={value =>
                    handleFilterChange('type', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Alert Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="price_above">Price Above</SelectItem>
                    <SelectItem value="price_below">Price Below</SelectItem>
                    <SelectItem value="volume_spike">Volume Spike</SelectItem>
                    <SelectItem value="whale_movement">Whale Movement</SelectItem>
                    <SelectItem value="social_spike">Social Spike</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={query.isActive?.toString() || 'all'}
                  onValueChange={value =>
                    handleFilterChange('isActive', value === 'all' ? undefined : value === 'true')
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Paused</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={`${query.sortBy}-${query.sortOrder}`}
                  onValueChange={value => {
                    const [sortBy, sortOrder] = value.split('-');
                    setQuery(prev => ({
                      ...prev,
                      sortBy: sortBy as any,
                      sortOrder: sortOrder as any,
                    }));
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt-desc">Newest First</SelectItem>
                    <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                    <SelectItem value="lastTriggered-desc">Recently Triggered</SelectItem>
                    <SelectItem value="type-asc">Type A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Alerts List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading alerts...</span>
            </div>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No alerts yet</h3>
                <p className="text-muted-foreground">
                  Create your first alert to get notified about price movements and market activity.
                </p>
                <div className="mt-4 flex justify-center space-x-2">
                  <Button onClick={() => setShowTemplatesDialog(true)} variant="outline">
                    <Zap className="mr-2 h-4 w-4" />
                    Browse Templates
                  </Button>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Alert
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {alerts
                  .filter(
                    alert =>
                      !searchTerm ||
                      alert.coin?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      alert.coin?.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      alert.name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(alert => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onEdit={handleEditAlert}
                      onViewHistory={handleViewHistory}
                    />
                  ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} alerts
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery(prev => ({ ...prev, page: prev.page! - 1 }))}
                      disabled={!pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery(prev => ({ ...prev, page: prev.page! + 1 }))}
                      disabled={!pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preferences">
          <NotificationPreferences
            onSave={async preferences => {
              // In a real app, this would call an API to save preferences
              console.log('Saving preferences:', preferences);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateAlertDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        {...(selectedCoin && { coin: selectedCoin })}
        {...(selectedAlert && {
          initialData: {
            coinId: selectedAlert.coinId,
            type: selectedAlert.type,
            condition: selectedAlert.condition,
            notificationMethods: selectedAlert.notificationMethods,
            ...(selectedAlert.name && { name: selectedAlert.name }),
            ...(selectedAlert.description && { description: selectedAlert.description }),
          },
        })}
      />

      <AlertTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        {...(selectedCoin && { coin: selectedCoin })}
        onSelectTemplate={handleCreateFromTemplate}
      />

      <AlertHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        {...(selectedAlert && { alert: selectedAlert })}
      />
    </div>
  );
}
