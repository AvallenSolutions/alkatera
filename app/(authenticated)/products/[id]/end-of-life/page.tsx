"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Construction } from "lucide-react";

interface EndOfLifePageProps {
  params: {
    id: string;
  };
}

export default function EndOfLifePage({ params }: EndOfLifePageProps) {
  const router = useRouter();
  const productId = params.id;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Use & End of Life</h1>
          <p className="text-muted-foreground mt-1">
            Product usage and disposal
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}/hub`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
        </Button>
      </div>

      <Alert>
        <Construction className="h-4 w-4" />
        <AlertDescription>
          This section is under construction. Use and end-of-life data entry will be available soon.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This page will allow you to capture usage and disposal data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You'll be able to add information about:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Consumer usage patterns</li>
            <li>Product lifespan</li>
            <li>Disposal methods</li>
            <li>Recycling potential</li>
            <li>Biodegradability</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
