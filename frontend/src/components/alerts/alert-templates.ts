import { CreateAlertData } from '@/hooks/use-alerts';

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  category: 'price' | 'volume' | 'social' | 'whale' | 'risk';
  icon: string;
  template: Omit<CreateAlertData, 'coinId'>;
}

export const alertTemplates: AlertTemplate[] = [
  // Price Alerts
  {
    id: 'price_moon',
    name: 'Moon Alert 🚀',
    description: 'Get notified when price increases by 50% or more',
    category: 'price',
    icon: '🚀',
    template: {
      type: 'price_above',
      condition: {
        percentageChange: 50,
      },
      notificationMethods: ['email', 'push'],
      name: 'Moon Alert',
      description: 'Alert when price moons by 50%+',
    },
  },
  {
    id: 'price_crash',
    name: 'Crash Protection 🛡️',
    description: 'Get alerted when price drops by 30% or more',
    category: 'price',
    icon: '🛡️',
    template: {
      type: 'price_below',
      condition: {
        percentageChange: -30,
      },
      notificationMethods: ['email', 'push', 'sms'],
      name: 'Crash Protection',
      description: 'Alert when price crashes by 30%+',
    },
  },
  {
    id: 'price_target',
    name: 'Price Target 🎯',
    description: 'Set a specific price target to monitor',
    category: 'price',
    icon: '🎯',
    template: {
      type: 'price_above',
      condition: {
        targetPrice: 0, // Will be set by user
      },
      notificationMethods: ['email', 'push'],
      name: 'Price Target',
      description: 'Alert when price reaches target',
    },
  },
  {
    id: 'price_dip',
    name: 'Buy the Dip 📉',
    description: 'Get notified of 15% price drops for buying opportunities',
    category: 'price',
    icon: '📉',
    template: {
      type: 'price_below',
      condition: {
        percentageChange: -15,
      },
      notificationMethods: ['email', 'push'],
      name: 'Buy the Dip',
      description: 'Alert for 15% price drops',
    },
  },

  // Volume Alerts
  {
    id: 'volume_spike',
    name: 'Volume Explosion 💥',
    description: 'Detect unusual trading volume spikes',
    category: 'volume',
    icon: '💥',
    template: {
      type: 'volume_spike',
      condition: {
        volumeThreshold: 1000000, // $1M volume threshold
      },
      notificationMethods: ['email', 'push'],
      name: 'Volume Explosion',
      description: 'Alert for high volume activity',
    },
  },
  {
    id: 'volume_breakout',
    name: 'Breakout Volume 📈',
    description: 'Monitor for volume breakouts indicating momentum',
    category: 'volume',
    icon: '📈',
    template: {
      type: 'volume_spike',
      condition: {
        percentageChange: 200, // 200% volume increase
      },
      notificationMethods: ['email', 'push'],
      name: 'Breakout Volume',
      description: 'Alert for 200%+ volume increases',
    },
  },

  // Social Alerts
  {
    id: 'social_viral',
    name: 'Going Viral 🔥',
    description: 'Catch coins going viral on social media',
    category: 'social',
    icon: '🔥',
    template: {
      type: 'social_spike',
      condition: {
        socialThreshold: 80, // High social activity score
      },
      notificationMethods: ['email', 'push'],
      name: 'Going Viral',
      description: 'Alert for viral social activity',
    },
  },
  {
    id: 'social_buzz',
    name: 'Social Buzz 📱',
    description: 'Monitor moderate increases in social mentions',
    category: 'social',
    icon: '📱',
    template: {
      type: 'social_spike',
      condition: {
        socialThreshold: 60, // Moderate social activity
      },
      notificationMethods: ['email'],
      name: 'Social Buzz',
      description: 'Alert for increased social mentions',
    },
  },

  // Whale Alerts
  {
    id: 'whale_large',
    name: 'Whale Alert 🐋',
    description: 'Track large whale transactions ($100K+)',
    category: 'whale',
    icon: '🐋',
    template: {
      type: 'whale_movement',
      condition: {
        volumeThreshold: 100000, // $100K threshold
      },
      notificationMethods: ['email', 'push'],
      name: 'Whale Alert',
      description: 'Alert for large whale transactions',
    },
  },
  {
    id: 'whale_mega',
    name: 'Mega Whale 🦈',
    description: 'Monitor massive whale movements ($1M+)',
    category: 'whale',
    icon: '🦈',
    template: {
      type: 'whale_movement',
      condition: {
        volumeThreshold: 1000000, // $1M threshold
      },
      notificationMethods: ['email', 'push', 'sms'],
      name: 'Mega Whale',
      description: 'Alert for massive whale movements',
    },
  },
  {
    id: 'whale_small',
    name: 'Mini Whale 🐟',
    description: 'Track smaller but significant transactions ($10K+)',
    category: 'whale',
    icon: '🐟',
    template: {
      type: 'whale_movement',
      condition: {
        volumeThreshold: 10000, // $10K threshold
      },
      notificationMethods: ['email'],
      name: 'Mini Whale',
      description: 'Alert for significant transactions',
    },
  },
];

export const alertCategories = [
  { id: 'all', name: 'All Templates', icon: '📋' },
  { id: 'price', name: 'Price Alerts', icon: '💰' },
  { id: 'volume', name: 'Volume Alerts', icon: '📊' },
  { id: 'social', name: 'Social Alerts', icon: '📱' },
  { id: 'whale', name: 'Whale Alerts', icon: '🐋' },
] as const;

export function getTemplatesByCategory(category: string): AlertTemplate[] {
  if (category === 'all') {
    return alertTemplates;
  }
  return alertTemplates.filter(template => template.category === category);
}

export function getTemplateById(id: string): AlertTemplate | undefined {
  return alertTemplates.find(template => template.id === id);
}
