'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { ClipboardList, Building2, Package, ArrowRight, Leaf } from 'lucide-react';
import Link from 'next/link';

interface SupplierInfo {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
}

interface PendingRequest {
  id: string;
  material_name: string;
  material_type: string;
  organization_name?: string;
  invited_at: string;
}

export default function SupplierPortalDashboard() {
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load supplier record
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, contact_name')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (supplierError) {
        console.error('Error loading supplier:', supplierError);
        setFetchError('Failed to load supplier data');
      } else if (supplierData) {
        setSupplier(supplierData);

        // Load products count
        const { count, error: countError } = await supabase
          .from('supplier_products')
          .select('id', { count: 'exact', head: true })
          .eq('supplier_id', supplierData.id);

        if (!countError && count !== null) {
          setProductsCount(count);
        }
      }

      // Use SECURITY DEFINER RPC to bypass RLS on supplier_invitations
      const { data: invitations, error: invError } = await supabase
        .rpc('get_supplier_invitations', { p_status: 'accepted' });

      if (invError) {
        console.error('Error loading invitations:', invError);
      } else if (invitations) {
        setPendingRequests(invitations.map((inv: any) => ({
          id: inv.id,
          material_name: inv.material_name,
          material_type: inv.material_type,
          organization_name: inv.organization_name,
          invited_at: inv.invited_at,
        })));
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 rounded-xl border border-border bg-card">
              <div className="h-10 w-10 bg-muted rounded-lg mb-3" />
              <div className="h-8 w-12 bg-muted rounded mb-1" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {fetchError}
        </div>
      )}

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-serif text-foreground">
          Welcome{supplier?.contact_name ? `, ${supplier.contact_name}` : ''}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your sustainability data and respond to data requests from your customers.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/supplier-portal/requests"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
          <p className="text-sm text-muted-foreground">Data Requests</p>
        </Link>

        <Link
          href="/supplier-portal/profile"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <p className="text-2xl font-bold text-foreground">{supplier ? 1 : 0}</p>
          <p className="text-sm text-muted-foreground">Company Profile</p>
        </Link>

        <Link
          href="/supplier-portal/products"
          className="group p-5 rounded-xl border border-border bg-card hover:border-[#ccff00]/30 hover:bg-[#ccff00]/5 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#ccff00] transition-colors" />
          </div>
          <p className="text-2xl font-bold text-foreground">{productsCount}</p>
          <p className="text-sm text-muted-foreground">Products</p>
        </Link>
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Data Requests</h2>
          <div className="space-y-2">
            {pendingRequests.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{req.material_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.material_type !== 'general' && (
                        <span className="capitalize">{req.material_type}</span>
                      )}
                      {req.material_type !== 'general' && req.organization_name && ' \u00b7 '}
                      {req.organization_name}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(req.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting started */}
      <div className="p-6 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/5">
        <div className="flex items-start gap-3">
          <Leaf className="h-5 w-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground mb-1">Getting Started</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Complete your company profile to let your customers know more about your sustainability practices.
              Then, add your products with verified environmental data to respond to data requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
