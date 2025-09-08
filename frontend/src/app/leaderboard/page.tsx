'use client';

import { PortfolioLeaderboard } from '@/components/portfolio';
import { usePortfolioManagement } from '@/hooks/use-portfolio-management';

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar?: string;
  portfolioValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  holdingsCount: number;
  topCoin: string;
  joinedDate: string;
  rank: number;
  isVerified?: boolean;
}

export default function LeaderboardPage() {
  const { portfolioData } = usePortfolioManagement();

  const currentUserStats: Omit<LeaderboardEntry, 'rank'> | undefined =
    portfolioData.length > 0
      ? {
          id: 'current-user',
          username: 'You',
          portfolioValue: portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0),
          profitLoss: portfolioData.reduce((sum, holding) => sum + holding.profitLoss, 0),
          profitLossPercentage:
            portfolioData.length > 0
              ? portfolioData.reduce((sum, holding) => sum + holding.profitLossPercentage, 0) /
                portfolioData.length
              : 0,
          holdingsCount: portfolioData.length,
          topCoin: portfolioData.length > 0 ? (portfolioData?.[0]?.coin?.symbol ?? 'N/A') : 'N/A',
          joinedDate: new Date().toISOString().split('T')[0] || new Date().toLocaleDateString(),
        }
      : undefined;

  const currentUserRank = currentUserStats ? Math.floor(Math.random() * 50) + 10 : undefined;

  return (
    <div className="container mx-auto py-8">
      <PortfolioLeaderboard
        {...(currentUserRank !== undefined && { currentUserRank })}
        {...(currentUserStats !== undefined && { currentUserStats })}
      />
    </div>
  );
}
