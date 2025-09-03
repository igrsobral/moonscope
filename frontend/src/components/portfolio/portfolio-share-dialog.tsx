'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Portfolio } from '@/types';
import { Copy, Eye, EyeOff, Mail, MessageCircle, Share2, Twitter } from 'lucide-react';
import { useState } from 'react';
import { PortfolioExporter } from './portfolio-export';

interface PortfolioShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioData: Portfolio[];
}

export function PortfolioShareDialog({
  open,
  onOpenChange,
  portfolioData,
}: PortfolioShareDialogProps) {
  const [shareLink, setShareLink] = useState('');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const { toast } = useToast();

  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalProfitLoss = portfolioData.reduce((sum, holding) => sum + holding.profitLoss, 0);
  const totalProfitLossPercentage =
    portfolioData.length > 0
      ? portfolioData.reduce((sum, holding) => sum + holding.profitLossPercentage, 0) /
        portfolioData.length
      : 0;

  const generateShareLink = async () => {
    try {
      setIsGeneratingLink(true);
      const link = PortfolioExporter.generateShareableLink(portfolioData);
      setShareLink(link);
      toast({
        title: 'Share link generated',
        description: 'Your portfolio share link has been created',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate share link',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Link copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const shareToTwitter = () => {
    const text = `Check out my meme coin portfolio performance! 📈\n\nTotal Value: ${formatCurrency(totalValue)}\nP&L: ${totalProfitLoss >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalProfitLoss))} (${totalProfitLossPercentage.toFixed(2)}%)\n\n#MemeCoins #Crypto #Portfolio`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareLink)}`;
    window.open(url, '_blank');
  };

  const shareToTelegram = () => {
    const text = `Check out my meme coin portfolio performance!\n\nTotal Value: ${formatCurrency(totalValue)}\nP&L: ${totalProfitLoss >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalProfitLoss))} (${totalProfitLossPercentage.toFixed(2)}%)\n\n${shareLink}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'My Meme Coin Portfolio Performance';
    const body = `Check out my meme coin portfolio performance!\n\nTotal Value: ${formatCurrency(totalValue)}\nProfit/Loss: ${totalProfitLoss >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalProfitLoss))} (${totalProfitLossPercentage.toFixed(2)}%)\nHoldings: ${portfolioData.length} coins\n\nView details: ${shareLink}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Portfolio
          </DialogTitle>
          <DialogDescription>
            Share your portfolio performance with others. You can control what information is
            visible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Portfolio Summary */}
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Portfolio Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Holdings:</span>
                <div className="font-medium">{portfolioData.length} coins</div>
              </div>
              <div>
                <span className="text-muted-foreground">Networks:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[...new Set(portfolioData.map(p => p.coin?.network))].map(network => (
                    <Badge key={network} variant="secondary" className="text-xs">
                      {network}
                    </Badge>
                  ))}
                </div>
              </div>
              {showSensitiveData && (
                <>
                  <div>
                    <span className="text-muted-foreground">Total Value:</span>
                    <div className="font-medium">{formatCurrency(totalValue)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">P&L:</span>
                    <div
                      className={`font-medium ${totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(Math.abs(totalProfitLoss))} (
                      {formatPercentage(totalProfitLossPercentage)})
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Privacy Controls */}
          <div className="space-y-3">
            <Label>Privacy Settings</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {showSensitiveData ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <div className="text-sm font-medium">Show Portfolio Values</div>
                  <div className="text-xs text-muted-foreground">
                    Include total value and profit/loss in shared link
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitiveData(!showSensitiveData)}
              >
                {showSensitiveData ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>

          {/* Generate Share Link */}
          {!shareLink && (
            <Button onClick={generateShareLink} disabled={isGeneratingLink} className="w-full">
              {isGeneratingLink ? 'Generating...' : 'Generate Share Link'}
            </Button>
          )}

          {/* Share Link */}
          {shareLink && (
            <div className="space-y-3">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(shareLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Social Sharing */}
          {shareLink && (
            <div className="space-y-3">
              <Label>Share On</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={shareToTwitter} className="flex-1">
                  <Twitter className="mr-2 h-4 w-4" />
                  Twitter
                </Button>
                <Button variant="outline" size="sm" onClick={shareToTelegram} className="flex-1">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Telegram
                </Button>
                <Button variant="outline" size="sm" onClick={shareViaEmail} className="flex-1">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
