'use client';

import { Portfolio } from '@/types';

export interface PortfolioExportData {
  symbol: string;
  name: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  allocation: number;
  network: string;
  contractAddress: string;
  addedDate: string;
}

export class PortfolioExporter {
  static prepareExportData(portfolioData: Portfolio[]): PortfolioExportData[] {
    const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);

    return portfolioData.map(holding => ({
      symbol: holding.coin?.symbol || 'Unknown',
      name: holding.coin?.name || 'Unknown',
      amount: holding.amount,
      avgPrice: holding.avgPrice,
      currentPrice: holding.coin?.price?.price || 0,
      currentValue: holding.currentValue,
      profitLoss: holding.profitLoss,
      profitLossPercentage: holding.profitLossPercentage,
      allocation: totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0,
      network: holding.coin?.network || 'Unknown',
      contractAddress: holding.coin?.address || 'Unknown',
      addedDate: new Date(holding.createdAt).toLocaleDateString(),
    }));
  }

  static exportToCSV(portfolioData: Portfolio[]): void {
    const exportData = this.prepareExportData(portfolioData);

    if (exportData.length === 0) {
      throw new Error('No portfolio data to export');
    }

    // Create CSV headers
    const headers = [
      'Symbol',
      'Name',
      'Amount',
      'Avg Price (USD)',
      'Current Price (USD)',
      'Current Value (USD)',
      'Profit/Loss (USD)',
      'Profit/Loss (%)',
      'Allocation (%)',
      'Network',
      'Contract Address',
      'Added Date',
    ];

    // Create CSV rows
    const rows = exportData.map(item => [
      item.symbol,
      item.name,
      item.amount.toString(),
      item.avgPrice.toFixed(6),
      item.currentPrice.toFixed(6),
      item.currentValue.toFixed(2),
      item.profitLoss.toFixed(2),
      item.profitLossPercentage.toFixed(2),
      item.allocation.toFixed(2),
      item.network,
      item.contractAddress,
      item.addedDate,
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static exportToJSON(portfolioData: Portfolio[]): void {
    const exportData = this.prepareExportData(portfolioData);

    if (exportData.length === 0) {
      throw new Error('No portfolio data to export');
    }

    // Create comprehensive JSON export
    const jsonExport = {
      exportDate: new Date().toISOString(),
      totalHoldings: exportData.length,
      totalValue: exportData.reduce((sum, item) => sum + item.currentValue, 0),
      totalProfitLoss: exportData.reduce((sum, item) => sum + item.profitLoss, 0),
      totalProfitLossPercentage:
        exportData.reduce((sum, item) => sum + item.profitLossPercentage, 0) / exportData.length,
      holdings: exportData,
      summary: {
        topPerformer: exportData.reduce((best, current) =>
          current.profitLossPercentage > best.profitLossPercentage ? current : best
        ),
        worstPerformer: exportData.reduce((worst, current) =>
          current.profitLossPercentage < worst.profitLossPercentage ? current : worst
        ),
        largestHolding: exportData.reduce((largest, current) =>
          current.currentValue > largest.currentValue ? current : largest
        ),
        networkDistribution: this.calculateNetworkDistribution(exportData),
      },
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(jsonExport, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `portfolio_export_${new Date().toISOString().split('T')[0]}.json`
    );
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private static calculateNetworkDistribution(
    exportData: PortfolioExportData[]
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    exportData.forEach(item => {
      if (distribution?.[item.network]) {
        distribution[item.network] = (distribution[item.network] || 0) + item.currentValue;
      } else {
        distribution[item.network] = item.currentValue;
      }
    });

    return distribution;
  }

  static generateShareableLink(portfolioData: Portfolio[]): string {
    const exportData = this.prepareExportData(portfolioData);

    // Create a simplified version for sharing (without sensitive data)
    const shareData = {
      totalValue: exportData.reduce((sum, item) => sum + item.currentValue, 0),
      totalProfitLoss: exportData.reduce((sum, item) => sum + item.profitLoss, 0),
      holdingsCount: exportData.length,
      topHoldings: exportData
        .sort((a, b) => b.allocation - a.allocation)
        .slice(0, 5)
        .map(item => ({
          symbol: item.symbol,
          allocation: item.allocation,
          profitLossPercentage: item.profitLossPercentage,
        })),
      networks: [...new Set(exportData.map(item => item.network))],
    };

    // In a real implementation, this would generate a shareable link
    // For now, we'll create a data URL that can be shared
    const encodedData = btoa(JSON.stringify(shareData));
    return `${window.location.origin}/portfolio/shared?data=${encodedData}`;
  }
}
