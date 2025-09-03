'use client';

import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api-client';
import { Coin, Portfolio } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

interface AddHoldingData {
  coinId: number;
  amount: number;
  avgPrice: number;
}

interface UpdateHoldingData {
  amount: number;
  avgPrice: number;
}

export function usePortfolioManagement(userId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: portfolioData = [],
    isLoading: isLoadingPortfolio,
    error: portfolioError,
  } = useQuery({
    queryKey: ['portfolio', userId],
    queryFn: async () => {
      const response = await apiClient.get<Portfolio[]>('/api/v1/portfolio');
      return response.data || [];
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch available coins for adding holdings
  const { data: availableCoins = [], isLoading: isLoadingCoins } = useQuery({
    queryKey: ['coins', 'available'],
    queryFn: async () => {
      const response = await apiClient.get<Coin[]>('/api/v1/coins', {
        limit: '100',
        sortBy: 'marketCap',
        sortOrder: 'desc',
      });
      return response.data || [];
    },
    staleTime: 300000, // 5 minutes
  });

  // Add holding mutation
  const addHoldingMutation = useMutation({
    mutationFn: async (data: AddHoldingData) => {
      const response = await apiClient.post<Portfolio>('/api/v1/portfolio', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast({
        title: 'Success',
        description: 'Holding added to your portfolio',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add holding',
        variant: 'destructive',
      });
    },
  });

  // Update holding mutation
  const updateHoldingMutation = useMutation({
    mutationFn: async ({ holdingId, data }: { holdingId: number; data: UpdateHoldingData }) => {
      const response = await apiClient.put<Portfolio>(`/api/v1/portfolio/${holdingId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast({
        title: 'Success',
        description: 'Holding updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update holding',
        variant: 'destructive',
      });
    },
  });

  // Delete holding mutation
  const deleteHoldingMutation = useMutation({
    mutationFn: async (holdingId: number) => {
      await apiClient.delete(`/api/v1/portfolio/${holdingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast({
        title: 'Success',
        description: 'Holding removed from your portfolio',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete holding',
        variant: 'destructive',
      });
    },
  });

  // Calculate portfolio metrics
  const portfolioMetrics = useCallback(() => {
    const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);
    const totalInvested = portfolioData.reduce(
      (sum, holding) => sum + holding.amount * holding.avgPrice,
      0
    );
    const totalProfitLoss = totalValue - totalInvested;
    const totalProfitLossPercentage =
      totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalProfitLoss,
      totalProfitLossPercentage,
      holdingsCount: portfolioData.length,
    };
  }, [portfolioData]);

  // Add holding
  const addHolding = useCallback(
    async (data: AddHoldingData) => {
      return addHoldingMutation.mutateAsync(data);
    },
    [addHoldingMutation]
  );

  // Update holding
  const updateHolding = useCallback(
    async (holdingId: number, data: UpdateHoldingData) => {
      return updateHoldingMutation.mutateAsync({ holdingId, data });
    },
    [updateHoldingMutation]
  );

  // Delete holding
  const deleteHolding = useCallback(
    async (holdingId: number) => {
      return deleteHoldingMutation.mutateAsync(holdingId);
    },
    [deleteHoldingMutation]
  );

  // Sync with wallet (placeholder for future implementation)
  const syncWithWallet = useCallback(
    async (walletAddress: string) => {
      try {
        setIsLoading(true);
        // TODO: integrate with Web3 to detect holdings automatically
        const response = await apiClient.post('/api/v1/portfolio/sync', { walletAddress });
        queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        toast({
          title: 'Success',
          description: 'Portfolio synced with wallet',
        });
        return response.data;
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to sync with wallet',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient, toast]
  );

  return {
    // Data
    portfolioData,
    availableCoins,
    portfolioMetrics: portfolioMetrics(),

    // Loading states
    isLoading: isLoading || isLoadingPortfolio,
    isLoadingCoins,
    isAddingHolding: addHoldingMutation.isPending,
    isUpdatingHolding: updateHoldingMutation.isPending,
    isDeletingHolding: deleteHoldingMutation.isPending,

    // Error states
    portfolioError,

    // Actions
    addHolding,
    updateHolding,
    deleteHolding,
    syncWithWallet,

    // Utilities
    refetchPortfolio: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
  };
}
