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
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'add-product',
    label: 'Add Product',
    description: 'Create a new product LCA',
    href: '/products/new',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  },
  {
    id: 'log-production',
    label: 'Log Production',
    description: 'Record production volumes',
    href: '/production',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  {
    id: 'record-emissions',
    label: 'Record Emissions',
    description: 'Add Scope 1 & 2 data',
    href: '/data/scope-1-2',
    icon: <Flame className="h-5 w-5" />,
    color: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  },
  {
    id: 'add-supplier',
    label: 'Add Supplier',
    description: 'Expand your supply chain',
    href: '/suppliers/new',
    icon: <Users className="h-5 w-5" />,
    color: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    description: 'Access sustainability reports',
    href: '/reports',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
  },
  {
    id: 'manage-facilities',
    label: 'Facilities',
    description: 'Manage your operations',
    href: '/company/facilities',
    icon: <Factory className="h-5 w-5" />,
    color: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  },
];

export function QuickActionsWidget() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-amber-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-transparent bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200"
            >
              <div
                className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
              >
                {action.icon}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {action.label}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
