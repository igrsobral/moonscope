'use client';

import { AddHoldingDialog } from '@/components/portfolio/add-holding-dialog';
import { EditHoldingDialog } from '@/components/portfolio/edit-holding-dialog';
import { PortfolioAnalyticsChart } from '@/components/portfolio/portfolio-analytics-chart';
import { PortfolioExporter } from '@/components/portfolio/portfolio-export';
import { PortfolioHoldingsList } from '@/components/portfolio/portfolio-holdings-list';
import { PortfolioMetrics } from '@/components/portfolio/portfolio-metrics';
import { PortfolioComparison } from '@/components/portfolio/portfolio-comparison';
import { PortfolioExportDialog } from '@/components/portfolio/portfolio-export-dialog';
import { PortfolioLeaderboard } from '@/components/portfolio/portfolio-leaderboard';
import { PortfolioOverview } from '@/components/portfolio/portfolio-overview';
import { PortfolioShareDialog } from '@/components/portfolio/portfolio-share-dialog';
import { LoadingState } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { usePortfolioManagement } from '@/hooks/use-portfolio-management';
import { Portfolio } from '@/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// TODO: Replace with actual user ID from authentication context
const DEMO_USER_ID = 'demo-user';

export default function PortfolioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Portfolio | null>(null);

  const {
    portfolioData,
    availableCoins,
    portfolioMetrics,
    isLoading,
    addHolding,
    updateHolding,
    deleteHolding,
  } = usePortfolioManagement(DEMO_USER_ID);

  const handleAddHolding = async (data: { coinId: number; amount: number; avgPrice: number }) => {
    await addHolding(data);
    setShowAddDialog(false);
  };

  const handleEditHolding = (holding: Portfolio) => {
    setEditingHolding(holding);
    setShowEditDialog(true);
  };

  const handleUpdateHolding = async (
    holdingId: number,
    data: { amount: number; avgPrice: number }
  ) => {
    await updateHolding(holdingId, data);
    setShowEditDialog(false);
    setEditingHolding(null);
  };

  const handleDeleteHolding = async (holdingId: number) => {
    if (confirm('Are you sure you want to delete this holding?')) {
      await deleteHolding(holdingId);
    }
  };

  const handleViewCoinDetails = (coinId: number) => {
    router.push(`/coins/${coinId}`);
  };

  const handleExport = (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') {
        PortfolioExporter.exportToCSV(portfolioData);
      } else {
        PortfolioExporter.exportToJSON(portfolioData);
      }
      toast({
        title: 'Export successful',
        description: `Portfolio exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export portfolio',
        variant: 'destructive',
      });
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Track your meme coin portfolio performance and analytics.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <div></div>
            <PortfolioExportDialog portfolioData={portfolioData} />
          </div>
          <PortfolioOverview
            portfolioData={portfolioData}
            totalValue={portfolioMetrics.totalValue}
            totalProfitLoss={portfolioMetrics.totalProfitLoss}
            totalProfitLossPercentage={portfolioMetrics.totalProfitLossPercentage}
            onAddHolding={() => setShowAddDialog(true)}
            onExport={handleExport}
            onShare={handleShare}
          />
        </TabsContent>

        <TabsContent value="holdings" className="space-y-6">
          <PortfolioHoldingsList
            portfolioData={portfolioData}
            onEditHolding={handleEditHolding}
            onDeleteHolding={handleDeleteHolding}
            onViewCoinDetails={handleViewCoinDetails}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <PortfolioMetrics portfolioData={portfolioData} />
          <PortfolioAnalyticsChart portfolioData={portfolioData} />
          <PortfolioComparison portfolioData={portfolioData} />
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <PortfolioLeaderboard
            currentUserRank={Math.floor(Math.random() * 50) + 10}
            currentUserStats={{
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
              topCoin: portfolioData.length > 0 ? (portfolioData[0]?.coin?.symbol ?? 'N/A') : 'N/A',
              joinedDate: new Date().toISOString().split('T')[0] || new Date().toLocaleDateString(),
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddHoldingDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleAddHolding}
        availableCoins={availableCoins}
      />

      <EditHoldingDialog
        open={showEditDialog}
        onOpenChange={open => {
          setShowEditDialog(open);
          if (!open) setEditingHolding(null);
        }}
        holding={editingHolding}
        onSubmit={handleUpdateHolding}
      />

      <PortfolioShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        portfolioData={portfolioData}
      />
    </div>
  );
}
