"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Plus, MoreHorizontal, Edit, Trash2, Factory } from "lucide-react";
import { format } from "date-fns";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { LogProductionModal } from "@/components/production/LogProductionModal";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";

interface ProductionLog {
  id: string;
  facility_id: string;
  product_id: number;
  date: string;
  volume: number;
  unit: string;
  facilities: {
    name: string;
    facility_type: string;
    country: string;
  };
  products: {
    name: string;
    sku: string;
  };
}

export default function ProductionPage() {
  const { currentOrganization } = useOrganization();

  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    id: string;
    facility_id: string;
    product_id: number;
    date: string;
    volume: number;
    unit: string;
  } | null>(null);
  const [deletingLog, setDeletingLog] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchLogs();
    }
  }, [currentOrganization?.id]);

  const fetchLogs = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("production_logs")
        .select(`
          *,
          facilities (
            name,
            facility_type,
            country
          ),
          products (
            name,
            sku
          )
        `)
        .eq("organization_id", currentOrganization.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching production logs:", error);
      toast.error("Failed to load production logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (log: ProductionLog) => {
    setEditingLog({
      id: log.id,
      facility_id: log.facility_id,
      product_id: log.product_id,
      date: log.date,
      volume: log.volume,
      unit: log.unit,
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingLog) return;

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("production_logs")
        .delete()
        .eq("id", deletingLog);

      if (error) throw error;

      toast.success("Production log deleted successfully");
      fetchLogs();
    } catch (error: any) {
      console.error("Error deleting production log:", error);
      toast.error("Failed to delete production log");
    } finally {
      setDeletingLog(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingLog(null);
  };

  const handleSuccess = () => {
    fetchLogs();
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case "Litre":
        return "L";
      case "Hectolitre":
        return "hL";
      case "Unit":
        return "units";
      default:
        return unit;
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading production logs..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Production Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Track production volumes to allocate facility impact
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log Production
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Volume Logs
              </CardTitle>
              <CardDescription>
                Production records for environmental impact allocation
              </CardDescription>
            </div>
            {logs.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {logs.length} {logs.length === 1 ? "record" : "records"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Production Logs</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Start tracking production volumes to allocate environmental impact across your products.
                This data acts as the allocation key for Scope 1 & 2 emissions.
              </p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Log
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {format(new Date(log.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Factory className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{log.facilities.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.facilities.facility_type}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.products.name}</div>
                          {log.products.sku && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {log.products.sku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-medium">
                          {log.volume.toLocaleString()} {getUnitLabel(log.unit)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(log)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingLog(log.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Production Modal */}
      {currentOrganization && (
        <LogProductionModal
          open={showModal}
          onOpenChange={handleModalClose}
          organizationId={currentOrganization.id}
          onSuccess={handleSuccess}
          editingLog={editingLog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingLog} onOpenChange={() => setDeletingLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this production record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
