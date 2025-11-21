"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Construction } from "lucide-react";

interface CoreOperationsPageProps {
  params: {
    id: string;
  };
}

export default function CoreOperationsPage({ params }: CoreOperationsPageProps) {
  const router = useRouter();
  const productId = params.id;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Core Operations</h1>
          <p className="text-muted-foreground mt-1">
            Manufacturing and production processes
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
          This section is under construction. Core operations data entry will be available soon.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This page will allow you to capture manufacturing and production data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You'll be able to add information about:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Manufacturing processes</li>
            <li>Energy consumption</li>
            <li>Water usage</li>
            <li>Waste generation</li>
            <li>Emissions during production</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
