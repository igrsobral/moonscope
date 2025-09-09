'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Alert } from '@/types';
import { toast } from '@/components/ui/use-toast';

export interface AlertQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'lastTriggered' | 'type';
  sortOrder?: 'asc' | 'desc';
  coinId?: number;
  type?: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike';
  isActive?: boolean;
}

export interface CreateAlertData {
  coinId: number;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike';
  condition: {
    targetPrice?: number;
    percentageChange?: number;
    volumeThreshold?: number;
    socialThreshold?: number;
  };
  notificationMethods: ('email' | 'push' | 'sms')[];
  name?: string;
  description?: string;
}

export interface UpdateAlertData {
  condition?: {
    targetPrice?: number;
    percentageChange?: number;
    volumeThreshold?: number;
    socialThreshold?: number;
  };
  notificationMethods?: ('email' | 'push' | 'sms')[];
  isActive?: boolean;
  name?: string;
  description?: string;
}

export interface AlertAction {
  action: 'pause' | 'resume' | 'test';
}

export interface NotificationHistory {
  id: number;
  alertId: number;
  method: 'email' | 'push' | 'sms';
  recipient: string;
  subject: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';
  error?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useAlerts(query: AlertQuery = {}) {
  const buildQueryParams = (query: AlertQuery): URLSearchParams => {
    const params = new URLSearchParams();

    const queryEntries: Array<[keyof AlertQuery, string | undefined]> = [
      ['page', query.page?.toString()],
      ['limit', query.limit?.toString()],
      ['sortBy', query.sortBy],
      ['sortOrder', query.sortOrder],
      ['coinId', query.coinId?.toString()],
      ['type', query.type],
      ['isActive', query.isActive?.toString()],
    ];

    queryEntries.forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value);
      }
    });

    return params;
  };

  return useQuery({
    queryKey: ['alerts', query],
    queryFn: async () => {
      const params = buildQueryParams(query);
      const response = await apiClient.get<Alert[]>(`/api/v1/alerts?${params}`);
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAlert(alertId: number) {
  return useQuery({
    queryKey: ['alert', alertId],
    queryFn: async () => {
      const response = await apiClient.get<Alert>(`/api/v1/alerts/${alertId}`);
      return response;
    },
    enabled: !!alertId,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAlertData) => {
      const response = await apiClient.post<Alert>('/api/v1/alerts', data);
      return response;
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({
        title: 'Alert Created',
        description: `Alert "${response.data?.name || 'Unnamed alert'}" has been created successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Alert',
        description: error.message || 'Failed to create alert. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, data }: { alertId: number; data: UpdateAlertData }) => {
      const response = await apiClient.put<Alert>(`/api/v1/alerts/${alertId}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert', variables.alertId] });
      toast({
        title: 'Alert Updated',
        description: `Alert "${response.data?.name || 'Unnamed alert'}" has been updated successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Updating Alert',
        description: error.message || 'Failed to update alert. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: number) => {
      const response = await apiClient.delete(`/api/v1/alerts/${alertId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({
        title: 'Alert Deleted',
        description: 'Alert has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Deleting Alert',
        description: error.message || 'Failed to delete alert. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useAlertAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, action }: { alertId: number; action: AlertAction }) => {
      const response = await apiClient.post<Alert>(`/api/v1/alerts/${alertId}/actions`, action);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert', variables.alertId] });

      const actionMessages = {
        pause: 'Alert has been paused.',
        resume: 'Alert has been resumed.',
        test: 'Test notification has been sent.',
      };

      toast({
        title: 'Action Completed',
        description: actionMessages[variables.action.action],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Performing Action',
        description: error.message || 'Failed to perform action. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useNotificationHistory(
  alertId: number,
  query: { page?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: ['notification-history', alertId, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', query.limit.toString());

      const response = await apiClient.get<NotificationHistory[]>(
        `/api/v1/alerts/${alertId}/notifications?${params}`
      );
      return response;
    },
    enabled: !!alertId,
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertId,
      notificationId,
    }: {
      alertId: number;
      notificationId: number;
    }) => {
      const response = await apiClient.post(
        `/api/v1/alerts/${alertId}/notifications/${notificationId}/retry`
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-history', variables.alertId] });
      toast({
        title: 'Notification Retry',
        description: 'Notification has been queued for retry.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Retrying Notification',
        description: error.message || 'Failed to retry notification. Please try again.',
        variant: 'destructive',
      });
    },
  });
}
