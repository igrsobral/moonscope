'use client';

import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState, CardSkeleton, EmptyState } from '@/components/ui';
import { useToast } from '@/components/ui/use-toast';
import { Coins, Plus, Settings } from 'lucide-react';

export default function LayoutDemoPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Layout Demo"
          description="Demonstration of the core UI components and layout system"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Demo', href: '/demo' },
            { label: 'Layout Demo' },
          ]}
          actions={
            <>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </>
          }
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Loading State Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Loading States</CardTitle>
              <CardDescription>Various loading state components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LoadingState message="Loading data..." size="sm" />
            </CardContent>
          </Card>

          {/* Skeleton Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Skeleton Loading</CardTitle>
              <CardDescription>Skeleton placeholders for content</CardDescription>
            </CardHeader>
            <CardContent>
              <CardSkeleton />
            </CardContent>
          </Card>

          {/* Empty State Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Empty State</CardTitle>
              <CardDescription>Empty state with action</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Coins}
                title="No coins found"
                description="Start by adding some coins to track"
                action={{
                  label: 'Add Coin',
                  onClick: () => console.log('Add coin clicked'),
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Toast Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Toast Notifications</CardTitle>
            <CardDescription>Test different types of toast notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <ToastDemo />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function ToastDemo() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Success!',
            description: 'Your action was completed successfully.',
            variant: 'success',
          })
        }
      >
        Success Toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Warning',
            description: 'Please check your input and try again.',
            variant: 'warning',
          })
        }
      >
        Warning Toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Error',
            description: 'Something went wrong. Please try again.',
            variant: 'destructive',
          })
        }
      >
        Error Toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Info',
            description: 'This is an informational message.',
          })
        }
      >
        Info Toast
      </Button>
    </div>
  );
}
