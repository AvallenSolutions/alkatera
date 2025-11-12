import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {Icon && (
              <div className="rounded-full bg-muted p-3">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {actionLabel && actionHref && (
              <Button asChild>
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
