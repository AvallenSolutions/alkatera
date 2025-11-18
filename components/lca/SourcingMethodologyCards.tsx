"use client";

import { useRouter } from "next/navigation";
import { Sprout, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateSourcingMethodology } from "@/app/(authenticated)/dashboard/lcas/[lca_id]/create/sourcing/actions";

interface SourcingMethodologyCardsProps {
  lcaId: string;
}

export function SourcingMethodologyCards({ lcaId }: SourcingMethodologyCardsProps) {
  const router = useRouter();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form action={updateSourcingMethodology.bind(null, lcaId)}>
          <button
            type="submit"
            name="methodology"
            value="grown"
            className="w-full text-left"
          >
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary h-full">
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
          </button>
        </form>

        <form action={updateSourcingMethodology.bind(null, lcaId)}>
          <button
            type="submit"
            name="methodology"
            value="purchased"
            className="w-full text-left"
          >
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary h-full">
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
          </button>
        </form>
      </div>

      <div className="mt-8 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/products")}
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
