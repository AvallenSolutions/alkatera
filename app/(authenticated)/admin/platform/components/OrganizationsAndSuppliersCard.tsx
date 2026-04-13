"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizationsTable } from "./OrganizationsTable";
import { SuppliersTable } from "./SuppliersTable";
import type { OrganizationInfo, PlatformSupplier } from "../types";

interface OrganizationsAndSuppliersCardProps {
  organizations: OrganizationInfo[];
  suppliers: PlatformSupplier[];
  loading: boolean;
}

export function OrganizationsAndSuppliersCard({
  organizations,
  suppliers,
  loading,
}: OrganizationsAndSuppliersCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Organisations & Suppliers</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="organisations">
          <TabsList>
            <TabsTrigger value="organisations">
              Organisations ({organizations.length})
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              Suppliers ({suppliers.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="organisations" className="mt-4">
            <OrganizationsTable organizations={organizations} loading={loading} bare />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <SuppliersTable suppliers={suppliers} loading={loading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
