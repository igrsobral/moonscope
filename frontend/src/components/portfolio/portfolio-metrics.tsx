'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Portfolio } from '@/types';
import { TrendingUp, TrendingDown, Shield, Target, BarChart3, AlertTriangle } from 'lucide-react';

interface PortfolioMetricsProps {
  portfolioData: Portfolio[];
}

interface AdvancedMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  alpha: number;
  volatility: number;
  valueAtRisk: number;
  diversificationRatio: number;
  informationRatio: number;
}

export function PortfolioMetrics({ portfolioData }: PortfolioMetricsProps) {
  const totalValue = portfolioData.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvested = portfolioData.reduce(
    (sum, holding) => sum + holding.amount * holding.avgPrice,
    0
  );
  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  // Calculate advanced metrics (using mock calculations for demonstration)
  const calculateAdvancedMetrics = (): AdvancedMetrics => {
    const returns = portfolioData.map(h => h.profitLossPercentage);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    return {
      sharpeRatio: volatility > 0 ? (avgReturn - 2) / volatility : 0, // Assuming 2% risk-free rate
      maxDrawdown: Math.min(...returns) * -1,
      beta: 0.8 + Math.random() * 0.4, // Mock beta between 0.8-1.2
      alpha: avgReturn - 0.05 * 1.0, // Mock alpha calculation
      volatility,
      valueAtRisk: Math.abs(avgReturn) * 1.65, // 95% VaR approximation
      diversificationRatio: Math.min(portfolioData.length / 10, 1), // Simple diversification measure
      informationRatio: volatility > 0 ? avgReturn / volatility : 0,
    };
  };

  const metrics = calculateAdvancedMetrics();

  const getRiskLevel = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0])
      return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-700' };
    if (value <= thresholds[1])
      return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'High', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  const getPerformanceRating = (sharpe: number) => {
    if (sharpe > 1) return { rating: 'Excellent', color: 'bg-green-500' };
    if (sharpe > 0.5) return { rating: 'Good', color: 'bg-blue-500' };
    if (sharpe > 0) return { rating: 'Fair', color: 'bg-yellow-500' };
    return { rating: 'Poor', color: 'bg-red-500' };
  };

  const volatilityRisk = getRiskLevel(metrics.volatility, [10, 20]);

  const performanceRating = getPerformanceRating(metrics.sharpeRatio);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Performance Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance Rating</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.sharpeRatio.toFixed(2)}</span>
              <Badge className={performanceRating.color}>{performanceRating.rating}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Sharpe Ratio (Risk-Adjusted Return)</div>
            <Progress
              value={Math.min(Math.max((metrics.sharpeRatio + 1) * 33.33, 0), 100)}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Risk Analysis</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Volatility</span>
              <Badge variant="outline" className={volatilityRisk.textColor}>
                {volatilityRisk.level}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{metrics.volatility.toFixed(1)}%</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Max Drawdown: {metrics.maxDrawdown.toFixed(1)}%</span>
              <span>VaR: {metrics.valueAtRisk.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Exposure */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Market Exposure</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Beta</span>
              <span className="text-2xl font-bold">{metrics.beta.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.beta > 1 ? 'More volatile than market' : 'Less volatile than market'}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Alpha: {metrics.alpha.toFixed(2)}%</span>
              <span className={metrics.alpha > 0 ? 'text-green-600' : 'text-red-600'}>
                {metrics.alpha > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diversification */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Diversification</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-2xl font-bold">
              {(metrics.diversificationRatio * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Portfolio Diversification Score</div>
            <Progress value={metrics.diversificationRatio * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {portfolioData.length} assets in portfolio
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Ratio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Information Ratio</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-2xl font-bold">{metrics.informationRatio.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Risk-Adjusted Excess Return</div>
            <div
              className={`text-xs ${
                metrics.informationRatio > 0.5
                  ? 'text-green-600'
                  : metrics.informationRatio > 0
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {metrics.informationRatio > 0.5
                ? 'Strong performance'
                : metrics.informationRatio > 0
                  ? 'Moderate performance'
                  : 'Underperforming'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Summary</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Value:</span>
              <span className="font-medium">${totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total P&L:</span>
              <span
                className={`font-medium ${
                  totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Return:</span>
              <span
                className={`font-medium ${
                  totalProfitLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {totalProfitLossPercentage >= 0 ? '+' : ''}
                {totalProfitLossPercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
