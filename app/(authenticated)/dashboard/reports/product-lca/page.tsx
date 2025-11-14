"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Plus, FileText, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";

interface ProductLCA {
  id: string;
  product_name: string;
  functional_unit: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS = {
  draft: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function ProductLCAReportsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [lcas, setLcas] = useState<ProductLCA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchLCAs();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchLCAs = async () => {
    try {
      const { data, error } = await supabase
        .from("product_lcas")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLcas(data || []);
    } catch (error) {
      console.error("Error fetching LCAs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return <PageLoader message="Loading product LCAs..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product LCA Reports</h1>
          <p className="text-muted-foreground mt-2">
            View and manage life cycle assessments for your products
          </p>
        </div>
        <Link href="/lca/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create New LCA
          </Button>
        </Link>
      </div>

      {lcas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No product LCAs found. Create your first LCA to get started.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Product LCAs</CardTitle>
            <CardDescription>
              {lcas.length} {lcas.length === 1 ? "assessment" : "assessments"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Functional Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lcas.map((lca) => (
                  <TableRow key={lca.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {lca.product_name}
                      </div>
                    </TableCell>
                    <TableCell>{lca.functional_unit}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[lca.status as keyof typeof STATUS_COLORS]}
                      >
                        {lca.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(lca.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(lca.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
