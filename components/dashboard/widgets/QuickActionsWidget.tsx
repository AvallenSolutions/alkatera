'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Package,
  ClipboardList,
  FileText,
  Users,
  Factory,
  Zap,
  Plus,
  BarChart3,
  Flame,
  ArrowRight,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  emoji: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'add-product',
    label: 'Add Product',
    description: 'Create new product LCA',
    href: '/products/new',
    emoji: '📦',
  },
  {
    id: 'log-production',
    label: 'Log Production',
    description: 'Record production volumes',
    href: '/production',
    emoji: '📊',
  },
  {
    id: 'record-emissions',
    label: 'Record Emissions',
    description: 'Add Scope 1 & 2 data',
    href: '/data/scope-1-2',
    emoji: '🔥',
  },
  {
    id: 'add-supplier',
    label: 'Add Supplier',
    description: 'Expand your supply chain',
    href: '/suppliers/new',
    emoji: '🤝',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    description: 'Access sustainability reports',
    href: '/reports',
    emoji: '📈',
  },
  {
    id: 'manage-facilities',
    label: 'Facilities',
    description: 'Manage your operations',
    href: '/company/facilities',
    emoji: '🏭',
  },
];

export function QuickActionsWidget() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-amber-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
          >
            <span className="text-2xl">{action.emoji}</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
