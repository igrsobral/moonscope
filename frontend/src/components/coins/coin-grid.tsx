'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCoins } from '@/hooks/use-api';
import { CoinQuery } from '@/types';
import { RealTimeCoinCard } from './real-time-coin-card';
import { CoinSearch } from './coin-search';
import { CoinFilters } from './coin-filters';
import { CoinPagination } from './coin-pagination';
import { LoadingState, EmptyState } from '@/components/ui';
import { Coins, AlertCircle } from 'lucide-react';

interface CoinGridProps {
  initialQuery?: CoinQuery;
}

export function CoinGrid({ initialQuery = {} }: CoinGridProps) {
  const router = useRouter();
  const [query, setQuery] = useState<CoinQuery>({
    page: 1,
    limit: 20,
    sortBy: 'marketCap',
    sortOrder: 'desc',
    ...initialQuery,
  });

  const { data, isLoading, error, isError } = useCoins(query);

  const handleSearchChange = (search: string) => {
    setQuery(
      prev =>
        ({
          ...prev,
          search: search || undefined,
          page: 1,
        }) as CoinQuery
    );
  };

  const handleFiltersChange = (newFilters: CoinQuery) => {
    setQuery(newFilters);
  };

  const handlePageChange = (page: number) => {
    setQuery(prev => ({
      ...prev,
      page,
    }));
  };

  const handleCoinClick = (coin: any) => {
    router.push(`/coins/${coin.id}`);
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <CoinSearch value={query.search || ''} onChange={handleSearchChange} />
          </div>
        </div>

        <EmptyState
          icon={AlertCircle}
          title="Failed to load coins"
          description={
            error?.message || 'There was an error loading the coin data. Please try again.'
          }
          action={{
            label: 'Retry',
            onClick: () => window.location.reload(),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <CoinSearch value={query.search || ''} onChange={handleSearchChange} />
          </div>
        </div>

        <CoinFilters filters={query} onFiltersChange={handleFiltersChange} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <LoadingState message="Loading coins... Fetching the latest coin data and market information." />
      )}

      {/* Results */}
      {!isLoading && data && (
        <>
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Coins className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {data.pagination.total} coins found
                {query.search && <span> for &quot;{query.search}&quot;</span>}
              </span>
            </div>
          </div>

          {/* Coin Grid */}
          {data.coins.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.coins.map(coin => (
                  <RealTimeCoinCard key={coin.id} coin={coin} onClick={handleCoinClick} />
                ))}
              </div>

              {/* Pagination */}
              <CoinPagination pagination={data.pagination} onPageChange={handlePageChange} />
            </>
          ) : (
            <EmptyState
              icon={Coins}
              title="No coins found"
              description={
                query.search
                  ? `No coins match your search for "${query.search}". Try adjusting your search terms or filters.`
                  : 'No coins match your current filters. Try adjusting your filter criteria.'
              }
              action={{
                label: 'Clear filters',
                onClick: () =>
                  setQuery({
                    page: 1,
                    limit: 20,
                    sortBy: 'marketCap',
                    sortOrder: 'desc',
                  } as CoinQuery),
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
