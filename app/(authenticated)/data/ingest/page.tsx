'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';
import { PillButton } from '@/components/studio/pill-button';
import { supabase } from '@/lib/supabaseClient';

const activityDataSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['Scope 1', 'Scope 2', 'Scope 3'], {
    required_error: 'Category is required',
  }),
  quantity: z.string().min(1, 'Quantity is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Quantity must be a positive number'
  ),
  unit: z.string().min(1, 'Unit is required'),
  activity_date: z.string().min(1, 'Activity date is required'),
});

type ActivityDataFormValues = z.infer<typeof activityDataSchema>;

export default function IngestActivityDataPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ActivityDataFormValues>({
    resolver: zodResolver(activityDataSchema),
  });

  const category = watch('category');

  const onSubmit = async (data: ActivityDataFormValues) => {
    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to submit activity data');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-activity-data`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          category: data.category,
          quantity: Number(data.quantity),
          unit: data.unit,
          activity_date: data.activity_date,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit activity data');
      }

      toast.success('Activity data submitted');
      reset();
    } catch (error) {
      console.error('Error submitting activity data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit activity data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Statement eyebrow="THE WORKBENCH · INGEST" headline="One figure, straight in." />

      <p className="text-sm text-studio-dim">
        Record a single activity figure against Scope 1, 2 or 3. For invoices,
        spreadsheets and meter data, drop the file on Rosa instead.
      </p>

      <Panel>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Activity name</Label>
            <Input
              id="name"
              placeholder="e.g. Monthly electricity consumption"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-studio-stale">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Scope</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                setValue('category', value as 'Scope 1' | 'Scope 2' | 'Scope 3', {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select emissions scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scope 1">Scope 1</SelectItem>
                <SelectItem value="Scope 2">Scope 2</SelectItem>
                <SelectItem value="Scope 3">Scope 3</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-studio-stale">{errors.category.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="e.g. 1500"
                {...register('quantity')}
              />
              {errors.quantity && (
                <p className="text-sm text-studio-stale">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g. kWh, litres, kg"
                {...register('unit')}
              />
              {errors.unit && (
                <p className="text-sm text-studio-stale">{errors.unit.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_date">Activity date</Label>
            <Input
              id="activity_date"
              type="date"
              {...register('activity_date')}
            />
            {errors.activity_date && (
              <p className="text-sm text-studio-stale">
                {errors.activity_date.message}
              </p>
            )}
          </div>

          <PillButton type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting…' : 'Submit activity data'}
          </PillButton>
        </form>
      </Panel>
    </div>
  );
}
