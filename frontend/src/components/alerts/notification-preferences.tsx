'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Mail, Smartphone, MessageSquare, Bell, Settings, Save, Loader2 } from 'lucide-react';
import type { NotificationPreferences as NotificationPreferencesType } from '@/types';
import { toast } from '@/components/ui/use-toast';

const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
  priceAlerts: z.boolean(),
  whaleMovements: z.boolean(),
  socialSpikes: z.boolean(),
  emailAddress: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
  }),
  alertFrequency: z.enum(['immediate', 'batched_5min', 'batched_15min', 'batched_1hour']),
});

type NotificationPreferencesForm = z.infer<typeof notificationPreferencesSchema>;

interface NotificationPreferencesProps {
  preferences?: NotificationPreferencesType & {
    emailAddress?: string;
    phoneNumber?: string;
    quietHours?: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    alertFrequency?: 'immediate' | 'batched_5min' | 'batched_15min' | 'batched_1hour';
  };
  onSave?: (preferences: NotificationPreferencesForm) => Promise<void>;
  className?: string;
}

export function NotificationPreferences({
  preferences,
  onSave,
  className,
}: NotificationPreferencesProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<NotificationPreferencesForm>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      email: preferences?.email ?? true,
      push: preferences?.push ?? true,
      sms: preferences?.sms ?? false,
      priceAlerts: preferences?.priceAlerts ?? true,
      whaleMovements: preferences?.whaleMovements ?? true,
      socialSpikes: preferences?.socialSpikes ?? false,
      emailAddress: preferences?.emailAddress ?? '',
      phoneNumber: preferences?.phoneNumber ?? '',
      quietHours: {
        enabled: preferences?.quietHours?.enabled ?? false,
        startTime: preferences?.quietHours?.startTime ?? '22:00',
        endTime: preferences?.quietHours?.endTime ?? '08:00',
      },
      alertFrequency: preferences?.alertFrequency ?? 'immediate',
    },
  });

  const handleSubmit = async (data: NotificationPreferencesForm) => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(data);
      toast({
        title: 'Preferences Saved',
        description: 'Your notification preferences have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error Saving Preferences',
        description: 'Failed to save notification preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const watchedEmail = form.watch('email');
  const watchedPush = form.watch('push');
  const watchedSms = form.watch('sms');
  const watchedQuietHours = form.watch('quietHours.enabled');

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className={className}>
      <div className="space-y-6">
        {/* Notification Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Notification Channels</span>
            </CardTitle>
            <CardDescription>Configure how you want to receive alert notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Notifications */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="email">Email Notifications</Label>
                    <Badge variant="outline">Free</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts via email with detailed information
                  </p>
                  {watchedEmail && (
                    <div className="mt-2">
                      <Input
                        placeholder="your-email@example.com"
                        {...form.register('emailAddress')}
                      />
                      {form.formState.errors.emailAddress && (
                        <p className="mt-1 text-sm text-destructive">
                          {form.formState.errors.emailAddress.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Switch
                id="email"
                checked={watchedEmail}
                onCheckedChange={checked => form.setValue('email', checked)}
              />
            </div>

            <Separator />

            {/* Push Notifications */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Smartphone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="push">Push Notifications</Label>
                    <Badge variant="outline">Free</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Instant browser notifications for immediate alerts
                  </p>
                </div>
              </div>
              <Switch
                id="push"
                checked={watchedPush}
                onCheckedChange={checked => form.setValue('push', checked)}
              />
            </div>

            <Separator />

            {/* SMS Notifications */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <MessageSquare className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="sms">SMS Notifications</Label>
                    <Badge variant="secondary">Premium</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Text message alerts for critical notifications
                  </p>
                  {watchedSms && (
                    <div className="mt-2">
                      <Input placeholder="+1 (555) 123-4567" {...form.register('phoneNumber')} />
                    </div>
                  )}
                </div>
              </div>
              <Switch
                id="sms"
                checked={watchedSms}
                onCheckedChange={checked => form.setValue('sms', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alert Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Alert Types</span>
            </CardTitle>
            <CardDescription>Choose which types of alerts you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="priceAlerts">Price Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Price target and percentage change notifications
                </p>
              </div>
              <Switch
                id="priceAlerts"
                checked={form.watch('priceAlerts')}
                onCheckedChange={checked => form.setValue('priceAlerts', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="whaleMovements">Whale Movements</Label>
                <p className="text-sm text-muted-foreground">
                  Large transaction and whale activity alerts
                </p>
              </div>
              <Switch
                id="whaleMovements"
                checked={form.watch('whaleMovements')}
                onCheckedChange={checked => form.setValue('whaleMovements', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="socialSpikes">Social Spikes</Label>
                <p className="text-sm text-muted-foreground">
                  Social media activity and sentiment changes
                </p>
              </div>
              <Switch
                id="socialSpikes"
                checked={form.watch('socialSpikes')}
                onCheckedChange={checked => form.setValue('socialSpikes', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>Fine-tune your notification experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alert Frequency */}
            <div>
              <Label htmlFor="alertFrequency">Alert Frequency</Label>
              <select
                {...form.register('alertFrequency')}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="immediate">Immediate</option>
                <option value="batched_5min">Batched (5 minutes)</option>
                <option value="batched_15min">Batched (15 minutes)</option>
                <option value="batched_1hour">Batched (1 hour)</option>
              </select>
              <p className="mt-1 text-sm text-muted-foreground">
                How often to send notifications when multiple alerts trigger
              </p>
            </div>

            <Separator />

            {/* Quiet Hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="quietHours">Quiet Hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Suppress non-critical notifications during specified hours
                  </p>
                </div>
                <Switch
                  id="quietHours"
                  checked={watchedQuietHours}
                  onCheckedChange={checked => form.setValue('quietHours.enabled', checked)}
                />
              </div>

              {watchedQuietHours && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input id="startTime" type="time" {...form.register('quietHours.startTime')} />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input id="endTime" type="time" {...form.register('quietHours.endTime')} />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </Button>
        </div>
      </div>
    </form>
  );
}
