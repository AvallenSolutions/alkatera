"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface EmissionSource {
  id: string;
  source_name: string;
  scope: string;
  category: string;
  default_unit: string;
}

interface AddActivityDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  scope: string;
  emissionSources: EmissionSource[];
  onSuccess: () => void;
}

export function AddActivityDataModal({
  open,
  onOpenChange,
  facilityId,
  scope,
  emissionSources,
  onSuccess,
}: AddActivityDataModalProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedSourceId("");
      setQuantity("");
      setUnit("");
      setStartDate("");
      setEndDate("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedSourceId) {
      const source = emissionSources.find((s) => s.id === selectedSourceId);
      if (source) {
        setUnit(source.default_unit);
      }
    }
  }, [selectedSourceId, emissionSources]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSourceId || !quantity || !startDate || !endDate) {
      setError("Please fill in all fields");
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError("Quantity must be a positive number");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be after start date");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-data`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          facility_id: facilityId,
          emission_source_id: selectedSourceId,
          quantity: quantityNum,
          unit,
          reporting_period_start: startDate,
          reporting_period_end: endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add activity data");
      }

      const result = await response.json();
      console.log("Activity data added successfully:", result);

      onSuccess();
    } catch (err: any) {
      console.error("Error adding activity data:", err);
      setError(err.message || "Failed to add activity data");
    } finally {
      setLoading(false);
    }
  };

  const groupedSources = emissionSources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, EmissionSource[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add {scope} Data</DialogTitle>
          <DialogDescription>
            Record activity data for this facility
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="emission-source">Emission Source</Label>
            <Select
              value={selectedSourceId}
              onValueChange={setSelectedSourceId}
              disabled={loading}
            >
              <SelectTrigger id="emission-source">
                <SelectValue placeholder="Select an emission source" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedSources).map(([category, sources]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {category}
                    </div>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.source_name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Consumption</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              type="text"
              value={unit}
              disabled
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Unit is automatically set based on the selected emission source
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Period Start</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Period End</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
