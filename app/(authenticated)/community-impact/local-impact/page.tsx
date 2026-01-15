'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, PlusCircle, TrendingUp, Users, Building2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import Link from 'next/link';
import { toast } from 'sonner';

interface LocalImpactData {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  reporting_period: string;
  description: string | null;
}

export default function LocalImpactPage() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<LocalImpactData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    metric_name: '',
    metric_value: '',
    metric_unit: '',
    reporting_period: '',
    description: '',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData();
    }
  }, [currentOrganization?.id]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/community-impact/local-impact?organization_id=${currentOrganization?.id}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching local impact data:', error);
      toast.error('Failed to load local impact data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/community-impact/local-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organization_id: currentOrganization.id,
          metric_value: parseFloat(formData.metric_value),
        }),
      });

      if (!response.ok) throw new Error('Failed to add local impact data');

      toast.success('Local impact data added successfully');
      setOpen(false);
      setFormData({
        metric_name: '',
        metric_value: '',
        metric_unit: '',
        reporting_period: '',
        description: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error adding local impact data:', error);
      toast.error('Failed to add local impact data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/community-impact" className="text-muted-foreground hover:text-foreground">
              Community & Impact
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Local Impact</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <MapPin className="h-6 w-6 text-emerald-600" />
            Local Economic Impact
          </h1>
          <p className="text-muted-foreground mt-1">
            Track local employment, sourcing, and community investment
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Local Impact Data</DialogTitle>
              <DialogDescription>Record local economic impact metrics</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Metric Name *</Label>
                  <Input
                    value={formData.metric_name}
                    onChange={(e) => setFormData({ ...formData, metric_name: e.target.value })}
                    placeholder="e.g., Local Employment Rate"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Value *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.metric_value}
                      onChange={(e) => setFormData({ ...formData, metric_value: e.target.value })}
                      placeholder="e.g., 85"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit *</Label>
                    <Input
                      value={formData.metric_unit}
                      onChange={(e) => setFormData({ ...formData, metric_unit: e.target.value })}
                      placeholder="e.g., %"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reporting Period *</Label>
                  <Input
                    value={formData.reporting_period}
                    onChange={(e) => setFormData({ ...formData, reporting_period: e.target.value })}
                    placeholder="e.g., 2024"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Add Data'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Employment</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Sourcing</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Community Investment</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Local Impact Metrics</CardTitle>
          <CardDescription>Track your local economic contribution</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading data...</p>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No local impact data logged yet. Click "Add Data" to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {data.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <p className="font-medium">{item.metric_name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Period: {item.reporting_period}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">
                      {item.metric_value}
                      <span className="text-sm ml-1">{item.metric_unit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
