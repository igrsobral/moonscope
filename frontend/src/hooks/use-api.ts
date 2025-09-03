'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Coin, CoinQuery, Portfolio, Alert, User, PaginationMeta } from '@/types';

// Query keys
export const queryKeys = {
  coins: ['coins'] as const,
  coin: (id: string) => ['coins', id] as const,
  portfolio: ['portfolio'] as const,
  alerts: ['alerts'] as const,
  user: ['user'] as const,
};

// Coins API hooks
export function useCoins(query: CoinQuery = {}) {
  return useQuery({
    queryKey: [...queryKeys.coins, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await apiClient.get<{
        coins: Coin[];
        pagination: PaginationMeta;
      }>(`/api/v1/coins?${params}`);

      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCoin(id: string) {
  return useQuery({
    queryKey: queryKeys.coin(id),
    queryFn: async () => {
      const response = await apiClient.get<Coin>(`/api/v1/coins/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCoinChart(id: string, timeframe: string) {
  return useQuery({
    queryKey: ['coin-chart', id, timeframe],
    queryFn: async () => {
      const response = await apiClient.get<any[]>(
        `/api/v1/coins/${id}/chart?timeframe=${timeframe}`
      );
      return response.data;
    },
    enabled: !!id && !!timeframe,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Portfolio API hooks
export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: async () => {
      const response = await apiClient.get<Portfolio[]>('/api/v1/portfolio');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAddToPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { coinId: number; amount: number; avgPrice: number }) => {
      const response = await apiClient.post<Portfolio>('/api/v1/portfolio', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
    },
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; amount: number; avgPrice: number }) => {
      const response = await apiClient.put<Portfolio>(`/api/v1/portfolio/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
    },
  });
}

export function useRemoveFromPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/api/v1/portfolio/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
    },
  });
}

// Alerts API hooks
export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: async () => {
      const response = await apiClient.get<Alert[]>('/api/v1/alerts');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Alert, 'id' | 'userId' | 'createdAt' | 'lastTriggered'>) => {
      const response = await apiClient.post<Alert>('/api/v1/alerts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Alert> & { id: number }) => {
      const response = await apiClient.put<Alert>(`/api/v1/alerts/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/api/v1/alerts/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}

// User API hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const response = await apiClient.get<User>('/api/v1/user/profile');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiClient.put<User>('/api/v1/user/profile', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}
