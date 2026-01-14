'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GraduationCap,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import { TrainingDashboard } from '@/components/people-culture/TrainingDashboard';
import { useTrainingMetrics } from '@/hooks/data/useTrainingMetrics';

function AddTrainingDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    training_name: '',
    training_type: '',
    description: '',
    provider_type: '',
    provider_name: '',
    delivery_method: '',
    hours_per_participant: '',
    participants: '',
    completion_date: '',
    certification_awarded: false,
    certification_name: '',
    satisfaction_score: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/people-culture/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          hours_per_participant: parseFloat(formData.hours_per_participant) || 0,
          participants: parseInt(formData.participants) || 0,
          satisfaction_score: formData.satisfaction_score ? parseFloat(formData.satisfaction_score) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add training record');
      }

      setOpen(false);
      setFormData({
        training_name: '',
        training_type: '',
        description: '',
        provider_type: '',
        provider_name: '',
        delivery_method: '',
        hours_per_participant: '',
        participants: '',
        completion_date: '',
        certification_awarded: false,
        certification_name: '',
        satisfaction_score: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding training:', error);
      alert(error instanceof Error ? error.message : 'Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Log Training
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Training Activity</DialogTitle>
          <DialogDescription>
            Record training and development activities
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="training_name">Training Name *</Label>
              <Input
                id="training_name"
                value={formData.training_name}
                onChange={(e) => setFormData({ ...formData, training_name: e.target.value })}
                placeholder="e.g., Leadership Development Programme"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="training_type">Training Type *</Label>
                <Select
                  value={formData.training_type}
                  onValueChange={(value) => setFormData({ ...formData, training_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mandatory">Mandatory</SelectItem>
                    <SelectItem value="professional_development">Professional Development</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="dei">DEI</SelectItem>
                    <SelectItem value="health_safety">Health & Safety</SelectItem>
                    <SelectItem value="sustainability">Sustainability</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_method">Delivery Method</Label>
                <Select
                  value={formData.delivery_method}
                  onValueChange={(value) => setFormData({ ...formData, delivery_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="self_paced">Self-Paced</SelectItem>
                    <SelectItem value="blended">Blended</SelectItem>
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
                placeholder="Brief description of the training..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider_type">Provider Type</Label>
                <Select
                  value={formData.provider_type}
                  onValueChange={(value) => setFormData({ ...formData, provider_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                    <SelectItem value="online">Online Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider_name">Provider Name</Label>
                <Input
                  id="provider_name"
                  value={formData.provider_name}
                  onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  placeholder="e.g., Coursera"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours_per_participant">Hours/Person *</Label>
                <Input
                  id="hours_per_participant"
                  type="number"
                  step="0.5"
                  value={formData.hours_per_participant}
                  onChange={(e) => setFormData({ ...formData, hours_per_participant: e.target.value })}
                  placeholder="e.g., 8"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participants">Participants</Label>
                <Input
                  id="participants"
                  type="number"
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                  placeholder="e.g., 25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completion_date">Completion Date</Label>
                <Input
                  id="completion_date"
                  type="date"
                  value={formData.completion_date}
                  onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="satisfaction_score">Satisfaction Score (1-5)</Label>
              <Input
                id="satisfaction_score"
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={formData.satisfaction_score}
                onChange={(e) => setFormData({ ...formData, satisfaction_score: e.target.value })}
                placeholder="e.g., 4.5"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="certification_awarded"
                checked={formData.certification_awarded}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, certification_awarded: checked as boolean })
                }
              />
              <Label htmlFor="certification_awarded" className="text-sm font-normal">
                Certification Awarded
              </Label>
            </div>

            {formData.certification_awarded && (
              <div className="space-y-2">
                <Label htmlFor="certification_name">Certification Name</Label>
                <Input
                  id="certification_name"
                  value={formData.certification_name}
                  onChange={(e) => setFormData({ ...formData, certification_name: e.target.value })}
                  placeholder="e.g., Google Analytics Certified"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Log Training'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TrainingPage() {
  const { metrics, loading, refetch } = useTrainingMetrics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/people-culture">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-amber-600" />
              Training & Development
            </h1>
            <p className="text-muted-foreground mt-1">
              Learning hours, skills development, and certifications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <AddTrainingDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>About Training:</strong> Track learning and development activities to demonstrate
            investment in employee growth. B Corp recommends 20+ hours per employee annually for
            professional development.
          </p>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <TrainingDashboard metrics={metrics} isLoading={loading} />
    </div>
  );
}
