"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { updateSourcingMethodology } from "@/lib/lca";

interface SourcingMethodologyCardsProps {
  lcaId: string;
}

export function SourcingMethodologyCards({ lcaId }: SourcingMethodologyCardsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMethodologySelect = async (methodology: "GROWN" | "PURCHASED") => {
    try {
      setIsSubmitting(true);
      setError(null);

      const result = await updateSourcingMethodology(lcaId, methodology);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`Sourcing methodology set to: ${methodology === "GROWN" ? "We Grow" : "We Purchase"}`);

      router.push(`/dashboard/lcas/${lcaId}/ingredients`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update sourcing methodology";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => !isSubmitting && handleMethodologySelect("GROWN")}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Sprout className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">We Grow Our Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-center">
              Select this if your organisation is the primary producer of the core raw materials.
              You control the agricultural or cultivation processes.
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => !isSubmitting && handleMethodologySelect("PURCHASED")}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <ShoppingCart className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-xl">We Purchase Our Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-center">
              Select this if you source raw materials from third-party suppliers.
              You acquire pre-grown or pre-processed ingredients.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/products")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <p className="text-sm text-muted-foreground">
          Click a card above to continue
        </p>
      </div>
    </>
  );
}
