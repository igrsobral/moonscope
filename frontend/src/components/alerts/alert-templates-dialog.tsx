'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { alertCategories, getTemplatesByCategory, AlertTemplate } from './alert-templates';
import { CreateAlertData } from '@/hooks/use-alerts';
import { Coin } from '@/types';

interface AlertTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coin?: Coin;
  onSelectTemplate: (template: CreateAlertData) => void;
}

export function AlertTemplatesDialog({
  open,
  onOpenChange,
  coin,
  onSelectTemplate,
}: AlertTemplatesDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredTemplates = getTemplatesByCategory(selectedCategory).filter(
    template =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTemplate = (template: AlertTemplate) => {
    if (!coin) return;

    const alertData: CreateAlertData = {
      ...template.template,
      coinId: coin.id,
    };

    // Customize template based on coin data
    if (template.id === 'price_target' && coin.price?.price) {
      // Set a reasonable price target (20% above current price)
      alertData.condition = {
        ...alertData.condition,
        targetPrice: coin.price.price * 1.2,
      };
    }

    onSelectTemplate(alertData);
    onOpenChange(false);
  };

  const getConditionSummary = (template: AlertTemplate) => {
    const condition = template.template.condition;
    const parts = [];

    if (condition.targetPrice) {
      parts.push(`Target: $${condition.targetPrice}`);
    }
    if (condition.percentageChange) {
      parts.push(`${condition.percentageChange > 0 ? '+' : ''}${condition.percentageChange}%`);
    }
    if (condition.volumeThreshold) {
      parts.push(`Volume: $${condition.volumeThreshold.toLocaleString()}`);
    }
    if (condition.socialThreshold) {
      parts.push(`Social: ${condition.socialThreshold}/100`);
    }

    return parts.join(' • ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Alert Templates</DialogTitle>
          <DialogDescription>
            Choose from pre-configured alert templates to get started quickly
            {coin && ` for ${coin.name} (${coin.symbol})`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Categories and Templates */}
          <Tabs
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            className="flex-1 overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-5">
              {alertCategories.map(category => (
                <TabsTrigger key={category.id} value={category.id} className="text-xs">
                  <span className="mr-1">{category.icon}</span>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {alertCategories.map(category => (
              <TabsContent
                key={category.id}
                value={category.id}
                className="mt-4 max-h-[60vh] overflow-y-auto"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTemplates.map(template => (
                    <Card
                      key={template.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{template.icon}</span>
                            <div>
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              <CardDescription className="text-sm">
                                {template.description}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {getConditionSummary(template)}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {template.template.notificationMethods.map(method => (
                              <Badge key={method} variant="secondary" className="text-xs">
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredTemplates.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? 'No templates match your search.'
                      : 'No templates in this category.'}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end space-x-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onSelectTemplate({
                  coinId: coin?.id || 0,
                  type: 'price_above',
                  condition: {},
                  notificationMethods: ['email'],
                });
                onOpenChange(false);
              }}
            >
              Create Custom Alert
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
