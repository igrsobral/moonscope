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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Coin } from '@/types';
import { Search, Loader2 } from 'lucide-react';

const addHoldingSchema = z.object({
  coinId: z.number().positive('Please select a coin'),
  amount: z.number().positive('Amount must be greater than 0'),
  avgPrice: z.number().positive('Average price must be greater than 0'),
});

type AddHoldingForm = z.infer<typeof addHoldingSchema>;

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddHoldingForm) => Promise<void>;
  availableCoins: Coin[];
}

export function AddHoldingDialog({
  open,
  onOpenChange,
  onSubmit,
  availableCoins,
}: AddHoldingDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddHoldingForm>({
    resolver: zodResolver(addHoldingSchema),
  });

  const selectedCoinId = watch('coinId');
  const selectedCoin = availableCoins.find(coin => coin.id === selectedCoinId);

  const filteredCoins = availableCoins.filter(
    coin =>
      coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFormSubmit = async (data: AddHoldingForm) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      reset();
      onOpenChange(false);
      toast({
        title: 'Success',
        description: 'Holding added to your portfolio',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add holding',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Holding</DialogTitle>
          <DialogDescription>
            Add a new cryptocurrency holding to your portfolio manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Coin Selection */}
          <div className="space-y-2">
            <Label htmlFor="coin">Cryptocurrency</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search coins..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedCoinId?.toString()}
              onValueChange={value => setValue('coinId', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a coin" />
              </SelectTrigger>
              <SelectContent>
                {filteredCoins.map(coin => (
                  <SelectItem key={coin.id} value={coin.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{coin.symbol}</span>
                      <span className="text-muted-foreground">{coin.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.coinId && <p className="text-sm text-red-600">{errors.coinId.message}</p>}
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

          {/* Current Price Display */}
          {selectedCoin?.price && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span>Current Price:</span>
                <span className="font-medium">${selectedCoin.price.price.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>24h Change:</span>
                <span
                  className={`font-medium ${
                    selectedCoin.price.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {selectedCoin.price.priceChange24h >= 0 ? '+' : ''}
                  {selectedCoin.price.priceChange24h.toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Total Value Preview */}
          {calculateTotalValue() > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span>Total Investment:</span>
                <span className="font-medium">${calculateTotalValue().toLocaleString()}</span>
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
              Add Holding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
