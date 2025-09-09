'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertConditionBuilder, AlertCondition } from './alert-condition-builder';
import { useCreateAlert, CreateAlertData } from '@/hooks/use-alerts';
import { Coin } from '@/types';
import { Loader2 } from 'lucide-react';

const createAlertSchema = z.object({
  coinId: z.number().positive(),
  type: z.enum(['price_above', 'price_below', 'volume_spike', 'whale_movement', 'social_spike']),
  name: z.string().min(1, 'Alert name is required').max(100),
  description: z.string().max(500).optional(),
  notificationMethods: z
    .array(z.enum(['email', 'push', 'sms']))
    .min(1, 'At least one notification method is required'),
});

type CreateAlertForm = z.infer<typeof createAlertSchema>;

interface CreateAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coin?: Coin;
  initialData?: Partial<CreateAlertData>;
}

export function CreateAlertDialog({
  open,
  onOpenChange,
  coin,
  initialData,
}: CreateAlertDialogProps) {
  const [condition, setCondition] = useState<AlertCondition>(initialData?.condition || {});
  const createAlert = useCreateAlert();

  const form = useForm<CreateAlertForm>({
    resolver: zodResolver(createAlertSchema),
    defaultValues: {
      coinId: coin?.id || initialData?.coinId || 0,
      type: initialData?.type || 'price_above',
      name: initialData?.name || '',
      description: initialData?.description || '',
      notificationMethods: initialData?.notificationMethods || ['email'],
    },
  });

  const watchedType = form.watch('type');

  const handleSubmit = async (data: CreateAlertForm) => {
    // Validate that condition has required fields based on alert type
    const hasValidCondition = validateCondition(data.type, condition);
    if (!hasValidCondition) {
      form.setError('root', { message: 'Please configure the alert condition' });
      return;
    }

    try {
      await createAlert.mutateAsync({
        coinId: data.coinId,
        type: data.type,
        condition,
        notificationMethods: data.notificationMethods,
        name: data.name,
        ...(data.description && { description: data.description }),
      });
      onOpenChange(false);
      form.reset();
      setCondition({});
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const validateCondition = (type: string, condition: AlertCondition): boolean => {
    switch (type) {
      case 'price_above':
      case 'price_below':
        return !!(condition.targetPrice || condition.percentageChange);
      case 'volume_spike':
        return !!(condition.volumeThreshold || condition.percentageChange);
      case 'whale_movement':
        return !!condition.volumeThreshold;
      case 'social_spike':
        return !!(condition.socialThreshold || condition.percentageChange);
      default:
        return false;
    }
  };

  const notificationOptions = [
    { id: 'email', label: 'Email', description: 'Receive alerts via email' },
    { id: 'push', label: 'Push Notifications', description: 'Browser push notifications' },
    { id: 'sms', label: 'SMS', description: 'Text message alerts (premium)' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Alert</DialogTitle>
          <DialogDescription>
            {coin
              ? `Set up an alert for ${coin.name} (${coin.symbol})`
              : 'Configure your alert settings'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Alert Name</Label>
              <Input id="name" placeholder="My Price Alert" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this alert is for..."
                {...form.register('description')}
              />
            </div>

            <div>
              <Label htmlFor="type">Alert Type</Label>
              <Select
                value={form.watch('type')}
                onValueChange={value => form.setValue('type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">Price Above</SelectItem>
                  <SelectItem value="price_below">Price Below</SelectItem>
                  <SelectItem value="volume_spike">Volume Spike</SelectItem>
                  <SelectItem value="whale_movement">Whale Movement</SelectItem>
                  <SelectItem value="social_spike">Social Spike</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Alert Condition Builder */}
          <AlertConditionBuilder
            alertType={watchedType}
            condition={condition}
            onChange={setCondition}
            {...(coin?.price?.price && { currentPrice: coin.price.price })}
            {...(coin?.price?.volume24h && { currentVolume: coin.price.volume24h })}
          />

          {/* Notification Methods */}
          <div className="space-y-3">
            <Label>Notification Methods</Label>
            <div className="space-y-3">
              {notificationOptions.map(option => (
                <div key={option.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={option.id}
                    checked={form.watch('notificationMethods').includes(option.id as any)}
                    onCheckedChange={checked => {
                      const current = form.getValues('notificationMethods');
                      if (checked) {
                        form.setValue('notificationMethods', [...current, option.id as any]);
                      } else {
                        form.setValue(
                          'notificationMethods',
                          current.filter(m => m !== option.id)
                        );
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={option.id} className="text-sm font-medium">
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.notificationMethods && (
              <p className="text-sm text-destructive">
                {form.formState.errors.notificationMethods.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAlert.isPending}>
              {createAlert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
