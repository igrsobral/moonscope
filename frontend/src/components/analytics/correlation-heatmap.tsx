'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CorrelationData {
  coinA: string;
  coinB: string;
  correlation: number;
  significance: number;
}

interface CorrelationHeatmapProps {
  data: CorrelationData[];
  selectedCoin?: string;
}

export function CorrelationHeatmap({ data, selectedCoin }: CorrelationHeatmapProps) {
  const { matrix, coins } = useMemo(() => {
    // Get unique coins
    const coinSet = new Set<string>();
    data.forEach(item => {
      coinSet.add(item.coinA);
      coinSet.add(item.coinB);
    });

    const coins = Array.from(coinSet).sort();

    // Filter coins if selectedCoin is provided
    const filteredCoins = selectedCoin
      ? coins
          .filter(
            coin =>
              coin === selectedCoin ||
              data.some(
                d =>
                  (d.coinA === selectedCoin && d.coinB === coin) ||
                  (d.coinB === selectedCoin && d.coinA === coin)
              )
          )
          .slice(0, 10) // Limit to 10 for readability
      : coins.slice(0, 15); // Limit to 15 for performance

    // Create correlation matrix
    const matrix: number[][] = [];
    for (let i = 0; i < filteredCoins.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < filteredCoins.length; j++) {
        if (i === j) {
          matrix[i]![j] = 1; // Perfect correlation with itself
        } else {
          const correlation = data.find(
            d =>
              (d.coinA === filteredCoins[i] && d.coinB === filteredCoins[j]) ||
              (d.coinA === filteredCoins[j] && d.coinB === filteredCoins[i])
          );
          matrix[i]![j] = correlation ? correlation.correlation : 0;
        }
      }
    }

    return { matrix, coins: filteredCoins };
  }, [data, selectedCoin]);

  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    const intensity = Math.min(abs, 1);

    if (correlation > 0) {
      // Green for positive correlation
      const opacity = intensity * 0.8 + 0.1;
      return `rgba(34, 197, 94, ${opacity})`;
    } else if (correlation < 0) {
      // Red for negative correlation
      const opacity = intensity * 0.8 + 0.1;
      return `rgba(239, 68, 68, ${opacity})`;
    } else {
      // Gray for no correlation
      return 'rgba(156, 163, 175, 0.2)';
    }
  };

  const getTextColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    return abs > 0.5 ? 'text-white' : 'text-gray-900';
  };

  const formatCorrelation = (value: number) => {
    return value.toFixed(2);
  };

  if (coins.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        <p>No correlation data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}
          ></div>
          <span>Strong Negative (-1.0)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: 'rgba(156, 163, 175, 0.2)' }}
          ></div>
          <span>No Correlation (0.0)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}
          ></div>
          <span>Strong Positive (+1.0)</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-auto">
        <div className="min-w-max">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="h-16 w-16"></th>
                {coins.map(coin => (
                  <th key={coin} className="h-16 w-16 text-xs font-medium">
                    <div className="origin-center -rotate-45 transform">{coin}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coins.map((coinA, i) => (
                <tr key={coinA}>
                  <td className="h-16 w-16 border-r pr-2 text-right text-xs font-medium">
                    {coinA}
                  </td>
                  {coins.map((coinB, j) => {
                    const correlation = matrix[i]![j]!;
                    return (
                      <td
                        key={`${coinA}-${coinB}`}
                        className={cn(
                          'h-16 w-16 cursor-pointer border border-gray-200 text-center text-xs font-medium transition-opacity hover:opacity-80',
                          getTextColor(correlation)
                        )}
                        style={{ backgroundColor: getCorrelationColor(correlation) }}
                        title={`${coinA} vs ${coinB}: ${formatCorrelation(correlation)}`}
                      >
                        {formatCorrelation(correlation)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        Showing correlation matrix for {coins.length} coins
        {selectedCoin && ` (filtered by ${selectedCoin})`}
      </div>
    </div>
  );
}
