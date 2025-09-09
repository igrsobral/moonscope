'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Clock } from 'lucide-react';
import { WhaleTransaction } from '@/types';
import { cn } from '@/lib/utils';

interface WhaleTransactionsListProps {
  transactions: WhaleTransaction[];
  title?: string;
  showImpact?: boolean;
}

export function WhaleTransactionsList({
  transactions,
  title = 'Whale Transactions',
  showImpact = false,
}: WhaleTransactionsListProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1e9) {
      return `${(amount / 1e9).toFixed(2)}B`;
    }
    if (amount >= 1e6) {
      return `${(amount / 1e6).toFixed(2)}M`;
    }
    if (amount >= 1e3) {
      return `${(amount / 1e3).toFixed(2)}K`;
    }
    return amount.toFixed(2);
  };

  const getTransactionType = (tx: WhaleTransaction) => {
    // Simple heuristic: if from address is a known exchange/DEX, it's likely a buy
    // This would be more sophisticated in a real implementation
    const knownExchanges = ['0x0000000000000000000000000000000000000000'];
    const isBuy = knownExchanges.includes(tx.fromAddress.toLowerCase());
    return isBuy ? 'buy' : 'sell';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const txTime = new Date(timestamp);
    const diffMs = now.getTime() - txTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return txTime.toLocaleDateString();
  };

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            <p>No whale transactions found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map(tx => {
            const txType = getTransactionType(tx);
            const isBuy = txType === 'buy';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      isBuy ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    )}
                  >
                    {isBuy ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : (
                      <ArrowDownLeft className="h-5 w-5" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={isBuy ? 'default' : 'destructive'} className="text-xs">
                        {isBuy ? 'BUY' : 'SELL'}
                      </Badge>
                      {tx.coin && (
                        <Badge variant="outline" className="text-xs">
                          {tx.coin.symbol}
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <span>From: {formatAddress(tx.fromAddress)}</span>
                        <span>→</span>
                        <span>To: {formatAddress(tx.toAddress)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <div className="font-medium">
                    {formatAmount(tx.amount)} {tx.coin?.symbol || 'tokens'}
                  </div>
                  <div className="text-lg font-bold">{formatCurrency(tx.usdValue)}</div>
                  {showImpact && (
                    <div className="text-xs text-muted-foreground">High impact transaction</div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://etherscan.io/tx/${tx.txHash}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {transactions.length >= 10 && (
          <div className="mt-4 border-t pt-4">
            <Button variant="outline" className="w-full">
              Load More Transactions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
