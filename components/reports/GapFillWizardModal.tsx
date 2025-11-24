"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Building2, Package, TrendingUp, Users, Plane, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface GapFillWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  year: number;
  onSuccess: (reportId: string) => void;
}

interface CalculationStep {
  label: string;
  icon: React.ReactNode;
  completed: boolean;
}

export function GapFillWizardModal({
  open,
  onOpenChange,
  organizationId,
  year,
  onSuccess,
}: GapFillWizardModalProps) {
  const [step, setStep] = useState<"calculating" | "gap-fill" | "complete">("calculating");
  const [progress, setProgress] = useState(0);

  const [businessTravel, setBusinessTravel] = useState("");
  const [purchasedServices, setPurchasedServices] = useState("");
  const [employeeFtes, setEmployeeFtes] = useState("");

  const [calculationSteps, setCalculationSteps] = useState<CalculationStep[]>([
    {
      label: "Aggregating Facility Data (Scope 1 & 2)",
      icon: <Building2 className="h-4 w-4" />,
      completed: false,
    },
    {
      label: "Analyzing Production Volumes",
      icon: <Package className="h-4 w-4" />,
      completed: false,
    },
    {
      label: "Calculating Product Footprints",
      icon: <TrendingUp className="h-4 w-4" />,
      completed: false,
    },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [calculatedPercentage, setCalculatedPercentage] = useState(85);

  // Simulate the magic loader animation
  const runCalculation = async () => {
    setStep("calculating");
    setProgress(0);

    // Animate through each step
    for (let i = 0; i < calculationSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCalculationSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, completed: true } : s))
      );
      setProgress(((i + 1) / calculationSteps.length) * 100);
    }

    // Small delay before showing gap-fill
    await new Promise((resolve) => setTimeout(resolve, 500));
    setStep("gap-fill");
  };

  const handleFinalize = async () => {
    setIsSaving(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-ccf-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            organization_id: organizationId,
            year,
            overheads: {
              business_travel: businessTravel ? parseFloat(businessTravel) : undefined,
              purchased_services: purchasedServices ? parseFloat(purchasedServices) : undefined,
              employee_commuting_ftes: employeeFtes ? parseInt(employeeFtes) : undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }

      const data = await response.json();

      toast.success("CCF Report generated successfully!");
      onSuccess(data.report_id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error finalizing report:", error);
      toast.error(error.message || "Failed to generate report");
    } finally {
      setIsSaving(false);
    }
  };

  // Start calculation when modal opens
  useEffect(() => {
    if (open) {
      runCalculation();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {step === "calculating" && (
          <>
            <DialogHeader>
              <DialogTitle>Generating {year} Carbon Footprint Report</DialogTitle>
              <DialogDescription>
                Analyzing your existing data to calculate your corporate emissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-4">
                {calculationSteps.map((calcStep, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-full ${
                        calcStep.completed
                          ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                      }`}
                    >
                      {calcStep.completed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        calcStep.completed
                          ? "text-slate-900 dark:text-slate-100 font-medium"
                          : "text-slate-500"
                      }`}
                    >
                      {calcStep.label}
                    </span>
                  </div>
                ))}
              </div>

              <Progress value={progress} className="h-2" />
            </div>
          </>
        )}

        {step === "gap-fill" && (
          <>
            <DialogHeader>
              <DialogTitle>We've calculated {calculatedPercentage}% of your footprint</DialogTitle>
              <DialogDescription>
                Help us fill in the remaining {100 - calculatedPercentage}% with Scope 3 overhead data
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Business Travel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-slate-500" />
                  <Label htmlFor="business-travel">Business Travel Spend (£)</Label>
                </div>
                <Input
                  id="business-travel"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 50000"
                  value={businessTravel}
                  onChange={(e) => setBusinessTravel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Total annual spend on flights, trains, and hotels
                </p>
              </div>

              {/* Purchased Services */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                  <Label htmlFor="purchased-services">
                    External Services Spend (£)
                  </Label>
                </div>
                <Input
                  id="purchased-services"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 200000"
                  value={purchasedServices}
                  onChange={(e) => setPurchasedServices(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Legal, marketing, IT services, consulting, etc.
                </p>
              </div>

              {/* Employee Commuting */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <Label htmlFor="employee-ftes">Number of Full-Time Employees</Label>
                </div>
                <Input
                  id="employee-ftes"
                  type="number"
                  min="0"
                  placeholder="e.g., 50"
                  value={employeeFtes}
                  onChange={(e) => setEmployeeFtes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We'll use UK average commuting emissions per employee
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleFinalize} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  "Finalize Report"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
