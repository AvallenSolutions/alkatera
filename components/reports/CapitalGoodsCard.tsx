"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HardHat, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CapitalGoodsEntry {
  id: string;
  description: string;
  asset_type: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
}

interface CapitalGoodsCardProps {
  reportId: string;
  entries: CapitalGoodsEntry[];
  onUpdate: () => void;
}

export function CapitalGoodsCard({ reportId, entries, onUpdate }: CapitalGoodsCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [assetType, setAssetType] = useState("machinery");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDate(new Date().toISOString().split("T")[0]);
  }, []);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);
  const totalSpend = entries.reduce((sum, entry) => sum + entry.spend_amount, 0);

  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const formatAssetType = (type: string) => {
    const mapping: Record<string, string> = {
      machinery: "Machinery",
      vehicles: "Vehicles",
      it_hardware: "IT Hardware",
      equipment: "Equipment",
      other: "Other",
    };
    return mapping[type] || type;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !assetType || !amount || parseFloat(amount) <= 0) {
      toast.error("Please provide all required fields with valid values");
      return;
    }

    setIsSaving(true);
    try {
      const emissionFactor = 0.4; // kgCO2e per GBP for capital goods
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
          category: "capital_goods",
          description,
          asset_type: assetType,
          spend_amount: parseFloat(amount),
          currency: "GBP",
          entry_date: date,
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        }),
      });

      if (!response.ok) throw new Error("Failed to save entry");

      toast.success("Capital asset logged");
      setDescription("");
      setAssetType("machinery");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving capital goods entry:", error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <HardHat className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Capital Goods & Assets</CardTitle>
                <CardDescription>Machinery, vehicles, equipment</CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                {entries.length} {entries.length === 1 ? "asset" : "assets"}
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
                  £{totalSpend.toLocaleString()} total investment
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {formatAssetType(entry.asset_type)}
                        </Badge>
                      </div>
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
              <div className="text-sm text-muted-foreground mb-4">No assets purchased</div>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Asset Purchase
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Capital Asset Purchase</DialogTitle>
            <DialogDescription>Record asset purchases for embodied carbon accounting</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset-type">Asset Type</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machinery">Machinery</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="it_hardware">IT Hardware</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Forklift Model XYZ"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Purchase Price (£)</Label>
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
                <Label htmlFor="date">Purchase Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground">
              Embodied carbon factor: 0.4 kgCO₂e per £ (EEIO average for capital goods)
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Asset"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
