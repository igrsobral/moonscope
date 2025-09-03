'use client';

import { Coin } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui';
import {
  AlertTriangle,
  Shield,
  Users,
  Droplets,
  MessageSquare,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskAssessmentDisplayProps {
  coin: Coin;
}

export function RiskAssessmentDisplay({ coin }: RiskAssessmentDisplayProps) {
  const risk = coin.risk;

  if (!risk) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <p>Risk assessment not available</p>
      </div>
    );
  }

  const getRiskLevel = (score: number) => {
    if (score >= 80)
      return {
        level: 'Low Risk',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        icon: CheckCircle,
      };
    if (score >= 60)
      return {
        level: 'Medium Risk',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        icon: Info,
      };
    return {
      level: 'High Risk',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
    };
  };

  const overallRisk = getRiskLevel(risk.overallScore);
  const OverallIcon = overallRisk.icon;

  const riskFactors = [
    {
      name: 'Liquidity',
      score: risk.factors.liquidity.score,
      icon: Droplets,
      description: 'Token liquidity and trading depth',
      details: `$${(risk.factors.liquidity.value / 1000000).toFixed(2)}M liquidity`,
      threshold: risk.factors.liquidity.threshold,
    },
    {
      name: 'Holder Distribution',
      score: risk.factors.holderDistribution.score,
      icon: Users,
      description: 'Token distribution among holders',
      details: `${risk.factors.holderDistribution.topHoldersPercentage}% held by top holders`,
      threshold: risk.factors.holderDistribution.holderCount,
    },
    {
      name: 'Contract Security',
      score: risk.factors.contractSecurity.score,
      icon: Shield,
      description: 'Smart contract security analysis',
      details: coin.contractVerified ? 'Contract verified' : 'Contract not verified',
      threshold: null,
    },
    {
      name: 'Social Metrics',
      score: risk.factors.socialMetrics.score,
      icon: MessageSquare,
      description: 'Community engagement and sentiment',
      details: `${(risk.factors.socialMetrics.sentimentScore * 100).toFixed(0)}% positive sentiment`,
      threshold: risk.factors.socialMetrics.communitySize,
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className={cn('rounded-lg border-2 p-4', overallRisk.bgColor, overallRisk.borderColor)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <OverallIcon className={cn('h-5 w-5', overallRisk.color)} />
            <span className={cn('font-semibold', overallRisk.color)}>{overallRisk.level}</span>
          </div>
          <Badge variant="outline" className={cn('font-bold', overallRisk.color)}>
            {risk.overallScore}/100
          </Badge>
        </div>

        <Progress
          value={risk.overallScore}
          className="h-3"
          indicatorClassName={getProgressColor(risk.overallScore)}
        />
      </div>

      {/* Risk Factors Breakdown */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Risk Factors
        </h4>

        {riskFactors.map((factor, index) => {
          const FactorIcon = factor.icon;

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FactorIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{factor.name}</span>
                </div>
                <span className={cn('text-sm font-semibold', getScoreColor(factor.score))}>
                  {factor.score}/100
                </span>
              </div>

              <Progress
                value={factor.score}
                className="h-2"
                indicatorClassName={getProgressColor(factor.score)}
              />

              <div className="flex flex-col space-y-1">
                <p className="text-xs text-muted-foreground">{factor.description}</p>
                <p className="text-xs font-medium">{factor.details}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Indicators */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Security Checks
        </h4>

        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between rounded border p-2">
            <span className="text-sm">Contract Verified</span>
            {risk.factors.contractSecurity.isVerified ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <span className="text-sm">Ownership Renounced</span>
            {risk.factors.contractSecurity.hasOwnershipRenounced ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <span className="text-sm">Proxy Contract</span>
            {risk.factors.contractSecurity.hasProxyContract ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>
        </div>
      </div>

      {/* Risk Warnings */}
      {risk.overallScore < 50 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h5 className="font-semibold text-red-800">High Risk Warning</h5>
              <p className="mt-1 text-sm text-red-700">
                This token shows multiple risk indicators. Please conduct thorough research before
                investing and consider the high volatility and potential for loss.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
