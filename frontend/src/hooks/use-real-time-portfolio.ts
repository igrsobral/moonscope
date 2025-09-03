'use client';

import { useState, useCallback } from 'react';
import { useWebSocketEvent } from './use-websocket';
import { Portfolio } from '@/types';

interface PortfolioUpdateEvent {
  userId: string;
  portfolio: Portfolio[];
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
}

export function useRealTimePortfolio(userId?: string) {
  const [portfolioData, setPortfolioData] = useState<Portfolio[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState<number>(0);
  const [totalProfitLossPercentage, setTotalProfitLossPercentage] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handlePortfolioUpdate = useCallback(
    (data: PortfolioUpdateEvent) => {
      if (!userId || data.userId === userId) {
        setPortfolioData(data.portfolio);
        setTotalValue(data.totalValue);
        setTotalProfitLoss(data.totalProfitLoss);
        setTotalProfitLossPercentage(data.totalProfitLossPercentage);
        setLastUpdate(new Date());
      }
    },
    [userId]
  );

  useWebSocketEvent('portfolio_update', handlePortfolioUpdate, [userId]);

  return {
    portfolioData,
    totalValue,
    totalProfitLoss,
    totalProfitLossPercentage,
    lastUpdate,
  };
}
