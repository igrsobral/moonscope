'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Badge,
} from '@/components/ui';
import { Filter, X } from 'lucide-react';
import { CoinQuery } from '@/types';

interface CoinFiltersProps {
  filters: CoinQuery;
  onFiltersChange: (filters: CoinQuery) => void;
}

export function CoinFilters({ filters, onFiltersChange }: CoinFiltersProps) {
  const updateFilter = (key: keyof CoinQuery, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value,
      page: 1, // Reset to first page when filters change
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      limit: filters.limit,
    });
  };

  const hasActiveFilters = !!(filters.network || filters.minMarketCap || filters.maxRiskScore);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      {/* Network Filter */}
      <div className="min-w-[140px]">
        <Select
          value={filters.network || 'all'}
          onValueChange={value => updateFilter('network', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            <SelectItem value="ethereum">Ethereum</SelectItem>
            <SelectItem value="bsc">BSC</SelectItem>
            <SelectItem value="polygon">Polygon</SelectItem>
            <SelectItem value="solana">Solana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Market Cap Filter */}
      <div className="min-w-[160px]">
        <Select
          value={filters.minMarketCap?.toString() || 'all'}
          onValueChange={value =>
            updateFilter('minMarketCap', value === 'all' ? undefined : Number(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Market Cap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Market Caps</SelectItem>
            <SelectItem value="1000000">$1M+</SelectItem>
            <SelectItem value="10000000">$10M+</SelectItem>
            <SelectItem value="100000000">$100M+</SelectItem>
            <SelectItem value="1000000000">$1B+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Risk Level Filter */}
      <div className="min-w-[140px]">
        <Select
          value={filters.maxRiskScore?.toString() || 'all'}
          onValueChange={value =>
            updateFilter('maxRiskScore', value === 'all' ? undefined : Number(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="100">Low Risk (80-100)</SelectItem>
            <SelectItem value="79">Medium Risk (60-79)</SelectItem>
            <SelectItem value="59">High Risk (0-59)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort By */}
      <div className="min-w-[140px]">
        <Select
          value={filters.sortBy || 'marketCap'}
          onValueChange={value => updateFilter('sortBy', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketCap">Market Cap</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="volume">Volume</SelectItem>
            <SelectItem value="riskScore">Risk Score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="min-w-[120px]">
        <Select
          value={filters.sortOrder || 'desc'}
          onValueChange={value => updateFilter('sortOrder', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">High to Low</SelectItem>
            <SelectItem value="asc">Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="flex items-center space-x-2"
        >
          <X className="h-4 w-4" />
          <span>Clear</span>
        </Button>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.network && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>{filters.network.toUpperCase()}</span>
              <button
                onClick={() => updateFilter('network', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.minMarketCap && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>
                $
                {filters.minMarketCap >= 1e9
                  ? `${filters.minMarketCap / 1e9}B+`
                  : `${filters.minMarketCap / 1e6}M+`}
              </span>
              <button
                onClick={() => updateFilter('minMarketCap', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.maxRiskScore && filters.maxRiskScore < 100 && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>{filters.maxRiskScore <= 59 ? 'High Risk' : 'Medium Risk'}</span>
              <button
                onClick={() => updateFilter('maxRiskScore', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
