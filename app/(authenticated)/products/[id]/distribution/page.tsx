"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Construction } from "lucide-react";

interface DistributionPageProps {
  params: {
    id: string;
  };
}

export default function DistributionPage({ params }: DistributionPageProps) {
  const router = useRouter();
  const productId = params.id;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Downstream: Distribution</h1>
          <p className="text-muted-foreground mt-1">
            Transportation and logistics
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
        <Construction className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Notice:</strong> This workflow has been superseded by our ISO14044-compliant LCA process.
          For new assessments, please use the <Button
            variant="link"
            className="p-0 h-auto text-amber-900 dark:text-amber-100 underline font-semibold"
            onClick={() => router.push(`/products/${productId}/lca/initiate`)}
          >
            ISO14044 LCA Flow
          </Button>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This page will allow you to capture distribution and logistics data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You'll be able to add information about:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Transportation modes</li>
            <li>Distance travelled</li>
            <li>Fuel consumption</li>
            <li>Cold chain requirements</li>
            <li>Warehousing and storage</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
