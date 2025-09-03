'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { Portfolio } from '@/types';
import { Loader2 } from 'lucide-react';

const editHoldingSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  avgPrice: z.number().positive('Average price must be greater than 0'),
});

type EditHoldingForm = z.infer<typeof editHoldingSchema>;

interface EditHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: Portfolio | null;
  onSubmit: (holdingId: number, data: EditHoldingForm) => Promise<void>;
}

export function EditHoldingDialog({
  open,
  onOpenChange,
  holding,
  onSubmit,
}: EditHoldingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditHoldingForm>({
    resolver: zodResolver(editHoldingSchema),
  });

  // Reset form when holding changes
  useEffect(() => {
    if (holding) {
      reset({
        amount: holding.amount,
        avgPrice: holding.avgPrice,
      });
    }
  }, [holding, reset]);

  const handleFormSubmit = async (data: EditHoldingForm) => {
    if (!holding) return;

    try {
      setIsSubmitting(true);
      await onSubmit(holding.id, data);
      onOpenChange(false);
      toast({
        title: 'Success',
        description: 'Holding updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update holding',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotalValue = () => {
    const amount = watch('amount');
    const avgPrice = watch('avgPrice');
    if (amount && avgPrice) {
      return amount * avgPrice;
    }
    return 0;
  };

  const calculateValueChange = () => {
    if (!holding) return { absolute: 0, percentage: 0 };

    const currentTotal = calculateTotalValue();
    const originalTotal = holding.amount * holding.avgPrice;
    const absolute = currentTotal - originalTotal;
    const percentage = originalTotal > 0 ? (absolute / originalTotal) * 100 : 0;

    return { absolute, percentage };
  };

  const valueChange = calculateValueChange();

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Update your {holding.coin?.symbol || 'Unknown'} holding details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Coin Info */}
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{holding.coin?.symbol || 'Unknown'}</div>
                <div className="text-sm text-muted-foreground">
                  {holding.coin?.name || 'Unknown'}
                </div>
              </div>
              {holding.coin?.price && (
                <div className="text-right">
                  <div className="font-medium">${holding.coin.price.price.toFixed(6)}</div>
                  <div
                    className={`text-sm ${
                      holding.coin.price.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {holding.coin.price.priceChange24h >= 0 ? '+' : ''}
                    {holding.coin.price.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
          </div>

          {/* Average Price */}
          <div className="space-y-2">
            <Label htmlFor="avgPrice">Average Price (USD)</Label>
            <Input
              id="avgPrice"
              type="number"
              step="any"
              placeholder="0.00"
              {...register('avgPrice', { valueAsNumber: true })}
            />
            {errors.avgPrice && <p className="text-sm text-red-600">{errors.avgPrice.message}</p>}
          </div>

          {/* Current vs New Investment */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-3 text-sm">
            <div>
              <span className="text-muted-foreground">Current Investment:</span>
              <div className="font-medium">
                ${(holding.amount * holding.avgPrice).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">New Investment:</span>
              <div className="font-medium">${calculateTotalValue().toLocaleString()}</div>
            </div>
          </div>

          {/* Value Change Preview */}
          {Math.abs(valueChange.absolute) > 0.01 && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-sm font-medium">Investment Change:</div>
              <div
                className={`text-sm ${
                  valueChange.absolute >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {valueChange.absolute >= 0 ? '+' : ''}$
                {Math.abs(valueChange.absolute).toLocaleString()}(
                {valueChange.absolute >= 0 ? '+' : ''}
                {valueChange.percentage.toFixed(2)}%)
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Holding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
