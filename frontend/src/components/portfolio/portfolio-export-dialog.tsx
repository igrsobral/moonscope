'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Portfolio } from '@/types';
import { CheckboxItem } from '@radix-ui/react-dropdown-menu';
import { Calendar, Database, Download, FileText, Share, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PortfolioExporter } from './portfolio-export';

interface PortfolioExportDialogProps {
  portfolioData: Portfolio[];
  trigger?: React.ReactNode;
}

interface ExportOptions {
  format: 'csv' | 'json';
  includeMetrics: boolean;
  includeHistorical: boolean;
  includeProfitLoss: boolean;
  dateRange: '7d' | '30d' | '90d' | '1y' | 'all';
}

export function PortfolioExportDialog({ portfolioData, trigger }: PortfolioExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeMetrics: true,
    includeHistorical: false,
    includeProfitLoss: true,
    dateRange: '30d',
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (portfolioData.length === 0) {
      toast.error('No portfolio data to export');
      return;
    }

    setIsExporting(true);

    try {
      if (exportOptions.format === 'csv') {
        PortfolioExporter.exportToCSV(portfolioData);
      } else {
        PortfolioExporter.exportToJSON(portfolioData);
      }

      toast.success(`Portfolio exported as ${exportOptions.format.toUpperCase()}`);
      setOpen(false);
    } catch (error) {
      toast.error('Failed to export portfolio');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = () => {
    try {
      const shareableLink = PortfolioExporter.generateShareableLink(portfolioData);
      navigator.clipboard.writeText(shareableLink);
      toast.success('Shareable link copied to clipboard');
    } catch (error) {
      toast.error('Failed to generate shareable link');
      console.error('Share error:', error);
    }
  };

  const getPreviewData = () => {
    const exportData = PortfolioExporter.prepareExportData(portfolioData);

    if (exportOptions.format === 'csv') {
      const headers = ['Symbol', 'Name', 'Amount', 'Current Value', 'P&L %'];
      const preview = [headers.join(',')];

      exportData.slice(0, 3).forEach(item => {
        preview.push(
          [
            item.symbol,
            `"${item.name}"`,
            item.amount.toString(),
            item.currentValue.toFixed(2),
            item.profitLossPercentage.toFixed(2),
          ].join(',')
        );
      });

      if (exportData.length > 3) {
        preview.push('...');
      }

      return preview.join('\n');
    } else {
      const jsonPreview = {
        summary: {
          totalHoldings: exportData.length,
          totalValue: exportData.reduce((sum, item) => sum + item.currentValue, 0),
        },
        holdings: exportData.slice(0, 2).map(item => ({
          symbol: item.symbol,
          name: item.name,
          currentValue: item.currentValue,
          profitLossPercentage: item.profitLossPercentage,
        })),
      };

      if (exportData.length > 2) {
        (jsonPreview.holdings as any).push('...');
      }

      return JSON.stringify(jsonPreview, null, 2);
    }
  };

  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalProfitLoss = portfolioData.reduce((sum, holding) => sum + holding.profitLoss, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Portfolio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Portfolio Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Portfolio Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Holdings:</span>
                <span className="font-medium">{portfolioData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Value:</span>
                <span className="font-medium">${totalValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total P&L:</span>
                <span
                  className={`font-medium ${
                    totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  ${totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Export Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={exportOptions.format}
              onValueChange={(value: 'csv' | 'json') =>
                setExportOptions(prev => ({ ...prev, format: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV (Excel compatible)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    JSON (Developer friendly)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Label>Export Options</Label>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckboxItem
                  id="includeMetrics"
                  checked={exportOptions.includeMetrics}
                  onCheckedChange={checked =>
                    setExportOptions(prev => ({ ...prev, includeMetrics: checked as boolean }))
                  }
                />
                <Label htmlFor="includeMetrics" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Include portfolio metrics
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <CheckboxItem
                  id="includeProfitLoss"
                  checked={exportOptions.includeProfitLoss}
                  onCheckedChange={checked =>
                    setExportOptions(prev => ({ ...prev, includeProfitLoss: checked as boolean }))
                  }
                />
                <Label htmlFor="includeProfitLoss">Include profit/loss data</Label>
              </div>

              <div className="flex items-center space-x-2">
                <CheckboxItem
                  id="includeHistorical"
                  checked={exportOptions.includeHistorical}
                  onCheckedChange={checked =>
                    setExportOptions(prev => ({ ...prev, includeHistorical: checked as boolean }))
                  }
                />
                <Label htmlFor="includeHistorical" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Include network & contract info
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Export Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                {portfolioData.length > 0 ? getPreviewData() : 'No data to preview'}
              </pre>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              disabled={isExporting || portfolioData.length === 0}
              className="flex-1"
            >
              {isExporting ? (
                'Exporting...'
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export {exportOptions.format.toUpperCase()}
                </>
              )}
            </Button>

            <Button variant="outline" onClick={handleShare} disabled={portfolioData.length === 0}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
