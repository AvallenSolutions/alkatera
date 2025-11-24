"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Plus, Calendar, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TravelEntry {
  id: string;
  description: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
}

interface BusinessTravelCardProps {
  reportId: string;
  entries: TravelEntry[];
  onUpdate: () => void;
}

export function BusinessTravelCard({ reportId, entries, onUpdate }: BusinessTravelCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);
  const totalSpend = entries.reduce((sum, entry) => sum + entry.spend_amount, 0);

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(2)} kgCO₂e`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !amount || parseFloat(amount) <= 0) {
      toast.error("Please provide a description and valid amount");
      return;
    }

    setIsSaving(true);
    try {
      const emissionFactor = 0.25; // kgCO2e per GBP
      const computedCO2e = parseFloat(amount) * emissionFactor;

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/corporate_overheads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({
          report_id: reportId,
          category: "business_travel",
          description,
          spend_amount: parseFloat(amount),
          currency: "GBP",
          entry_date: date,
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        }),
      });

      if (!response.ok) throw new Error("Failed to save entry");

      toast.success("Travel spend logged");
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving travel entry:", error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 dark:bg-purple-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Plane className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Business Travel</CardTitle>
                <CardDescription>Flights, trains & hotels</CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {entries.length > 0 ? (
            <>
              <div className="text-center py-4 border-b">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {formatEmissions(totalCO2e)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  £{totalSpend.toLocaleString()} total spend
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{entry.description}</div>
                      <div className="text-xs text-muted-foreground">
                        £{entry.spend_amount.toLocaleString()} • {formatEmissions(entry.computed_co2e)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.entry_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-4">No travel spend logged</div>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Travel Spend
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Business Travel</DialogTitle>
            <DialogDescription>Record travel expenses for carbon accounting</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Flight to London"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (£)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
