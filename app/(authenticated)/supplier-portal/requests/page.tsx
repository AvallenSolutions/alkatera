'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Button } from '@/components/ui/button';
import { Statement, StateChip } from '@/components/studio';
import type { WorkingTone } from '@/components/studio';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardList,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ClipboardCheck, ArrowRight } from 'lucide-react';

interface DataRequest {
  id: string;
  material_name: string;
  material_type: string;
  request_kind: string;
  organization_name?: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  request_status: string;
  request_responded_at: string | null;
  request_decline_reason: string | null;
  personal_message: string | null;
}

export default function SupplierRequestsPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state for decline with reason
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<DataRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function loadRequests() {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
        request_kind: inv.request_kind || 'data',
        organization_name: inv.organization_name,
        status: inv.status,
        invited_at: inv.invited_at,
        accepted_at: inv.accepted_at,
        request_status: inv.request_status || 'pending',
        request_responded_at: inv.request_responded_at,
        request_decline_reason: inv.request_decline_reason,
        personal_message: inv.personal_message,
      })));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const handleRespond = async (invitationId: string, action: 'accepted' | 'declined', reason?: string) => {
    setRespondingId(invitationId);
    try {
      const res = await fetch('/api/supplier-request/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          action,
          declineReason: reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to respond');
      }

      // Update local state
      setRequests(prev =>
        prev.map(r =>
          r.id === invitationId
            ? {
                ...r,
                request_status: action,
                request_responded_at: new Date().toISOString(),
                request_decline_reason: reason || null,
              }
            : r
        )
      );

      toast.success(
        action === 'accepted'
          ? 'Request accepted. You can now provide your data.'
          : 'Request declined.'
      );
    } catch (err: any) {
      console.error('Error responding to request:', err);
      toast.error(err.message || 'Failed to respond to request');
    } finally {
      setRespondingId(null);
      setDeclineDialogOpen(false);
      setDeclineTarget(null);
      setDeclineReason('');
    }
  };

  const handleDeclineClick = (req: DataRequest) => {
    setDeclineTarget(req);
    setDeclineReason('');
    setDeclineDialogOpen(true);
  };

  const requestStatusConfig: Record<string, {
    label: string;
    tone: WorkingTone;
    icon: typeof CheckCircle2;
  }> = {
    pending: { label: 'Awaiting Response', tone: 'attention', icon: Clock },
    accepted: { label: 'Accepted', tone: 'good', icon: CheckCircle2 },
    declined: { label: 'Declined', tone: 'stale', icon: XCircle },
    completed: { label: 'Completed', tone: 'quiet', icon: CheckCircle2 },
  };

  // Split requests into categories. ESG survey requests are handled separately.
  const esgSurveys = requests.filter(r => r.request_kind === 'esg_assessment');
  const isData = (r: DataRequest) => r.request_kind !== 'esg_assessment';
  const pendingRequests = requests.filter(r => isData(r) && r.request_status === 'pending' && r.status === 'accepted' && r.material_type !== 'general');
  const acceptedRequests = requests.filter(r => isData(r) && r.request_status === 'accepted' && r.material_type !== 'general');
  const declinedRequests = requests.filter(r => isData(r) && r.request_status === 'declined');
  const generalInvitations = requests.filter(r => isData(r) && r.material_type === 'general');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-5 rounded-[6px] border border-border bg-card">
              <div className="space-y-2">
                <div className="h-5 w-36 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Statement eyebrow="SUPPLIER PORTAL · REQUESTS" headline="Data requests." />
        <p className="text-muted-foreground mt-3 text-sm">
          Manage requests from your customers to share sustainability data on alka<span className="font-bold">tera</span>.
        </p>
      </div>

      {fetchError && (
        <div className="p-4 rounded-[6px] border border-studio-stale/40 bg-card text-studio-stale text-sm">
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
        <>
          {/* ESG survey requests */}
          {esgSurveys.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-forest">
                Sustainability surveys · {esgSurveys.length}
              </h2>

              {esgSurveys.map((req) => (
                <Link
                  key={req.id}
                  href="/supplier-portal/esg-assessment"
                  className="block rounded-[6px] border border-border bg-card p-5 transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="p-2.5 rounded-[6px] flex-shrink-0 bg-secondary">
                        <ClipboardCheck className="h-5 w-5 text-studio-forest" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">ESG Self-Assessment</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {req.organization_name && (
                            <span className="text-xs text-muted-foreground">
                              Requested by {req.organization_name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">&middot;</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(req.invited_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {req.personal_message && (
                          <div className="mt-2 flex items-start gap-2 p-2 rounded-[6px] bg-secondary border border-border">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {req.personal_message}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-sm font-medium text-studio-forest">
                      Complete survey
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pending requests - needs action */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-attention">
                Awaiting your response · {pendingRequests.length}
              </h2>

              {pendingRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  statusConfig={requestStatusConfig}
                  respondingId={respondingId}
                  onAccept={() => handleRespond(req.id, 'accepted')}
                  onDecline={() => handleDeclineClick(req)}
                />
              ))}
            </div>
          )}

          {/* Accepted requests */}
          {acceptedRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-good">
                Accepted · {acceptedRequests.length}
              </h2>

              {acceptedRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  statusConfig={requestStatusConfig}
                />
              ))}
            </div>
          )}

          {/* Declined requests */}
          {declinedRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-stale">
                Declined · {declinedRequests.length}
              </h2>

              {declinedRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  statusConfig={requestStatusConfig}
                />
              ))}
            </div>
          )}

          {/* General invitations (no specific material) */}
          {generalInvitations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
                General invitations · {generalInvitations.length}
              </h2>

              {generalInvitations.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  statusConfig={requestStatusConfig}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Decline dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Request</DialogTitle>
            <DialogDescription>
              {declineTarget && (
                <>
                  Are you sure you want to decline the request for{' '}
                  <strong>{declineTarget.material_name}</strong> from{' '}
                  <strong>{declineTarget.organization_name}</strong>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Reason (optional)
            </label>
            <Textarea
              placeholder="e.g. We no longer supply this product, or we're unable to share this data at this time."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              This will be shared with the requesting organisation.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={respondingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (declineTarget) {
                  handleRespond(declineTarget.id, 'declined', declineReason || undefined);
                }
              }}
              disabled={respondingId !== null}
            >
              {respondingId === declineTarget?.id ? 'Declining...' : 'Decline Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Request Card Component ----

interface RequestCardProps {
  request: DataRequest;
  statusConfig: Record<string, {
    label: string;
    tone: WorkingTone;
    icon: typeof CheckCircle2;
  }>;
  respondingId?: string | null;
  onAccept?: () => void;
  onDecline?: () => void;
}

function RequestCard({ request, statusConfig, respondingId, onAccept, onDecline }: RequestCardProps) {
  const config = statusConfig[request.request_status] || statusConfig.pending;
  const isPending = request.request_status === 'pending' && request.status === 'accepted';
  const isResponding = respondingId === request.id;

  return (
    <div
      className={`rounded-[6px] border bg-card p-5 transition-colors ${
        isPending ? 'border-studio-attention/40' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-2.5 rounded-[6px] flex-shrink-0 bg-secondary">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{request.material_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {request.material_type !== 'general' && (
                <span className="text-xs text-muted-foreground capitalize">
                  {request.material_type}
                </span>
              )}
              {request.organization_name && (
                <>
                  <span className="text-xs text-muted-foreground">&middot;</span>
                  <span className="text-xs text-muted-foreground">
                    From {request.organization_name}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">&middot;</span>
              <span className="text-xs text-muted-foreground">
                {new Date(request.invited_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            {/* Personal message from the requesting org */}
            {request.personal_message && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded-[6px] bg-secondary border border-border">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {request.personal_message}
                </p>
              </div>
            )}

            {/* Decline reason (shown on declined requests) */}
            {request.request_status === 'declined' && request.request_decline_reason && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded-[6px] bg-card border border-studio-stale/30">
                <XCircle className="h-3.5 w-3.5 text-studio-stale flex-shrink-0 mt-0.5" />
                <p className="text-xs text-studio-stale leading-relaxed">
                  {request.request_decline_reason}
                </p>
              </div>
            )}

            {/* Response date */}
            {request.request_responded_at && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Responded {new Date(request.request_responded_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && onAccept && onDecline ? (
            /* Action buttons for pending requests */
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onDecline}
                disabled={isResponding}
                className="text-studio-stale hover:text-studio-stale"
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                Decline
              </Button>
              <Button
                size="sm"
                onClick={onAccept}
                disabled={isResponding}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isResponding ? (
                  'Accepting...'
                ) : (
                  <>
                    <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Typographic state for responded requests */
            <StateChip tone={config.tone}>{config.label}</StateChip>
          )}
        </div>
      </div>
    </div>
  );
}
