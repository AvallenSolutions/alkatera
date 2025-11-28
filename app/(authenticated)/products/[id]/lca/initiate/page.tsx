"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ShieldCheck,
  Info,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { initiateLcaWorkflow } from "@/lib/lcaWorkflow";
import { toast } from "sonner";

export default function LcaInitiatePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [functionalUnit, setFunctionalUnit] = useState("");
  const [systemBoundary, setSystemBoundary] = useState<"cradle-to-gate" | "cradle-to-grave">(
    "cradle-to-gate"
  );
  const [referenceYear, setReferenceYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ functionalUnit?: string }>({});

  const validateFunctionalUnit = (value: string) => {
    if (!value.trim()) {
      return "Functional unit is required";
    }
    if (value.trim().length < 10) {
      return "Functional unit must be at least 10 characters";
    }
    return null;
  };

  const handleFunctionalUnitChange = (value: string) => {
    setFunctionalUnit(value);
    if (errors.functionalUnit) {
      const error = validateFunctionalUnit(value);
      if (!error) {
        setErrors((prev) => ({ ...prev, functionalUnit: undefined }));
      }
    }
  };

  const handleConfirmAndContinue = async () => {
    const functionalUnitError = validateFunctionalUnit(functionalUnit);

    if (functionalUnitError) {
      setErrors({ functionalUnit: functionalUnitError });
      return;
    }

    if (!currentOrganization?.id) {
      toast.error("No organisation selected");
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await initiateLcaWorkflow({
        productId,
        organizationId: currentOrganization.id,
        functionalUnit: functionalUnit.trim(),
        systemBoundary,
        referenceYear,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("LCA initiated successfully");
      router.push(`/products/${productId}/lca/${result.lcaId}/data-capture`);
    } catch (error: any) {
      console.error("Error initiating LCA:", error);
      toast.error(error.message || "Failed to initiate LCA");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = functionalUnit.trim().length >= 10 && !errors.functionalUnit;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Define Goal & Scope</h1>
          <p className="text-muted-foreground mt-1">
            ISO 14044 compliance gateway: mandatory before data entry
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          <strong>Compliance Checkpoint:</strong> These definitions establish the foundation
          of your LCA and cannot be changed after confirmation. This ensures methodological
          rigour and audit trail integrity.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600">1</span>
            </div>
            <div>
              <CardTitle>Functional Unit</CardTitle>
              <CardDescription>
                Define the quantified performance of the product system
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="functional-unit">
              Functional Unit <span className="text-red-600">*</span>
            </Label>
            <Input
              id="functional-unit"
              value={functionalUnit}
              onChange={(e) => handleFunctionalUnitChange(e.target.value)}
              placeholder="e.g., To deliver 700ml of beverage to a consumer"
              className={`mt-2 ${errors.functionalUnit ? "border-red-500" : ""}`}
              maxLength={200}
            />
            <div className="flex justify-between mt-1">
              <div>
                {errors.functionalUnit && (
                  <p className="text-sm text-red-600">{errors.functionalUnit}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {functionalUnit.length}/200 characters
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Guidance:</strong> The functional unit must clearly state what the
              product does. Good examples:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>"To deliver 700ml of packaged beverage to a retail customer"</li>
                <li>"1kg of packaged product delivered to distribution centre"</li>
                <li>"To package and deliver one unit of product to end consumer"</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600">2</span>
            </div>
            <div>
              <CardTitle>Reference Year</CardTitle>
              <CardDescription>
                ISO 14067 Temporal Anchoring: Select the financial year for facility operational data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="reference-year">
              Reference Year <span className="text-red-600">*</span>
            </Label>
            <Select
              value={referenceYear.toString()}
              onValueChange={(value) => setReferenceYear(parseInt(value))}
            >
              <SelectTrigger id="reference-year" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              All facility emissions and production data will be sourced from this financial year.
              This ensures temporal consistency per ISO 14067 requirements.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <span className="text-sm font-bold text-blue-600">3</span>
            </div>
            <div>
              <CardTitle>System Boundary</CardTitle>
              <CardDescription>
                Select the scope of your life cycle assessment
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={systemBoundary} onValueChange={(value: any) => setSystemBoundary(value)}>
            <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900">
              <RadioGroupItem value="cradle-to-gate" id="cradle-to-gate" />
              <div className="flex-1">
                <Label htmlFor="cradle-to-gate" className="font-semibold flex items-center gap-2">
                  Cradle-to-Gate
                  <Badge variant="secondary" className="ml-2">Recommended</Badge>
                </Label>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Includes:</strong> Raw material extraction, ingredient processing,
                  packaging production, and manufacturing at your facility
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Excludes:</strong> Distribution, retail, consumer use, and end-of-life
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>Best for initial assessment and supply chain focus</span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
              <RadioGroupItem value="cradle-to-grave" id="cradle-to-grave" />
              <div className="flex-1">
                <Label htmlFor="cradle-to-grave" className="font-semibold">
                  Cradle-to-Grave
                </Label>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Includes:</strong> Everything in Cradle-to-Gate plus distribution,
                  retail storage, consumer use phase, and end-of-life disposal
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Note:</strong> Requires additional data collection beyond manufacturing
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>You can extend to Cradle-to-Grave later from a Cradle-to-Gate assessment</span>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium">ISO 14044 Compliance</p>
            <p className="text-xs text-muted-foreground">
              Confirming this gateway creates an auditable record
            </p>
          </div>
        </div>
        <Button
          onClick={handleConfirmAndContinue}
          disabled={!isFormValid || isSubmitting}
          size="lg"
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm & Continue
            </>
          )}
        </Button>
      </div>

      <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm">
          After confirmation, you'll proceed to structured data entry across three phases:
          Ingredients, Packaging, and Production. Your progress will be auto-saved.
        </AlertDescription>
      </Alert>
    </div>
  );
}
