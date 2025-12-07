'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info, Loader2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeedItem {
  id: string;
  type: 'error' | 'success' | 'info' | 'loading';
  message: string;
  timestamp: string;
}

interface LiveFeedCardProps {
  items: FeedItem[];
  className?: string;
}

const iconMap = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
  loading: Loader2,
};

const colorMap = {
  error: 'text-red-500 dark:text-red-400',
  success: 'text-green-500 dark:text-green-400',
  info: 'text-blue-500 dark:text-blue-400',
  loading: 'text-muted-foreground',
};

export function LiveFeedCard({ items, className }: LiveFeedCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h3 className="text-lg font-heading font-semibold">Live Feed</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const Icon = iconMap[item.type];
              return (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors animate-slide-in-right"
                >
                  <div className="flex-shrink-0">
                    <div className={cn('rounded-full p-2 bg-secondary', colorMap[item.type])}>
                      <Icon
                        className={cn('h-4 w-4', item.type === 'loading' && 'animate-spin')}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm leading-tight">{item.message}</p>
                    <p className="text-xs text-muted-foreground font-data">{item.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
