'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Upload, X } from 'lucide-react';

import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PillButton } from '@/components/studio/pill-button';
import { TopicHeader, HubSkeleton, ComplianceNote } from '@/components/social';
import { PolicyDashboard } from '@/components/governance/PolicyDashboard';
import { usePolicies, Policy } from '@/hooks/data/usePolicies';
import { uploadPolicyDocument, PolicyAttachment } from '@/lib/governance/policies';

function AddPolicyDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    policy_name: '',
    policy_code: '',
    policy_type: '',
    description: '',
    scope: '',
    owner_name: '',
    owner_department: '',
    status: 'draft',
    effective_date: '',
    review_date: '',
    is_public: false,
    public_url: '',
    bcorp_requirement: '',
    csrd_requirement: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get the current session and organization
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get organization ID
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        throw new Error('No organization found');
      }

      // Upload attachments if any
      const uploadedAttachments: PolicyAttachment[] = [];
      if (attachments.length > 0) {
        for (const file of attachments) {
          try {
            const attachment = await uploadPolicyDocument(membership.organization_id, file);
            uploadedAttachments.push(attachment);
          } catch (error) {
            console.error('Error uploading attachment:', error);
            throw new Error(`Failed to upload ${file.name}`);
          }
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/governance/policies', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          attachments: uploadedAttachments,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create policy');
      }

      setOpen(false);
      setFormData({
        policy_name: '',
        policy_code: '',
        policy_type: '',
        description: '',
        scope: '',
        owner_name: '',
        owner_department: '',
        status: 'draft',
        effective_date: '',
        review_date: '',
        is_public: false,
        public_url: '',
        bcorp_requirement: '',
        csrd_requirement: '',
      });
      setAttachments([]);
      onSuccess();
    } catch (error) {
      console.error('Error creating policy:', error);
      alert(error instanceof Error ? error.message : 'Failed to create policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PillButton size="sm" onClick={() => setOpen(true)}>
        Add policy
      </PillButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Policy</DialogTitle>
            <DialogDescription>
              Create a new organizational policy
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="policy_name">Policy Name *</Label>
                  <Input
                    id="policy_name"
                    value={formData.policy_name}
                    onChange={(e) => setFormData({ ...formData, policy_name: e.target.value })}
                    placeholder="e.g., Code of Ethics"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy_code">Policy Code</Label>
                  <Input
                    id="policy_code"
                    value={formData.policy_code}
                    onChange={(e) => setFormData({ ...formData, policy_code: e.target.value })}
                    placeholder="e.g., POL-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="policy_type">Policy Type *</Label>
                  <Select
                    value={formData.policy_type}
                    onValueChange={(value) => setFormData({ ...formData, policy_type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethics">Ethics</SelectItem>
                      <SelectItem value="environmental">Environmental</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="governance">Governance</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the policy..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Input
                  id="scope"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  placeholder="e.g., All employees and contractors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_name">Policy Owner</Label>
                  <Input
                    id="owner_name"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    placeholder="e.g., Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_department">Department</Label>
                  <Input
                    id="owner_department"
                    value={formData.owner_department}
                    onChange={(e) => setFormData({ ...formData, owner_department: e.target.value })}
                    placeholder="e.g., Legal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effective_date">Effective Date</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review_date">Review Date</Label>
                  <Input
                    id="review_date"
                    type="date"
                    value={formData.review_date}
                    onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_public: checked as boolean })
                  }
                />
                <Label htmlFor="is_public" className="text-sm font-normal">
                  Publicly available
                </Label>
              </div>

              {formData.is_public && (
                <div className="space-y-2">
                  <Label htmlFor="public_url">Public URL</Label>
                  <Input
                    id="public_url"
                    type="url"
                    value={formData.public_url}
                    onChange={(e) => setFormData({ ...formData, public_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="attachments">Policy Documents</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV (max 50MB each)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Policy'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditPolicyDialog({
  policy,
  open,
  onOpenChange,
  onSuccess,
}: {
  policy: Policy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    policy_name: policy.policy_name,
    policy_code: policy.policy_code || '',
    policy_type: policy.policy_type,
    description: policy.description || '',
    scope: policy.scope || '',
    owner_name: policy.owner_name || '',
    owner_department: policy.owner_department || '',
    status: policy.status,
    effective_date: policy.effective_date || '',
    review_date: policy.review_date || '',
    is_public: policy.is_public,
    public_url: policy.public_url || '',
    bcorp_requirement: policy.bcorp_requirement || '',
    csrd_requirement: policy.csrd_requirement || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/governance/policies', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          id: policy.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update policy');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating policy:', error);
      alert(error instanceof Error ? error.message : 'Failed to update policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Policy</DialogTitle>
          <DialogDescription>
            Update policy details and status
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_policy_name">Policy Name *</Label>
                <Input
                  id="edit_policy_name"
                  value={formData.policy_name}
                  onChange={(e) => setFormData({ ...formData, policy_name: e.target.value })}
                  placeholder="e.g., Code of Ethics"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_policy_code">Policy Code</Label>
                <Input
                  id="edit_policy_code"
                  value={formData.policy_code}
                  onChange={(e) => setFormData({ ...formData, policy_code: e.target.value })}
                  placeholder="e.g., POL-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_policy_type">Policy Type *</Label>
                <Select
                  value={formData.policy_type}
                  onValueChange={(value) => setFormData({ ...formData, policy_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethics">Ethics</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="governance">Governance</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as Policy['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the policy..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_scope">Scope</Label>
              <Input
                id="edit_scope"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="e.g., All employees and contractors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_owner_name">Policy Owner</Label>
                <Input
                  id="edit_owner_name"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="e.g., Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_owner_department">Department</Label>
                <Input
                  id="edit_owner_department"
                  value={formData.owner_department}
                  onChange={(e) => setFormData({ ...formData, owner_department: e.target.value })}
                  placeholder="e.g., Legal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_effective_date">Effective Date</Label>
                <Input
                  id="edit_effective_date"
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_review_date">Review Date</Label>
                <Input
                  id="edit_review_date"
                  type="date"
                  value={formData.review_date}
                  onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit_is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_public: checked as boolean })
                }
              />
              <Label htmlFor="edit_is_public" className="text-sm font-normal">
                Publicly available
              </Label>
            </div>

            {formData.is_public && (
              <div className="space-y-2">
                <Label htmlFor="edit_public_url">Public URL</Label>
                <Input
                  id="edit_public_url"
                  type="url"
                  value={formData.public_url}
                  onChange={(e) => setFormData({ ...formData, public_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PoliciesPage() {
  return (
    <FeatureGate feature="governance_ethics">
      <PoliciesPageContent />
    </FeatureGate>
  );
}

function PoliciesPageContent() {
  const { policies, metrics, loading, refetch } = usePolicies();
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  if (loading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>OUR PEOPLE &middot; GOVERNANCE</>}
        headline={<>Policies.</>}
        description="Create, track, and publish organisational policies."
        backHref="/governance"
        backLabel="Governance"
      >
        <div className="flex items-center gap-2">
          <PillButton variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </PillButton>
          <AddPolicyDialog onSuccess={refetch} />
        </div>
      </TopicHeader>

      <ComplianceNote label="ABOUT POLICIES">
        Maintain comprehensive policies covering ethics, environmental, social, and governance
        topics. Regular policy reviews and public disclosure support B Corp certification and
        CSRD compliance.
      </ComplianceNote>

      <PolicyDashboard
        policies={policies}
        metrics={metrics}
        isLoading={loading}
        onEditPolicy={(policy) => setEditingPolicy(policy)}
      />

      {editingPolicy && (
        <EditPolicyDialog
          key={editingPolicy.id}
          policy={editingPolicy}
          open={!!editingPolicy}
          onOpenChange={(open) => { if (!open) setEditingPolicy(null); }}
          onSuccess={() => {
            setEditingPolicy(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
