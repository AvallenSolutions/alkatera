"use client";

import { useEffect } from 'react';
import { Leaf } from 'lucide-react';
import PassportSeedView from './PassportSeedView';
import PassportBlossomView from './PassportBlossomView';
import PassportCanopyView from './PassportCanopyView';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

interface PassportViewProps {
  data: {
    product: any;
    lca: any;
    materials: any[];
  };
  token: string;
}

export default function PassportView({ data, token }: PassportViewProps) {
  const { product, lca, materials } = data;
  // Supabase returns joined data as an array, get the first element
  const organization = Array.isArray(product.organization) ? product.organization[0] : product.organization;
  const tier = organization?.subscription_tier || 'seed';
  const subscriptionStatus = organization?.subscription_status || 'active';

  useEffect(() => {
    const recordView = async () => {
      const supabase = getSupabaseBrowserClient();

      try {
        await supabase.rpc('record_passport_view', {
          p_token: token,
          p_user_agent: navigator.userAgent,
          p_referer: document.referrer || null,
        });
      } catch (error) {
        console.error('Failed to record passport view:', error);
      }
    };

    recordView();
  }, [token]);

  const isSubscriptionActive = ['active', 'trial', 'trialing'].includes(subscriptionStatus);

  const effectiveTier = isSubscriptionActive ? tier : 'seed';

  const commonProps = {
    product,
    lca,
    materials,
    organization,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-green-50/30 to-neutral-50">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Leaf className="h-6 w-6 text-green-600" />
          <span className="text-sm font-medium text-neutral-600">Product Passport</span>
        </div>

        {effectiveTier === 'seed' && <PassportSeedView {...commonProps} />}
        {effectiveTier === 'blossom' && <PassportBlossomView {...commonProps} />}
        {effectiveTier === 'canopy' && <PassportCanopyView {...commonProps} />}

        <footer className="mt-16 text-center text-sm text-neutral-500">
          <p>Environmental data provided by {organization?.name || 'Organization'}</p>
          <p className="mt-2">
            Powered by <span className="font-semibold text-neutral-700">Alkatera</span> Product Passport
          </p>
        </footer>
      </div>
    </div>
  );
}
