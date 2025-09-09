'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3, Users } from 'lucide-react';

export interface AlertCondition {
  targetPrice?: number;
  percentageChange?: number;
  volumeThreshold?: number;
  socialThreshold?: number;
}

interface AlertConditionBuilderProps {
  alertType: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike';
  condition: AlertCondition;
  onChange: (condition: AlertCondition) => void;
  currentPrice?: number;
  currentVolume?: number;
  className?: string;
}

export function AlertConditionBuilder({
  alertType,
  condition,
  onChange,
  currentPrice,
  currentVolume,
  className,
}: AlertConditionBuilderProps) {
  const [conditionType, setConditionType] = useState<'price' | 'percentage'>('price');

  useEffect(() => {
    // Set default condition type based on what's already set
    if (condition.targetPrice !== undefined) {
      setConditionType('price');
    } else if (condition.percentageChange !== undefined) {
      setConditionType('percentage');
    }
  }, [condition]);

  const handleConditionChange = (field: keyof AlertCondition, value: number | undefined) => {
    const newCondition = { ...condition };

    // Clear other fields when switching condition types
    if (field === 'targetPrice') {
      delete newCondition.percentageChange;
    } else if (field === 'percentageChange') {
      delete newCondition.targetPrice;
    }

    if (value !== undefined && !isNaN(value)) {
      newCondition[field] = value;
    } else {
      delete newCondition[field];
    }

    onChange(newCondition);
  };

  const getAlertTypeInfo = () => {
    switch (alertType) {
      case 'price_above':
        return {
          title: 'Price Above Alert',
          description: 'Trigger when price goes above a target or increases by a percentage',
          icon: <TrendingUp className="h-5 w-5 text-green-600" />,
          color: 'green',
        };
      case 'price_below':
        return {
          title: 'Price Below Alert',
          description: 'Trigger when price goes below a target or decreases by a percentage',
          icon: <TrendingDown className="h-5 w-5 text-red-600" />,
          color: 'red',
        };
      case 'volume_spike':
        return {
          title: 'Volume Spike Alert',
          description: 'Trigger when trading volume exceeds a threshold or increases significantly',
          icon: <BarChart3 className="h-5 w-5 text-blue-600" />,
          color: 'blue',
        };
      case 'whale_movement':
        return {
          title: 'Whale Movement Alert',
          description: 'Trigger when large transactions (whale movements) are detected',
          icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
          color: 'orange',
        };
      case 'social_spike':
        return {
          title: 'Social Spike Alert',
          description: 'Trigger when social activity and mentions increase significantly',
          icon: <Users className="h-5 w-5 text-purple-600" />,
          color: 'purple',
        };
    }
  };

  const alertInfo = getAlertTypeInfo();

  const renderPriceConditions = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="condition-type">Condition Type</Label>
        <Select
          value={conditionType}
          onValueChange={(value: 'price' | 'percentage') => setConditionType(value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Specific Price Target</SelectItem>
            <SelectItem value="percentage">Percentage Change</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {conditionType === 'price' ? (
        <div>
          <Label htmlFor="target-price">
            Target Price {currentPrice && `(Current: $${currentPrice.toFixed(6)})`}
          </Label>
          <Input
            id="target-price"
            type="number"
            step="0.000001"
            placeholder="0.000001"
            value={condition.targetPrice || ''}
            onChange={e => handleConditionChange('targetPrice', parseFloat(e.target.value))}
          />
          {currentPrice && condition.targetPrice && (
            <p className="mt-1 text-sm text-muted-foreground">
              {alertType === 'price_above'
                ? `${((condition.targetPrice / currentPrice - 1) * 100).toFixed(2)}% above current price`
                : `${((1 - condition.targetPrice / currentPrice) * 100).toFixed(2)}% below current price`}
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label htmlFor="percentage-change">Percentage Change (%)</Label>
          <Input
            id="percentage-change"
            type="number"
            step="0.1"
            placeholder={alertType === 'price_above' ? '10' : '-10'}
            value={condition.percentageChange || ''}
            onChange={e => handleConditionChange('percentageChange', parseFloat(e.target.value))}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {alertType === 'price_above'
              ? 'Positive values for price increases (e.g., 10 for +10%)'
              : 'Negative values for price decreases (e.g., -10 for -10%)'}
          </p>
        </div>
      )}
    </div>
  );

  const renderVolumeConditions = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="volume-threshold">
          Volume Threshold (USD) {currentVolume && `(Current: $${currentVolume.toLocaleString()})`}
        </Label>
        <Input
          id="volume-threshold"
          type="number"
          step="1000"
          placeholder="1000000"
          value={condition.volumeThreshold || ''}
          onChange={e => handleConditionChange('volumeThreshold', parseFloat(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Alert when 24h volume exceeds this amount in USD
        </p>
      </div>

      <div>
        <Label htmlFor="volume-percentage">Or Percentage Increase (%)</Label>
        <Input
          id="volume-percentage"
          type="number"
          step="10"
          placeholder="200"
          value={condition.percentageChange || ''}
          onChange={e => handleConditionChange('percentageChange', parseFloat(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Alert when volume increases by this percentage (e.g., 200 for 200% increase)
        </p>
      </div>
    </div>
  );

  const renderWhaleConditions = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="whale-threshold">Transaction Threshold (USD)</Label>
        <Input
          id="whale-threshold"
          type="number"
          step="1000"
          placeholder="100000"
          value={condition.volumeThreshold || ''}
          onChange={e => handleConditionChange('volumeThreshold', parseFloat(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Alert when individual transactions exceed this amount in USD
        </p>
      </div>

      <div className="rounded-lg bg-muted p-3">
        <h4 className="font-medium">Common Thresholds:</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {[10000, 50000, 100000, 500000, 1000000].map(amount => (
            <Badge
              key={amount}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleConditionChange('volumeThreshold', amount)}
            >
              ${amount.toLocaleString()}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSocialConditions = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="social-threshold">Social Activity Score (0-100)</Label>
        <Input
          id="social-threshold"
          type="number"
          min="0"
          max="100"
          step="5"
          placeholder="70"
          value={condition.socialThreshold || ''}
          onChange={e => handleConditionChange('socialThreshold', parseFloat(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Alert when social activity score exceeds this threshold
        </p>
      </div>

      <div>
        <Label htmlFor="social-percentage">Or Percentage Increase (%)</Label>
        <Input
          id="social-percentage"
          type="number"
          step="10"
          placeholder="100"
          value={condition.percentageChange || ''}
          onChange={e => handleConditionChange('percentageChange', parseFloat(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Alert when social activity increases by this percentage
        </p>
      </div>

      <div className="rounded-lg bg-muted p-3">
        <h4 className="font-medium">Activity Levels:</h4>
        <div className="mt-2 space-y-1 text-sm">
          <div>• 0-30: Low activity</div>
          <div>• 30-60: Moderate activity</div>
          <div>• 60-80: High activity</div>
          <div>• 80-100: Viral activity</div>
        </div>
      </div>
    </div>
  );

  const renderConditionInputs = () => {
    switch (alertType) {
      case 'price_above':
      case 'price_below':
        return renderPriceConditions();
      case 'volume_spike':
        return renderVolumeConditions();
      case 'whale_movement':
        return renderWhaleConditions();
      case 'social_spike':
        return renderSocialConditions();
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          {alertInfo.icon}
          <div>
            <CardTitle className="text-lg">{alertInfo.title}</CardTitle>
            <CardDescription>{alertInfo.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderConditionInputs()}</CardContent>
    </Card>
  );
}
