"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { format, parseISO, differenceInDays, addMonths, startOfMonth } from "date-fns";
import { useReportingPeriod } from "@/hooks/useReportingPeriod";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { Panel } from "@/components/studio/panel";
import { StateChip } from "@/components/studio/state-chip";

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
  const { selectableYears, getYearRange, currentLabelYear } = useReportingPeriod();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(currentLabelYear.toString());
  const [filterType, setFilterType] = useState<"all" | "facilities" | "products">(viewType);

  useEffect(() => {
    loadTimelineData();
  }, [organizationId, selectedYear]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);

      const { yearStart, yearEnd } = getYearRange(parseInt(selectedYear));

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
        .from("product_carbon_footprints")
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
            name: session.facility?.name || "Unknown facility",
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
              name: lca.product?.name || "Unknown product",
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
    const { yearStart, yearEnd } = getYearRange(parseInt(selectedYear));
    const start = parseISO(yearStart);
    const end = parseISO(yearEnd);

    const months = [];
    let currentMonth = startOfMonth(start);
    while (currentMonth <= end) {
      months.push(currentMonth);
      currentMonth = addMonths(currentMonth, 1);
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      monthsInRange: months,
    };
  }, [selectedYear, getYearRange]);

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

  if (loading) {
    return (
      <Panel className="flex min-h-[200px] items-center justify-center">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          Loading
        </span>
      </Panel>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>REPORTING PERIODS</Eyebrow>
          <p className="mt-1.5 text-sm text-studio-dim">
            Data collection periods, and where facility and product periods line up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="facilities">Facilities only</SelectItem>
              <SelectItem value="products">Products only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableYears.map((sy) => (
                <SelectItem key={sy.year} value={sy.year.toString()}>
                  {sy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-studio-hairline border-y border-studio-hairline py-5">
        <BigNumber
          value={filteredEntries.filter((e) => e.type === "facility").length}
          label="FACILITY PERIODS"
        />
        <BigNumber
          className="pl-6"
          value={filteredEntries.filter((e) => e.type === "product").length}
          label="PRODUCT PERIODS"
        />
        <BigNumber
          className="pl-6"
          tone={overlaps.length > 0 ? "good" : "attention"}
          value={overlaps.length}
          label="ALIGNED PERIODS"
        />
      </div>

      <Panel>
        {/* Legend */}
        <div className="mb-4 flex items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px] border border-room/40 bg-room/20" />
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Facility
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px] border border-studio-ink/30 bg-studio-ink/10" />
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Product
            </span>
          </span>
        </div>

        {/* Month headers */}
        <div className="relative h-8 border-b border-studio-hairline">
          <div className="absolute inset-0 flex">
            {monthsInRange.map((month, index) => (
              <div
                key={index}
                className="flex-1 border-r border-studio-hairline/60 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-studio-dim"
              >
                {format(month, "MMM")}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline entries */}
        <div className="mt-4 space-y-2">
          {filteredEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-studio-dim">
              No reporting periods for {selectedYear}.
            </p>
          ) : (
            filteredEntries.map((entry) => {
              const startPos = calculatePosition(entry.startDate);
              const endPos = calculatePosition(entry.endDate);
              const width = endPos - startPos;

              return (
                <div key={entry.id} className="relative h-12">
                  <div className="absolute inset-y-0 left-0 flex w-48 items-center">
                    <span className="truncate font-display text-sm font-semibold text-foreground">
                      {entry.name}
                    </span>
                  </div>
                  <div className="absolute inset-y-0 left-48 right-0 flex items-center px-2">
                    <div className="relative h-6 w-full">
                      <div
                        className={cn(
                          "absolute h-full rounded-[4px] border",
                          entry.type === "facility"
                            ? "border-room/40 bg-room/20"
                            : "border-studio-ink/30 bg-studio-ink/10"
                        )}
                        style={{
                          left: `${startPos}%`,
                          width: `${width}%`,
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.1em] text-foreground">
                            {format(entry.startDate, "d MMM")} · {format(entry.endDate, "d MMM")}
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

        {/* Alignments */}
        {overlaps.length > 0 && (
          <div className="mt-6 border-t border-studio-hairline pt-4">
            <Eyebrow tone="dim" className="mb-2">
              PERIOD ALIGNMENTS · {overlaps.length}
            </Eyebrow>
            <ul className="divide-y divide-studio-hairline">
              {overlaps.slice(0, 4).map((overlap, index) => (
                <li key={index} className="flex items-center gap-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="truncate font-display text-sm font-semibold text-foreground">
                        {overlap.facility}
                      </span>
                      <StateChip tone="good">Aligned</StateChip>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-studio-dim">{overlap.product}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                    {overlap.days} days
                  </span>
                </li>
              ))}
            </ul>
            {overlaps.length > 4 && (
              <p className="mt-2 text-xs text-studio-dim">
                And {overlaps.length - 4} more.
              </p>
            )}
          </div>
        )}
      </Panel>
    </section>
  );
}
