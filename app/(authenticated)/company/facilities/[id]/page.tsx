"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eyebrow } from "@/components/studio/eyebrow";
import { Statement } from "@/components/studio/statement";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { Panel } from "@/components/studio/panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { EditFacilityDialog } from "@/components/facilities/EditFacilityDialog";
import { BrewwLinkBadge as FacilityBrewwLinkBadge } from "@/components/facilities/BrewwLinkBadge";
import { DirectDataEntry } from "@/components/facilities/DirectDataEntry";
import { ProductionVolumeManager } from "@/components/facilities/ProductionVolumeManager";
import { DataQualityConfidenceCard } from "@/components/facilities/DataQualityConfidenceCard";
import { ProductionRunDataEntry } from "@/components/facilities/ProductionRunDataEntry";
import { FacilityEnergyTab } from "@/components/energy/FacilityEnergyTab";
import { FacilityDataSourcingDialog } from "@/components/facilities/FacilityDataSourcingDialog";
import { FacilityDataDashboard } from "@/components/facilities/FacilityDataDashboard";
import { UpgradeFacilityDataButton } from "@/components/facilities/UpgradeFacilityDataButton";
import { UTILITY_TYPES } from "@/lib/constants/utility-types";
import { ProvenanceChip as SharedProvenanceChip } from "@/components/studio/provenance-chip";
import { provenanceFromDataQuality } from "@/lib/provenance";

interface Facility {
  id: string;
  name: string;
  functions: string[];
  operational_control: 'owned' | 'third_party';
  address_line1: string;
  address_city: string;
  address_country: string;
  address_postcode: string;
  organization_id: string;
  default_data_collection_mode?: 'primary' | 'archetype_proxy' | 'hybrid' | null;
  default_archetype_id?: string | null;
  default_proxy_justification?: string | null;
}

interface FacilityArchetypeSummary {
  id: string;
  slug: string;
  display_name: string;
  source_citation: string;
  source_url: string | null;
}

interface ProxyAllocation {
  id: string;
  data_collection_mode: 'archetype_proxy' | 'hybrid';
  reporting_period_start: string;
  reporting_period_end: string;
  product_id: string;
  product_name?: string | null;
  archetype_display_name?: string | null;
}

interface DataContract {
  id: string;
  utility_type: string;
  frequency: string;
  data_quality: string;
}

interface UtilityDataEntry {
  id: string;
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_quality: string;
  calculated_scope: string;
  notes: string | null;
  created_at: string;
  reporting_session_id: string | null;
  activity_date?: string | null;
}

interface FacilityActivityEntry {
  id: string;
  activity_category: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_provenance: string;
  notes: string | null;
  created_at: string;
  water_source_type?: string;
  water_classification?: string;
  waste_category?: string;
  waste_treatment_method?: string;
  reporting_session_id?: string | null;
  activity_date?: string | null;
}

/** Quiet mono tab trigger: uppercase, tracked, 3px underline when active. */
const MONO_TAB =
  'relative -mb-px rounded-none border-b-[3px] border-transparent bg-transparent px-0 pb-2.5 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim shadow-none transition-colors data-[state=active]:border-room-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

const MONO_TAB_LIST =
  'h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Typographic provenance state: primary data reads good, the rest attention. */
function ProvenanceChip({ provenance }: { provenance: string | null | undefined }) {
  const label = provenance?.includes('verified')
    ? 'Verified'
    : provenance?.includes('measured')
      ? 'Measured'
      : provenance?.includes('allocated')
        ? 'Allocated'
        : provenance?.includes('modelled')
          ? 'Modelled'
          : null;
  if (!label) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <StateChip tone={provenance?.includes('primary') ? 'good' : 'attention'}>{label}</StateChip>
  );
}

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.id as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [archetype, setArchetype] = useState<FacilityArchetypeSummary | null>(null);
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [utilityData, setUtilityData] = useState<UtilityDataEntry[]>([]);
  const [waterData, setWaterData] = useState<FacilityActivityEntry[]>([]);
  const [wasteData, setWasteData] = useState<FacilityActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("data-entry");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    table: 'utility_data_entries' | 'facility_activity_entries';
    activity_date: string;
    quantity: string;
    notes: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [sourcingDialogOpen, setSourcingDialogOpen] = useState(false);
  const [proxyAllocations, setProxyAllocations] = useState<ProxyAllocation[]>([]);
  const [rolloverCandidates, setRolloverCandidates] = useState<Array<{ utilityType: string }>>([]);
  const [rolloverBusy, setRolloverBusy] = useState(false);

  // Tell Rosa about this facility so questions like "is the data quality
  // good enough for CSRD?" or "what's missing for this site?" can be
  // answered without the user having to copy-paste anything.
  const rosaSlice = useMemo(() => {
    if (!facility) return null;
    return {
      id: 'facility-detail',
      label: `Facility: ${facility.name}`,
      priority: 9,
      data: {
        facility: {
          id: facility.id,
          name: facility.name,
          functions: facility.functions,
          operational_control: facility.operational_control,
          location: [facility.address_city, facility.address_country].filter(Boolean).join(', '),
          country: facility.address_country,
          data_collection_mode: facility.default_data_collection_mode ?? null,
          archetype: archetype ? { display_name: archetype.display_name, source_citation: archetype.source_citation } : null,
        },
        active_tab: activeTab,
        data_contracts: dataContracts.map(c => ({
          utility_type: c.utility_type,
          frequency: c.frequency,
          data_quality: c.data_quality,
        })),
        utility_entry_count: utilityData.length,
        water_entry_count: waterData.length,
        waste_entry_count: wasteData.length,
        proxy_allocations_count: proxyAllocations.length,
        notes: facility.default_data_collection_mode === 'archetype_proxy'
          ? 'This facility uses an archetype proxy for emissions data; consider when accuracy matters.'
          : 'This facility records primary data.',
      },
    };
  }, [facility, archetype, activeTab, dataContracts, utilityData, waterData, wasteData, proxyAllocations]);

  useRosaPageContext(rosaSlice);

  const loadFacilityData = useCallback(async () => {
    try {
      setLoading(true);

      const [facilityResult, contractsResult, utilityResult, waterResult, wasteResult] = await Promise.all([
        supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single(),
        supabase
          .from('facility_data_contracts')
          .select('*')
          .eq('facility_id', facilityId),
        supabase
          .from('utility_data_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .order('reporting_period_start', { ascending: false }),
        supabase
          .from('facility_activity_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .in('activity_category', ['water_intake', 'water_discharge', 'water_recycled'])
          .order('reporting_period_start', { ascending: false }),
        supabase
          .from('facility_activity_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
          .order('reporting_period_start', { ascending: false }),
      ]);

      if (facilityResult.error) throw facilityResult.error;
      if (contractsResult.error) throw contractsResult.error;
      if (utilityResult.error) throw utilityResult.error;
      if (waterResult.error) throw waterResult.error;
      if (wasteResult.error) throw wasteResult.error;

      setFacility(facilityResult.data);
      setDataContracts(contractsResult.data || []);
      setUtilityData(utilityResult.data || []);
      setWaterData(waterResult.data || []);
      setWasteData(wasteResult.data || []);

      const archetypeId = (facilityResult.data as any)?.default_archetype_id;
      if (archetypeId) {
        const { data: arch } = await supabase
          .from('facility_archetypes')
          .select('id, slug, display_name, source_citation, source_url')
          .eq('id', archetypeId)
          .maybeSingle();
        setArchetype((arch as FacilityArchetypeSummary | null) ?? null);
      } else {
        setArchetype(null);
      }

      const { data: allocRows } = await supabase
        .from('contract_manufacturer_allocations')
        .select('id, data_collection_mode, reporting_period_start, reporting_period_end, product_id, archetype_id, superseded_at, products(name), facility_archetypes(display_name)')
        .eq('facility_id', facilityId)
        .is('superseded_at', null)
        .in('data_collection_mode', ['archetype_proxy', 'hybrid']);

      const rows = (allocRows || []).map((r: any) => ({
        id: r.id,
        data_collection_mode: r.data_collection_mode,
        reporting_period_start: r.reporting_period_start,
        reporting_period_end: r.reporting_period_end,
        product_id: r.product_id,
        product_name: r.products?.name ?? null,
        archetype_display_name: r.facility_archetypes?.display_name ?? null,
      })) as ProxyAllocation[];
      setProxyAllocations(rows);
    } catch (error: any) {
      console.error('Error loading facility data:', error);
      toast.error(error.message || 'Failed to load facility data');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      loadFacilityData();
    }
  }, [facilityId, loadFacilityData]);

  // Estimate-first utilities (Pillar 2): a facility with last year's data
  // but gaps this year gets a one-click "fill in as estimates" offer,
  // instead of sitting empty until someone opens the manual rollover dialog.
  const loadRolloverCandidates = useCallback(async () => {
    if (!facilityId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/facilities/${facilityId}/auto-rollover`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      setRolloverCandidates(res.ok ? (data.candidates || []) : []);
    } catch {
      setRolloverCandidates([]);
    }
  }, [facilityId]);

  useEffect(() => {
    loadRolloverCandidates();
  }, [loadRolloverCandidates]);

  const applyRollover = async () => {
    setRolloverBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/facilities/${facilityId}/auto-rollover`, {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to fill in the estimates');
      toast.success(`${data.written} ${data.written === 1 ? 'entry' : 'entries'} filled in as estimates`);
      setRolloverCandidates([]);
      await loadFacilityData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to fill in the estimates');
    } finally {
      setRolloverBusy(false);
    }
  };

  // One-click "Confirm" for an estimated entry: flips data_quality to
  // 'actual' with the same value — the reading turns out to be right, no
  // edit needed. "Correct" (the existing pencil icon) opens the full editor
  // instead, for when the value itself needs to change.
  const confirmUtilityEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('utility_data_entries')
        .update({ data_quality: 'actual' })
        .eq('id', entryId);
      if (error) throw error;
      toast.success('Confirmed');
      await loadFacilityData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm');
    }
  };

  const handleDeleteEntry = async (entryId: string, table: 'utility_data_entries' | 'facility_activity_entries') => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Entry deleted');
      await loadFacilityData();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message || 'Failed to delete entry');
    }
  };

  const openEditDialog = (
    entry: UtilityDataEntry | FacilityActivityEntry,
    table: 'utility_data_entries' | 'facility_activity_entries'
  ) => {
    setEditingEntry({
      id: entry.id,
      table,
      activity_date: entry.activity_date || '',
      quantity: String(entry.quantity),
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setEditSaving(true);

    try {
      const updates: Record<string, any> = {
        quantity: parseFloat(editingEntry.quantity),
        notes: editingEntry.notes || null,
        activity_date: editingEntry.activity_date || null,
      };

      const { error } = await supabase
        .from(editingEntry.table)
        .update(updates)
        .eq('id', editingEntry.id);

      if (error) throw error;

      toast.success('Entry updated');
      setEditingEntry(null);
      await loadFacilityData();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error(error.message || 'Failed to update entry');
    } finally {
      setEditSaving(false);
    }
  };

  const getUtilityLabel = (value: string) => {
    return UTILITY_TYPES.find(u => u.value === value)?.label || value;
  };

  const handleDeleteFacility = async () => {
    if (!facility) return;

    if (!confirm(`Are you sure you want to delete "${facility.name}"? This action cannot be undone and will remove all associated data.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility deleted successfully');
      router.push('/company/facilities');
    } catch (error: any) {
      console.error('Error deleting facility:', error);
      toast.error(error.message || 'Failed to delete facility');
    }
  };

  if (loading) {
    return <PageLoader message="Loading facility..." />;
  }

  if (!facility) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-studio-dim">Facility not found.</p>
        <PillButton variant="outline" size="sm" className="mt-3" href="/company/facilities">
          All facilities
        </PillButton>
      </div>
    );
  }

  const totalEntries = utilityData.length + waterData.length + wasteData.length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <Link
          href="/company/facilities"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
        >
          &larr; All facilities
        </Link>
      </div>

      <Statement eyebrow="THE WORKBENCH · FACILITY" headline={<>{facility.name}.</>}>
        <BigNumber
          size="display"
          value={totalEntries.toLocaleString('en-GB')}
          label={totalEntries === 1 ? 'ENTRY LOGGED' : 'ENTRIES LOGGED'}
        />
      </Statement>

      <div className="mt-4 mb-10 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted-foreground">
          {[facility.address_city, facility.address_country].filter(Boolean).join(', ')}
        </span>
        {facility.functions.map((func: string) => (
          <span key={func} className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            {func}
          </span>
        ))}
        <StateChip tone={facility.operational_control === 'owned' ? 'good' : 'quiet'}>
          {facility.operational_control === 'owned' ? 'Owned' : 'Third party'}
        </StateChip>
        <FacilityBrewwLinkBadge facilityId={facility.id} />
      </div>

      {rolloverCandidates.length > 0 && (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-display text-sm font-semibold text-foreground">
                {rolloverCandidates.length} {rolloverCandidates.length === 1 ? 'month is' : 'months are'} missing this year, but you had them last year.
              </p>
              <p className="text-sm text-muted-foreground">
                Fill them in as estimates from last year&apos;s figures — chipped <span className="font-medium">Estimated</span> until you confirm or correct each one.
              </p>
            </div>
            <PillButton size="sm" onClick={applyRollover} disabled={rolloverBusy}>
              {rolloverBusy ? 'Filling in…' : 'Fill in the estimates'}
            </PillButton>
          </div>
        </Panel>
      )}

      {facility.operational_control === 'third_party' &&
        (!facility.default_data_collection_mode || facility.default_data_collection_mode === 'primary') && (
          <Panel className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-display text-sm font-semibold text-foreground">
                  Can this facility share their energy and water data with you?
                </p>
                <p className="text-sm text-muted-foreground">
                  If yes, keep entering real data below. If not, tell us and we&apos;ll use an industry average so you can still run an LCA for products made here.
                </p>
              </div>
              <PillButton size="sm" onClick={() => setSourcingDialogOpen(true)}>
                Set up data source
              </PillButton>
            </div>
          </Panel>
      )}

      {facility.default_data_collection_mode && facility.default_data_collection_mode !== 'primary' && (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <StateChip tone="attention">Industry average</StateChip>
              <p className="font-display text-sm font-semibold text-foreground">
                {facility.default_data_collection_mode === 'archetype_proxy'
                  ? 'Using an industry average for this facility'
                  : 'Using an industry average to fill data gaps'}
                {archetype ? `: ${archetype.display_name}` : ''}.
              </p>
              <p className="text-sm text-muted-foreground">
                You told us this facility can&apos;t share its real energy and water data, so LCAs for products made here use a published industry average instead. Reports will clearly say this number is an estimate. You don&apos;t need to enter data on this page. If the facility starts sharing real data later, you can switch over and the footprint will update.
              </p>
              {facility.default_proxy_justification && (
                <p className="text-xs italic text-muted-foreground">
                  Your reason: {facility.default_proxy_justification}
                </p>
              )}
              {archetype?.source_url && (
                <a
                  href={archetype.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-room-accent hover:underline"
                >
                  Where this average comes from: {archetype.source_citation}
                </a>
              )}
            </div>
            <PillButton variant="outline" size="sm" onClick={() => setSourcingDialogOpen(true)}>
              Change
            </PillButton>
          </div>
        </Panel>
      )}

      {proxyAllocations.length > 0 && (
        <section className="mb-8 border-t border-border pt-5">
          <Eyebrow className="mb-1">Got real data for this facility?</Eyebrow>
          <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
            These product LCAs are currently using an industry average for this facility. If the facility has now shared real numbers with you, switch them over here. Your old reports will still add up because we keep the proxy version for audit.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Reporting period</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Industry average used</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxyAllocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.product_name || '(unknown product)'}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(a.reporting_period_start).toLocaleDateString()}
                    {' to '}
                    {new Date(a.reporting_period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <StateChip tone="attention">
                      {a.data_collection_mode === 'hybrid' ? 'Partial' : 'Industry average'}
                    </StateChip>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.archetype_display_name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <UpgradeFacilityDataButton
                      allocationId={a.id}
                      facilityName={facility.name}
                      archetypeName={a.archetype_display_name ?? undefined}
                      onUpgraded={loadFacilityData}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {facility.operational_control === 'third_party' && (
        <FacilityDataSourcingDialog
          open={sourcingDialogOpen}
          onOpenChange={setSourcingDialogOpen}
          facilityId={facility.id}
          initialMode={(facility.default_data_collection_mode as any) || 'primary'}
          initialArchetypeId={facility.default_archetype_id ?? null}
          initialJustification={facility.default_proxy_justification ?? ''}
          onSaved={loadFacilityData}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={MONO_TAB_LIST}>
          <TabsTrigger value="data-entry" className={MONO_TAB}>
            Data entry
          </TabsTrigger>
          <TabsTrigger value="production" className={MONO_TAB}>
            Production
          </TabsTrigger>
          <TabsTrigger value="run-data" className={MONO_TAB}>
            Run data
          </TabsTrigger>
          <TabsTrigger value="history" className={MONO_TAB}>
            History
          </TabsTrigger>
          <TabsTrigger value="energy" className={MONO_TAB}>
            Energy &amp; grid
          </TabsTrigger>
          <TabsTrigger value="overview" className={MONO_TAB}>
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="energy" className="space-y-6 mt-8">
          <FacilityEnergyTab facilityId={facilityId} />
        </TabsContent>

        {/* ============================================================= */}
        {/* DATA ENTRY TAB */}
        {/* ============================================================= */}
        <TabsContent value="data-entry" className="space-y-6 mt-8">
          <DirectDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* PRODUCTION TAB */}
        {/* ============================================================= */}
        <TabsContent value="production" className="space-y-6 mt-8">
          <ProductionVolumeManager
            facilityId={facilityId}
            organizationId={facility.organization_id}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* RUN DATA TAB */}
        {/* ============================================================= */}
        <TabsContent value="run-data" className="space-y-6 mt-8">
          <ProductionRunDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* HISTORY TAB */}
        {/* ============================================================= */}
        <TabsContent value="history" className="space-y-10 mt-8">
          {/* Visual overview of the last 12 months: coverage grid + trend chart */}
          <FacilityDataDashboard
            utilityData={utilityData}
            waterData={waterData}
            wasteData={wasteData}
            dataContracts={dataContracts}
          />

          {/* Utility history */}
          <section className="border-t border-border pt-5">
            <Eyebrow className="mb-1">Utility data</Eyebrow>
            <p className="mb-4 text-xs text-muted-foreground">
              All energy and fuel consumption recorded for this facility.
            </p>
            {utilityData.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-studio-dim">No utility data recorded yet.</p>
                <PillButton variant="ghost" size="sm" className="-ml-3 mt-1" onClick={() => setActiveTab('data-entry')}>
                  Add data
                </PillButton>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utility type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilityData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {getUtilityLabel(entry.utility_type)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entry.activity_date ? (
                            <>{new Date(entry.activity_date).toLocaleDateString()}</>
                          ) : (
                            <>
                              {new Date(entry.reporting_period_start).toLocaleDateString()} -
                              <br />
                              {new Date(entry.reporting_period_end).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {entry.quantity.toLocaleString()} {entry.unit}
                      </TableCell>
                      <TableCell>
                        <StateChip tone="quiet">{entry.calculated_scope || '-'}</StateChip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <SharedProvenanceChip provenance={provenanceFromDataQuality(entry.data_quality)} compact />
                          {entry.data_quality !== 'actual' && (
                            <button
                              type="button"
                              onClick={() => confirmUtilityEntry(entry.id)}
                              className="font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim hover:text-foreground"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(entry, 'utility_data_entries')}
                            title="Correct"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id, 'utility_data_entries')}
                          >
                            <Trash2 className="h-4 w-4 text-studio-stale" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Water history */}
          <section className="border-t border-border pt-5">
            <Eyebrow className="mb-1">Water data</Eyebrow>
            <p className="mb-4 text-xs text-muted-foreground">
              All water intake, discharge and recycling recorded for this facility.
            </p>
            {waterData.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-studio-dim">No water data recorded yet.</p>
                <PillButton variant="ghost" size="sm" className="-ml-3 mt-1" onClick={() => setActiveTab('data-entry')}>
                  Add data
                </PillButton>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Data quality</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waterData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.activity_category === 'water_intake' && 'Water intake'}
                        {entry.activity_category === 'water_discharge' && 'Wastewater discharge'}
                        {entry.activity_category === 'water_recycled' && 'Recycled water'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entry.activity_date ? (
                            <>{new Date(entry.activity_date).toLocaleDateString()}</>
                          ) : (
                            <>
                              {new Date(entry.reporting_period_start).toLocaleDateString()} -
                              <br />
                              {new Date(entry.reporting_period_end).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {entry.quantity.toLocaleString()} {entry.unit}
                      </TableCell>
                      <TableCell>
                        {entry.water_source_type ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                            {entry.water_source_type.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProvenanceChip provenance={entry.data_provenance} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(entry, 'facility_activity_entries')}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id, 'facility_activity_entries')}
                          >
                            <Trash2 className="h-4 w-4 text-studio-stale" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Waste history */}
          <section className="border-t border-border pt-5">
            <Eyebrow className="mb-1">Waste data</Eyebrow>
            <p className="mb-4 text-xs text-muted-foreground">
              All waste generation, recycling and disposal recorded for this facility.
            </p>
            {wasteData.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-studio-dim">No waste data recorded yet.</p>
                <PillButton variant="ghost" size="sm" className="-ml-3 mt-1" onClick={() => setActiveTab('data-entry')}>
                  Add data
                </PillButton>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waste category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Treatment method</TableHead>
                    <TableHead>Data quality</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.activity_category === 'waste_general' && 'General waste'}
                        {entry.activity_category === 'waste_hazardous' && 'Hazardous waste'}
                        {entry.activity_category === 'waste_recycling' && 'Recycling'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entry.activity_date ? (
                            <>{new Date(entry.activity_date).toLocaleDateString()}</>
                          ) : (
                            <>
                              {new Date(entry.reporting_period_start).toLocaleDateString()} -
                              <br />
                              {new Date(entry.reporting_period_end).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {entry.quantity.toLocaleString()} {entry.unit}
                      </TableCell>
                      <TableCell>
                        {entry.waste_treatment_method ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                            {entry.waste_treatment_method.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProvenanceChip provenance={entry.data_provenance} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(entry, 'facility_activity_entries')}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id, 'facility_activity_entries')}
                          >
                            <Trash2 className="h-4 w-4 text-studio-stale" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Production run resource data history */}
          <ProductionRunDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />

          {/* Edit entry dialog */}
          <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit entry</DialogTitle>
              </DialogHeader>
              {editingEntry && (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Activity date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editingEntry.activity_date}
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, activity_date: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      The specific date of this reading (e.g. invoice date, meter reading date)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-quantity">Quantity</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      step="any"
                      value={editingEntry.quantity}
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Input
                      id="edit-notes"
                      value={editingEntry.notes}
                      placeholder="Optional notes"
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <PillButton variant="ghost" onClick={() => setEditingEntry(null)}>
                  Cancel
                </PillButton>
                <PillButton onClick={handleSaveEdit} disabled={editSaving}>
                  {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </PillButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================= */}
        {/* OVERVIEW TAB */}
        {/* ============================================================= */}
        <TabsContent value="overview" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <Eyebrow>The facility</Eyebrow>
                  <div className="flex gap-2">
                    <PillButton variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                      Edit facility
                    </PillButton>
                    <PillButton
                      variant="ghost"
                      size="sm"
                      className="text-studio-stale hover:text-studio-stale"
                      onClick={handleDeleteFacility}
                    >
                      Delete facility
                    </PillButton>
                  </div>
                </div>

                <dl className="divide-y divide-border">
                  <div className="flex items-start justify-between gap-6 py-3">
                    <dt className="pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                      Operational control
                    </dt>
                    <dd>
                      <StateChip tone={facility.operational_control === 'owned' ? 'good' : 'quiet'}>
                        {facility.operational_control === 'owned' ? 'Owned' : 'Third party'}
                      </StateChip>
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-6 py-3">
                    <dt className="pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                      Address
                    </dt>
                    <dd className="text-right text-sm text-foreground">
                      {facility.address_line1}
                      <br />
                      {facility.address_city}, {facility.address_postcode}
                      <br />
                      {facility.address_country}
                    </dd>
                  </div>

                  <div className="py-3">
                    <dt className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                      Data contracts
                    </dt>
                    <dd>
                      {dataContracts.length === 0 ? (
                        <p className="text-sm text-studio-dim">No data contracts defined.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {dataContracts.map((contract) => (
                            <div key={contract.id} className="flex items-center justify-between py-2">
                              <span className="text-sm text-foreground">{getUtilityLabel(contract.utility_type)}</span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                                {contract.frequency} · {contract.data_quality}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
            <div className="lg:col-span-1">
              <DataQualityConfidenceCard
                facilityId={facilityId}
                organizationId={facility.organization_id}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <EditFacilityDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        facilityId={facilityId}
        onSuccess={loadFacilityData}
      />
    </div>
  );
}
