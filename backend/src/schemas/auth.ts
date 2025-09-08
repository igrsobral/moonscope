import { z } from 'zod';

// Registration schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address')
    .optional(),
  preferences: z
    .object({
      notifications: z
        .object({
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          sms: z.boolean().optional(),
          priceAlerts: z.boolean().optional(),
          whaleMovements: z.boolean().optional(),
          socialSpikes: z.boolean().optional(),
        })
        .optional(),
      defaultCurrency: z.string().optional(),
      theme: z.enum(['light', 'dark']).optional(),
      riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Update preferences schema
export const updatePreferencesSchema = z.object({
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      sms: z.boolean().optional(),
      priceAlerts: z.boolean().optional(),
      whaleMovements: z.boolean().optional(),
      socialSpikes: z.boolean().optional(),
    })
    .optional(),
  defaultCurrency: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
});

// Link wallet schema
export const linkWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'),
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

// Type exports
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;
export type LinkWalletRequest = z.infer<typeof linkWalletSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
