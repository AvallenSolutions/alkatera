'use client';

import { Package, ClipboardList } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'product_added' | 'data_request';
  title: string;
  subtitle?: string;
  date: string;
}

interface RecentProduct {
  id: string;
  name: string;
  created_at: string;
}

interface PendingRequest {
  id: string;
  material_name: string;
  organization_name?: string;
  invited_at: string;
}

interface SupplierActivityTimelineProps {
  recentProducts: RecentProduct[];
  recentRequests: PendingRequest[];
}

export function SupplierActivityTimeline({
  recentProducts,
  recentRequests,
}: SupplierActivityTimelineProps) {
  // Merge into a unified timeline
  const events: TimelineEvent[] = [
    ...recentProducts.map((p) => ({
      id: `product-${p.id}`,
      type: 'product_added' as const,
      title: p.name,
      subtitle: 'Product added',
      date: p.created_at,
    })),
    ...recentRequests.map((r) => ({
      id: `request-${r.id}`,
      type: 'data_request' as const,
      title: r.material_name,
      subtitle: r.organization_name ? `Data request from ${r.organization_name}` : 'Data request received',
      date: r.invited_at,
    })),
  ];

  // Sort by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Limit to most recent 8
  const displayed = events.slice(0, 8);

  if (displayed.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-0">
          {displayed.map((event, idx) => {
            const isProduct = event.type === 'product_added';
            const Icon = isProduct ? Package : ClipboardList;
            const iconColour = isProduct ? 'text-purple-400' : 'text-blue-400';
            const iconBg = isProduct ? 'bg-purple-500/10' : 'bg-blue-500/10';

            return (
              <div key={event.id} className="relative flex items-start gap-3 py-3 pl-0">
                {/* Dot/icon */}
                <div className={`relative z-10 p-1.5 rounded-lg ${iconBg}`}>
                  <Icon className={`h-4 w-4 ${iconColour}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                </div>

                {/* Date */}
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(event.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
