"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Factory,
  Loader2,
  Package,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { format, parseISO, differenceInDays, addMonths, startOfMonth } from "date-fns";

interface ReportingPeriodTimelineProps {
  organizationId: string;
  viewType?: "all" | "facilities" | "products";
}

interface TimelineEntry {
  id: string;
  type: "facility" | "product";
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  totalEmissions?: number;
  dataQuality?: string;
}

export function ReportingPeriodTimeline({
  organizationId,
  viewType = "all",
}: ReportingPeriodTimelineProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [filterType, setFilterType] = useState<"all" | "facilities" | "products">(viewType);

  useEffect(() => {
    loadTimelineData();
  }, [organizationId, selectedYear]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);

      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      // Load facility reporting sessions
      const { data: facilitySessions, error: facilityError } = await supabase
        .from("facility_reporting_sessions")
        .select(`
          id,
          reporting_period_start,
          reporting_period_end,
          data_source_type,
          facility:facilities!inner(
            id,
            name
          )
        `)
        .eq("organization_id", organizationId)
        .gte("reporting_period_end", yearStart)
        .lte("reporting_period_start", yearEnd);

      if (facilityError) throw facilityError;

      // Load product LCA reporting periods
      const { data: productLCAs, error: productError } = await supabase
        .from("product_lcas")
        .select(`
          id,
          temporal_anchor_start,
          temporal_anchor_end,
          status,
          aggregated_impacts,
          product:products!inner(
            id,
            name
          )
        `)
        .eq("organization_id", organizationId)
        .gte("temporal_anchor_end", yearStart)
        .lte("temporal_anchor_start", yearEnd)
        .order("temporal_anchor_start", { ascending: true });

      if (productError) throw productError;

      const timelineData: TimelineEntry[] = [];

      // Add facility sessions
      if (facilitySessions) {
        facilitySessions.forEach((session: any) => {
          timelineData.push({
            id: session.id,
            type: "facility",
            name: session.facility?.name || "Unknown Facility",
            startDate: parseISO(session.reporting_period_start),
            endDate: parseISO(session.reporting_period_end),
            status: "completed",
            dataQuality: session.data_source_type,
          });
        });
      }

      // Add product LCAs
      if (productLCAs) {
        productLCAs.forEach((lca: any) => {
          if (lca.temporal_anchor_start && lca.temporal_anchor_end) {
            timelineData.push({
              id: lca.id,
              type: "product",
              name: lca.product?.name || "Unknown Product",
              startDate: parseISO(lca.temporal_anchor_start),
              endDate: parseISO(lca.temporal_anchor_end),
              status: lca.status,
              totalEmissions: lca.aggregated_impacts?.climate_change_gwp100,
            });
          }
        });
      }

      // Sort by start date
      timelineData.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      setEntries(timelineData);
    } catch (error) {
      console.error("Error loading timeline data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (filterType === "all") return entries;
    return entries.filter((entry) => {
      if (filterType === "facilities") return entry.type === "facility";
      if (filterType === "products") return entry.type === "product";
      return true;
    });
  }, [entries, filterType]);

  const { timelineStart, timelineEnd, monthsInRange } = useMemo(() => {
    const yearStart = new Date(parseInt(selectedYear), 0, 1);
    const yearEnd = new Date(parseInt(selectedYear), 11, 31);

    const months = [];
    let currentMonth = startOfMonth(yearStart);
    while (currentMonth <= yearEnd) {
      months.push(currentMonth);
      currentMonth = addMonths(currentMonth, 1);
    }

    return {
      timelineStart: yearStart,
      timelineEnd: yearEnd,
      monthsInRange: months,
    };
  }, [selectedYear]);

  const calculatePosition = (date: Date) => {
    const totalDays = differenceInDays(timelineEnd, timelineStart);
    const daysFromStart = differenceInDays(date, timelineStart);
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
  };

  const getOverlaps = () => {
    const overlaps: { facility: string; product: string; days: number }[] = [];

    const facilities = filteredEntries.filter((e) => e.type === "facility");
    const products = filteredEntries.filter((e) => e.type === "product");

    facilities.forEach((facility) => {
      products.forEach((product) => {
        const overlapStart = new Date(
          Math.max(facility.startDate.getTime(), product.startDate.getTime())
        );
        const overlapEnd = new Date(
          Math.min(facility.endDate.getTime(), product.endDate.getTime())
        );

        if (overlapStart <= overlapEnd) {
          const days = differenceInDays(overlapEnd, overlapStart) + 1;
          overlaps.push({
            facility: facility.name,
            product: product.name,
            days,
          });
        }
      });
    });

    return overlaps;
  };

  const overlaps = getOverlaps();
  const hasAlignment = overlaps.length > 0;

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-lime-400" />
              Reporting Period Timeline
            </CardTitle>
            <CardDescription>
              Visual overview of data collection periods and temporal alignment
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="facilities">Facilities Only</SelectItem>
                <SelectItem value="products">Products Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2026, 2025, 2024, 2023].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alignment Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-slate-400">Facility Periods</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredEntries.filter((e) => e.type === "facility").length}
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-lime-400" />
              <span className="text-xs text-slate-400">Product Periods</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredEntries.filter((e) => e.type === "product").length}
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              {hasAlignment ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-xs text-slate-400">Overlaps</span>
            </div>
            <p className="text-2xl font-bold text-white">{overlaps.length}</p>
          </div>
        </div>

        {/* Timeline Visualization */}
        <div className="space-y-4">
          {/* Month Headers */}
          <div className="relative h-8 border-b border-slate-700">
            <div className="absolute inset-0 flex">
              {monthsInRange.map((month, index) => (
                <div
                  key={index}
                  className="flex-1 text-center text-xs text-slate-400 border-r border-slate-800"
                >
                  {format(month, "MMM")}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Entries */}
          <div className="space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No reporting periods found for {selectedYear}</p>
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const startPos = calculatePosition(entry.startDate);
                const endPos = calculatePosition(entry.endDate);
                const width = endPos - startPos;

                return (
                  <div key={entry.id} className="relative h-12">
                    <div className="absolute inset-y-0 left-0 flex items-center w-48">
                      <div className="flex items-center gap-2 truncate">
                        {entry.type === "facility" ? (
                          <Factory className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        ) : (
                          <Package className="h-4 w-4 text-lime-400 flex-shrink-0" />
                        )}
                        <span className="text-sm text-white truncate">{entry.name}</span>
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-48 right-0 flex items-center px-2">
                      <div className="relative w-full h-6">
                        <div
                          className={`absolute h-full rounded transition-all ${
                            entry.type === "facility"
                              ? "bg-blue-500/30 border border-blue-500/50"
                              : "bg-lime-500/30 border border-lime-500/50"
                          }`}
                          style={{
                            left: `${startPos}%`,
                            width: `${width}%`,
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {format(entry.startDate, "MMM d")} -{" "}
                              {format(entry.endDate, "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Overlaps Summary */}
        {overlaps.length > 0 && (
          <div className="pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Period Alignments ({overlaps.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {overlaps.slice(0, 4).map((overlap, index) => (
                <div
                  key={index}
                  className="p-3 bg-green-500/10 border border-green-500/20 rounded-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {overlap.facility}
                      </p>
                      <p className="text-xs text-slate-400 truncate">× {overlap.product}</p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-300 ml-2">
                      {overlap.days} days
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {overlaps.length > 4 && (
              <p className="text-xs text-slate-400 mt-2">
                + {overlaps.length - 4} more alignments
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
