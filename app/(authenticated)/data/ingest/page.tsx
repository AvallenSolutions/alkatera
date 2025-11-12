'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

      toast.success('Activity data submitted successfully');
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
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Ingest Activity Data</CardTitle>
          <CardDescription>
            Submit activity data for emissions calculations across Scope 1, 2, and 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Activity Name</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Electricity Consumption"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
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
                <p className="text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 1500"
                  {...register('quantity')}
                />
                {errors.quantity && (
                  <p className="text-sm text-red-600">{errors.quantity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  placeholder="e.g., kWh, litres, kg"
                  {...register('unit')}
                />
                {errors.unit && (
                  <p className="text-sm text-red-600">{errors.unit.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity_date">Activity Date</Label>
              <Input
                id="activity_date"
                type="date"
                {...register('activity_date')}
              />
              {errors.activity_date && (
                <p className="text-sm text-red-600">
                  {errors.activity_date.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting...' : 'Submit Activity Data'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
