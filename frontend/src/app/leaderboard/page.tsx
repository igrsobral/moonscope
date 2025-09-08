'use client';

import { PortfolioLeaderboard } from '@/components/portfolio';
import { usePortfolioManagement } from '@/hooks/use-portfolio-management';

export default function LeaderboardPage() {
  const { portfolioData } = usePortfolioManagement();

  const currentUserStats =
    portfolioData.length > 0
      ? {
          id: 'current-user',
          username: 'You',
          avatar: undefined,
          portfolioValue: portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0),
          profitLoss: portfolioData.reduce((sum, holding) => sum + holding.profitLoss, 0),
          profitLossPercentage:
            portfolioData.length > 0
              ? portfolioData.reduce((sum, holding) => sum + holding.profitLossPercentage, 0) /
                portfolioData.length
              : 0,
          holdingsCount: portfolioData.length,
          topCoin: portfolioData.length > 0 ? (portfolioData?.[0]?.coin?.symbol ?? 'N/A') : 'N/A',
          joinedDate: new Date().toISOString().split('T')[0],
          isVerified: undefined,
        }
      : undefined;

  const currentUserRank = currentUserStats ? Math.floor(Math.random() * 50) + 10 : undefined;

  return (
    <div className="container mx-auto py-8">
      <PortfolioLeaderboard currentUserRank={currentUserRank} currentUserStats={currentUserStats} />
    </div>
  );
}
