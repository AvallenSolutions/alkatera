"use client";

import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ActivityData {
  id: string;
  emission_source_id: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  created_at: string;
  scope_1_2_emission_sources: {
    source_name: string;
    scope: string;
    category: string;
  };
}

interface ActivityDataTableProps {
  data: ActivityData[];
  onRefresh: () => void;
}

export function ActivityDataTable({ data, onRefresh }: ActivityDataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No activity data recorded yet</p>
        <p className="text-sm mt-2">Click &quot;Add Data&quot; to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Reporting Period</TableHead>
            <TableHead>Recorded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.scope_1_2_emission_sources.source_name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {item.scope_1_2_emission_sources.category}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {item.quantity.toLocaleString()}
              </TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell>
                {format(new Date(item.reporting_period_start), "dd MMM yyyy")} -{" "}
                {format(new Date(item.reporting_period_end), "dd MMM yyyy")}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(item.created_at), "dd MMM yyyy HH:mm")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
