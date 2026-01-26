'use client';

import { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  Send,
  Eye,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/hooks/use-toast';

interface ReviewWorkflowProps {
  reportId: string;
  reportName: string;
  sections: string[];
}

interface Review {
  id: string;
  reviewer_email: string;
  reviewer_role: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  comments: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ReviewComment {
  id: string;
  commenter_id: string;
  section_id: string | null;
  comment_text: string;
  is_resolved: boolean;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export function ReviewWorkflow({ reportId, reportName, sections }: ReviewWorkflowProps) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [showAddReviewerDialog, setShowAddReviewerDialog] = useState(false);
  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [newReviewerRole, setNewReviewerRole] = useState('');
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();

  useEffect(() => {
    loadReviewData();
  }, [reportId]);

  async function loadReviewData() {
    setLoading(true);

    try {
      // Load reviews
      const { data: reviewsData } = await supabase
        .from('report_reviews')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });

      setReviews(reviewsData || []);

      // Load comments
      const reviewIds = reviewsData?.map((r) => r.id) || [];
      if (reviewIds.length > 0) {
        const { data: commentsData } = await supabase
          .from('report_review_comments')
          .select(`
            *,
            profiles (
              full_name
            )
          `)
          .in('review_id', reviewIds)
          .order('created_at', { ascending: true });

        setComments(commentsData || []);
      }
    } catch (error) {
      console.error('Error loading review data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddReviewer() {
    if (!newReviewerEmail.trim() || !newReviewerRole.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter reviewer email and role',
        variant: 'destructive',
      });
      return;
    }

    setAddingReviewer(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newReviewerEmail)
        .single();

      if (!profile) {
        toast({
          title: 'Error',
          description: 'Reviewer not found. They must have an account first.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.from('report_reviews').insert({
        report_id: reportId,
        reviewer_id: profile.id,
        reviewer_email: newReviewerEmail,
        reviewer_role: newReviewerRole,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Reviewer Added',
        description: `${newReviewerEmail} has been invited to review this report.`,
      });

      setNewReviewerEmail('');
      setNewReviewerRole('');
      setShowAddReviewerDialog(false);
      loadReviewData();
    } catch (error) {
      console.error('Error adding reviewer:', error);
      toast({
        title: 'Failed to Add Reviewer',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setAddingReviewer(false);
    }
  }

  async function handleUpdateReviewStatus(
    reviewId: string,
    status: 'approved' | 'rejected' | 'changes_requested',
    comments?: string
  ) {
    try {
      const { error } = await supabase
        .from('report_reviews')
        .update({
          status,
          comments: comments || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: 'Review Updated',
        description: `Review status changed to ${status.replace('_', ' ')}.`,
      });

      loadReviewData();
    } catch (error) {
      console.error('Error updating review:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update review status',
        variant: 'destructive',
      });
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a comment',
        variant: 'destructive',
      });
      return;
    }

    setAddingComment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get a review ID (use first review or create one)
      let reviewId = reviews[0]?.id;
      if (!reviewId) {
        // Create an auto-review if none exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('id', user.id)
          .single();

        if (!profile) throw new Error('Profile not found');

        const { data: newReview, error: reviewError } = await supabase
          .from('report_reviews')
          .insert({
            report_id: reportId,
            reviewer_id: user.id,
            reviewer_email: profile.email,
            reviewer_role: 'Author',
            status: 'pending',
          })
          .select()
          .single();

        if (reviewError) throw reviewError;
        reviewId = newReview.id;
      }

      const { error } = await supabase.from('report_review_comments').insert({
        review_id: reviewId,
        commenter_id: user.id,
        section_id: selectedSection,
        comment_text: newComment,
        is_resolved: false,
      });

      if (error) throw error;

      toast({
        title: 'Comment Added',
        description: 'Your comment has been added to the review.',
      });

      setNewComment('');
      setSelectedSection(null);
      loadReviewData();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to Add Comment',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setAddingComment(false);
    }
  }

  async function handleResolveComment(commentId: string) {
    try {
      const { error } = await supabase
        .from('report_review_comments')
        .update({ is_resolved: true })
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: 'Comment Resolved',
        description: 'The comment has been marked as resolved.',
      });

      loadReviewData();
    } catch (error) {
      console.error('Error resolving comment:', error);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-600">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      case 'changes_requested':
        return (
          <Badge className="bg-yellow-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Changes Requested
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'changes_requested':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const pendingReviews = reviews.filter((r) => r.status === 'pending');
  const completedReviews = reviews.filter((r) => r.status !== 'pending');
  const unresolvedComments = comments.filter((c) => !c.is_resolved);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Status for &quot;{reportName}&quot;</CardTitle>
              <CardDescription>Collaborative review and approval workflow</CardDescription>
            </div>
            <Dialog open={showAddReviewerDialog} onOpenChange={setShowAddReviewerDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Reviewer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Reviewer</DialogTitle>
                  <DialogDescription>
                    Invite a team member to review this report before generation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="reviewer-email">Reviewer Email</Label>
                    <Input
                      id="reviewer-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={newReviewerEmail}
                      onChange={(e) => setNewReviewerEmail(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reviewer-role">Role/Title</Label>
                    <Input
                      id="reviewer-role"
                      placeholder="e.g., Sustainability Manager"
                      value={newReviewerRole}
                      onChange={(e) => setNewReviewerRole(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddReviewer}
                    disabled={addingReviewer}
                  >
                    {addingReviewer ? 'Adding...' : 'Add Reviewer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingReviews.length}</div>
              <div className="text-sm text-muted-foreground">Pending Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {completedReviews.filter((r) => r.status === 'approved').length}
              </div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{unresolvedComments.length}</div>
              <div className="text-sm text-muted-foreground">Unresolved Comments</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Reviews</h3>

        {reviews.length === 0 ? (
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              No reviews yet. Add reviewers to start the collaborative review process.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(review.status)}
                      <div>
                        <div className="font-semibold">{review.reviewer_email}</div>
                        <div className="text-sm text-muted-foreground">{review.reviewer_role}</div>
                      </div>
                    </div>
                    {getStatusBadge(review.status)}
                  </div>
                </CardHeader>
                {review.comments && (
                  <CardContent>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium mb-1">Review Comments:</div>
                      <div className="text-sm text-muted-foreground">{review.comments}</div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments & Feedback
          </CardTitle>
          <CardDescription>Add section-specific comments and discussion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Comment Form */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="section-select">Section (optional)</Label>
              <Select value={selectedSection || ''} onValueChange={setSelectedSection}>
                <SelectTrigger id="section-select" className="mt-2">
                  <SelectValue placeholder="General comment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General comment</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-comment">Your Comment</Label>
              <Textarea
                id="new-comment"
                placeholder="Add your feedback or questions..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
            <Button onClick={handleAddComment} disabled={addingComment} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {addingComment ? 'Adding Comment...' : 'Add Comment'}
            </Button>
          </div>

          {/* Comments List */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-4 border rounded-lg ${
                    comment.is_resolved ? 'bg-gray-50 opacity-60' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold">{comment.profiles.full_name}</div>
                      {comment.section_id && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {comment.section_id}
                        </Badge>
                      )}
                    </div>
                    {!comment.is_resolved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResolveComment(comment.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                  <p className="text-sm">{comment.comment_text}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(comment.created_at).toLocaleString()}
                    {comment.is_resolved && ' • Resolved'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No comments yet. Be the first to add feedback!</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
