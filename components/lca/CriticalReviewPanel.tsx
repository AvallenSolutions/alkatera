'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface CriticalReviewPanelProps {
  pcfId: string;
}

interface ReviewData {
  id: string;
  review_type: string;
  status: string;
  is_approved: boolean;
  reviewer_statement: string | null;
  review_start_date: string | null;
  review_end_date: string | null;
  reviewers: any[];
  comments: any[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800', icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: 'Under Review', color: 'bg-blue-100 text-blue-800', icon: <MessageSquare className="h-3 w-3" /> },
  revision_required: { label: 'Revision Required', color: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3 w-3" /> },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-800', icon: <Shield className="h-3 w-3" /> },
};

const REPORT_SECTIONS = [
  'Goal & Scope',
  'Life Cycle Inventory',
  'Impact Assessment',
  'Interpretation',
  'Methodology',
  'Data Quality',
  'Conclusions',
  'General',
];

export default function CriticalReviewPanel({ pcfId }: CriticalReviewPanelProps) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [showInitForm, setShowInitForm] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const { toast } = useToast();

  // Init form state
  const [reviewType, setReviewType] = useState<string>('internal');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [reviewerOrg, setReviewerOrg] = useState('');
  const [reviewerType, setReviewerType] = useState<string>('internal');

  // Comment form state
  const [commentSection, setCommentSection] = useState('General');
  const [commentText, setCommentText] = useState('');
  const [commentSeverity, setCommentSeverity] = useState<string>('minor');

  const fetchReview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lca/${pcfId}/review`);
      if (res.ok) {
        const data = await res.json();
        setReview(data);
      } else {
        setReview(null);
      }
    } catch {
      setReview(null);
    }
    setLoading(false);
  }, [pcfId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const handleInitiateReview = async () => {
    if (!reviewerName.trim()) {
      toast({ title: 'Error', description: 'Reviewer name is required', variant: 'destructive' });
      return;
    }

    setInitiating(true);
    try {
      const res = await fetch(`/api/lca/${pcfId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_type: reviewType,
          reviewers: [{
            name: reviewerName,
            email: reviewerEmail,
            organisation: reviewerOrg,
            reviewer_type: reviewerType,
            independence_declared: false,
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast({ title: 'Review Initiated', description: 'Critical review has been started.' });
      setShowInitForm(false);
      setReviewerName('');
      setReviewerEmail('');
      setReviewerOrg('');
      await fetchReview();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInitiating(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      const res = await fetch(`/api/lca/${pcfId}/review/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: commentSection,
          comment: commentText,
          severity: commentSeverity,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast({ title: 'Comment Added' });
      setCommentText('');
      setShowCommentForm(false);
      await fetchReview();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleResolveComment = async (commentId: string, status: string, response?: string) => {
    try {
      const res = await fetch(`/api/lca/${pcfId}/review/comment/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, response }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      await fetchReview();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/lca/${pcfId}/review/approve`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast({ title: 'Review Approved', description: 'The critical review has been approved.' });
      await fetchReview();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No review yet — show initiation
  if (!review) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground/40" />
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Critical Review</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              ISO 14044 Section 6 requires a critical review for LCAs intended for public
              comparative assertions. Start a review to assign reviewers and track comments.
            </p>
          </div>

          {!showInitForm ? (
            <Button onClick={() => setShowInitForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Initiate Review
            </Button>
          ) : (
            <div className="w-full max-w-md space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Review Type</Label>
                <Select value={reviewType} onValueChange={setReviewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Review</SelectItem>
                    <SelectItem value="external_expert">External Expert</SelectItem>
                    <SelectItem value="external_panel">External Panel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reviewer Name *</Label>
                <Input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Dr. Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={reviewerEmail} onChange={(e) => setReviewerEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Input value={reviewerOrg} onChange={(e) => setReviewerOrg(e.target.value)} placeholder="University of..." />
              </div>
              <div className="space-y-2">
                <Label>Reviewer Role</Label>
                <Select value={reviewerType} onValueChange={setReviewerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external_expert">External Expert</SelectItem>
                    <SelectItem value="panel_chair">Panel Chair</SelectItem>
                    <SelectItem value="panel_member">Panel Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleInitiateReview} disabled={initiating} className="flex-1">
                  {initiating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Start Review
                </Button>
                <Button variant="outline" onClick={() => setShowInitForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[review.status] || STATUS_CONFIG.pending;
  const openComments = review.comments?.filter((c: any) => c.status === 'open') || [];
  const resolvedComments = review.comments?.filter((c: any) => c.status !== 'open') || [];

  return (
    <div className="space-y-4">
      {/* Review Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Critical Review
          </h2>
          <p className="text-sm text-muted-foreground">ISO 14044 Section 6</p>
        </div>
        <Badge className={`${statusConfig.color} flex items-center gap-1`}>
          {statusConfig.icon} {statusConfig.label}
        </Badge>
      </div>

      {/* Review Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Review Type</p>
              <p className="font-medium capitalize">{review.review_type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="font-medium">
                {review.review_start_date ? new Date(review.review_start_date).toLocaleDateString() : 'Not started'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reviewers</p>
              <p className="font-medium">{review.reviewers?.length || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Comments</p>
              <p className="font-medium">{openComments.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviewers */}
      {review.reviewers && review.reviewers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Reviewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {review.reviewers.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.organisation ? `${r.organisation} • ` : ''}{r.reviewer_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Badge variant={r.independence_declared ? 'default' : 'outline'} className="text-xs">
                    {r.independence_declared ? 'Independence Declared' : 'Not Declared'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comments */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Review Comments ({(review.comments || []).length})
            </CardTitle>
            {!review.is_approved && (
              <Button variant="outline" size="sm" onClick={() => setShowCommentForm(!showCommentForm)} className="gap-1">
                <Plus className="h-3 w-3" /> Add Comment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Comment Form */}
          {showCommentForm && (
            <div className="p-3 rounded-lg border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Section</Label>
                  <Select value={commentSection} onValueChange={setCommentSection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_SECTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Severity</Label>
                  <Select value={commentSeverity} onValueChange={setCommentSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Enter review comment..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddComment}>Submit</Button>
                <Button size="sm" variant="outline" onClick={() => setShowCommentForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Open Comments */}
          {openComments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Open ({openComments.length})</p>
              {openComments.map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{c.section}</Badge>
                      <Badge variant={c.severity === 'critical' ? 'destructive' : c.severity === 'major' ? 'default' : 'secondary'} className="text-xs">
                        {c.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm mb-2">{c.comment}</p>
                  {c.reviewer?.name && (
                    <p className="text-xs text-muted-foreground mb-2">— {c.reviewer.name}</p>
                  )}
                  {!review.is_approved && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleResolveComment(c.id, 'addressed', 'Addressed as per review feedback')}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Address
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleResolveComment(c.id, 'rejected', 'Not applicable')}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Resolved Comments */}
          {resolvedComments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Resolved ({resolvedComments.length})</p>
              {resolvedComments.map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{c.section}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{c.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.comment}</p>
                  {c.response && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Response: {c.response}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {(review.comments || []).length === 0 && !showCommentForm && (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Reviewer Statement */}
      {review.reviewer_statement && (
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reviewer Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{review.reviewer_statement}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {review.status !== 'approved' && review.status !== 'published' && (
        <div className="flex gap-3">
          <Button onClick={handleApprove} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Approve Review
          </Button>
        </div>
      )}
    </div>
  );
}
