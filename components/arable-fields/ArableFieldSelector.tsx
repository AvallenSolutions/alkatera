'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wheat, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface ArableFieldOption {
  id: string;
  name: string;
  hectares: number;
  crop_type: string;
  certification: string;
  climate_zone: string;
  location_country_code: string | null;
}

interface ArableFieldSelectorProps {
  organizationId: string;
  value: string;
  onValueChange: (fieldId: string, field: ArableFieldOption) => void;
}

export function ArableFieldSelector({
  organizationId,
  value,
  onValueChange,
}: ArableFieldSelectorProps) {
  const [fields, setFields] = useState<ArableFieldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const fieldsRef = useRef<ArableFieldOption[]>([]);

  useEffect(() => {
    if (!organizationId) return;

    fetch('/api/arable-fields')
      .then((res) => res.json())
      .then(({ data }) => {
        const mapped: ArableFieldOption[] = (data || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          hectares: v.hectares,
          crop_type: v.crop_type || 'barley',
          certification: v.certification || 'conventional',
          climate_zone: v.climate_zone || 'temperate',
          location_country_code: v.location_country_code || null,
        }));
        setFields(mapped);
        fieldsRef.current = mapped;
      })
      .catch(() => setFields([]))
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Loading arable fields...
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center">
        <Wheat className="h-5 w-5 mx-auto mb-1 text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground mb-2">
          No arable fields configured yet.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/arable-fields/">
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Add an arable field
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Arable Field</Label>
      <Select
        value={value}
        onValueChange={(id) => {
          const field = fieldsRef.current.find((v) => v.id === id);
          if (field) onValueChange(id, field);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an arable field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="flex items-center gap-2">
                <Wheat className="h-3 w-3 text-[#ccff00]" />
                {v.name}
                <span className="text-xs text-muted-foreground">
                  ({v.hectares} ha)
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        The growing profile for this arable field will be used to calculate environmental impact.
      </p>
    </div>
  );
}
