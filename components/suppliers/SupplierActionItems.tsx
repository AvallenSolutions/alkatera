'use client';

import Link from 'next/link';
import {
  Building2,
  Package,
  BarChart3,
  Shield,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';

interface SupplierProfile {
  contact_name: string | null;
  address: string | null;
  phone: string | null;
}

interface SupplierActionItemsProps {
  supplier: SupplierProfile | null;
  productsCount: number;
  hasImpactData: boolean;
  hasEsgAssessment: boolean;
  pendingRequestsCount: number;
}

interface ActionItem {
  id: string;
  icon: typeof Building2;
  label: string;
  description: string;
  href: string;
  colour: string;
  bgColour: string;
}

export function SupplierActionItems({
  supplier,
  productsCount,
  hasImpactData,
  hasEsgAssessment,
  pendingRequestsCount,
}: SupplierActionItemsProps) {
  const items: ActionItem[] = [];

  // Profile completeness check
  if (supplier && (!supplier.contact_name || !supplier.address || !supplier.phone)) {
    items.push({
      id: 'complete-profile',
      icon: Building2,
      label: 'Complete your company profile',
      description: 'Add your contact details, address, and phone number so customers can reach you.',
      href: '/supplier-portal/profile',
      colour: 'text-emerald-400',
      bgColour: 'bg-emerald-500/10',
    });
  }

  // No products yet
  if (productsCount === 0) {
    items.push({
      id: 'add-product',
      icon: Package,
      label: 'Add your first product',
      description: 'List your products with environmental data so brands can include them in their assessments.',
      href: '/supplier-portal/products',
      colour: 'text-purple-400',
      bgColour: 'bg-purple-500/10',
    });
  }

  // Products exist but missing impact data
  if (productsCount > 0 && !hasImpactData) {
    items.push({
      id: 'add-impact-data',
      icon: BarChart3,
      label: 'Add impact data to your products',
      description: 'Provide climate, water, waste, and land impact figures to strengthen your sustainability credentials.',
      href: '/supplier-portal/products',
      colour: 'text-blue-400',
      bgColour: 'bg-blue-500/10',
    });
  }

  // No ESG assessment
  if (!hasEsgAssessment) {
    items.push({
      id: 'start-esg',
      icon: Shield,
      label: 'Start your ESG self-assessment',
      description: 'Complete a voluntary ESG questionnaire to demonstrate your sustainability practices to buyers.',
      href: '/supplier-portal/esg-assessment',
      colour: 'text-amber-400',
      bgColour: 'bg-amber-500/10',
    });
  }

  // Pending data requests
  if (pendingRequestsCount > 0) {
    items.push({
      id: 'respond-requests',
      icon: ClipboardList,
      label: 'Respond to pending data requests',
      description: `You have ${pendingRequestsCount} data request${pendingRequestsCount === 1 ? '' : 's'} awaiting your response.`,
      href: '/supplier-portal/requests',
      colour: 'text-red-400',
      bgColour: 'bg-red-500/10',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Action Items</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColour}`}>
                  <Icon className={`h-4 w-4 ${item.colour}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors flex-shrink-0 ml-3" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
