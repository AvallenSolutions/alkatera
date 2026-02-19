'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Package, Clock, CheckCircle2 } from 'lucide-react';

interface DataRequest {
  id: string;
  material_name: string;
  material_type: string;
  organization_name?: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

export default function SupplierRequestsPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use SECURITY DEFINER RPC to bypass RLS on supplier_invitations
      const { data: invitations, error } = await supabase
        .rpc('get_supplier_invitations');

      if (error) {
        console.error('Error loading requests:', error);
        setFetchError('Failed to load data requests');
      } else if (invitations) {
        setRequests(invitations.map((inv: any) => ({
          id: inv.id,
          material_name: inv.material_name,
          material_type: inv.material_type,
          organization_name: inv.organization_name,
          status: inv.status,
          invited_at: inv.invited_at,
          accepted_at: inv.accepted_at,
        })));
      }

      setLoading(false);
    }

    loadRequests();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-muted w-10 h-10" />
                <div className="space-y-2">
                  <div className="h-5 w-36 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
    pending: { label: 'Pending', variant: 'outline', icon: Clock },
    accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle2 },
    declined: { label: 'Declined', variant: 'destructive', icon: Clock },
    expired: { label: 'Expired', variant: 'secondary', icon: Clock },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Data Requests</h1>
        <p className="text-muted-foreground mt-1">
          View and manage data requests from your customers. Each request is for verified sustainability data about a specific material.
        </p>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {fetchError}
        </div>
      )}

      {requests.length === 0 && !fetchError ? (
        <div className="py-16 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Data Requests</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You don&apos;t have any data requests yet. When your customers invite you to share sustainability data, their requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = statusConfig[req.status] || statusConfig.pending;
            const StatusIcon = config.icon;

            return (
              <div
                key={req.id}
                className="flex items-center justify-between p-5 rounded-xl border border-border bg-card hover:border-border/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-blue-500/10">
                    <Package className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{req.material_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground capitalize">
                        {req.material_type}
                      </span>
                      {req.organization_name && (
                        <>
                          <span className="text-xs text-muted-foreground">&middot;</span>
                          <span className="text-xs text-muted-foreground">
                            Requested by {req.organization_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(req.invited_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <Badge variant={config.variant} className="flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
