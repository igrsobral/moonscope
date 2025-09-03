'use client';

import { useState, useCallback } from 'react';
import { useWebSocketEvent } from './use-websocket';
import { PriceData } from '@/types';

interface PriceUpdateEvent {
  coinId: string;
  price: PriceData;
}

export function useRealTimePrice(coinId?: string) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handlePriceUpdate = useCallback(
    (data: PriceUpdateEvent) => {
      // Only update if this is for the coin we're tracking
      if (!coinId || data.coinId === coinId) {
        setPriceData(data.price);
        setLastUpdate(new Date());
      }
    },
    [coinId]
  );

  useWebSocketEvent('price_update', handlePriceUpdate, [coinId]);

  return {
    priceData,
    lastUpdate,
  };
}

export function useRealTimePrices(coinIds?: string[]) {
  const [pricesData, setPricesData] = useState<Record<string, PriceData>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handlePriceUpdate = useCallback(
    (data: PriceUpdateEvent) => {
      // Only update if this is for one of the coins we're tracking
      if (!coinIds || coinIds.includes(data.coinId)) {
        setPricesData(prev => ({
          ...prev,
          [data.coinId]: data.price,
        }));
        setLastUpdate(new Date());
      }
    },
    [coinIds]
  );

  useWebSocketEvent('price_update', handlePriceUpdate, [coinIds]);

  return {
    pricesData,
    lastUpdate,
    getPriceData: (coinId: string) => pricesData[coinId] || null,
  };
}
