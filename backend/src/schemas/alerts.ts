import { z } from 'zod';

export const AlertQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'lastTriggered', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  coinId: z.number().positive().optional(),
  type: z.enum(['price_above', 'price_below', 'volume_spike', 'whale_movement', 'social_spike']).optional(),
  isActive: z.boolean().optional(),
});

export const CreateAlertSchema = z.object({
  coinId: z.number().positive(),
  type: z.enum(['price_above', 'price_below', 'volume_spike', 'whale_movement', 'social_spike']),
  condition: z.object({
    targetPrice: z.number().positive().optional(),
    percentageChange: z.number().min(-100).max(1000).optional(),
    volumeThreshold: z.number().positive().optional(),
    socialThreshold: z.number().min(0).max(100).optional(),
  }).refine((data) => {
    // Ensure at least one condition is provided based on alert type
    const { targetPrice, percentageChange, volumeThreshold, socialThreshold } = data;
    return targetPrice !== undefined || percentageChange !== undefined || 
           volumeThreshold !== undefined || socialThreshold !== undefined;
  }, {
    message: "At least one condition must be specified"
  }),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const UpdateAlertSchema = z.object({
  condition: z.object({
    targetPrice: z.number().positive().optional(),
    percentageChange: z.number().min(-100).max(1000).optional(),
    volumeThreshold: z.number().positive().optional(),
    socialThreshold: z.number().min(0).max(100).optional(),
  }).optional(),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).min(1).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const AlertActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'test']),
});

export const NotificationDeliverySchema = z.object({
  alertId: z.number().positive(),
  method: z.enum(['email', 'push', 'sms']),
  recipient: z.string().min(1),
  subject: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const NotificationStatusSchema = z.object({
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'retrying']),
  error: z.string().optional(),
  retryCount: z.number().min(0).default(0),
});

export type AlertQuery = z.infer<typeof AlertQuerySchema>;
export type CreateAlert = z.infer<typeof CreateAlertSchema>;
export type UpdateAlert = z.infer<typeof UpdateAlertSchema>;
export type AlertAction = z.infer<typeof AlertActionSchema>;
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;