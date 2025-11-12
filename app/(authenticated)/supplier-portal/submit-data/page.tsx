'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileText,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';

interface ProductionRun {
  run_id: string;
  product_name: string;
  energy_kwh?: number;
  waste_kg?: number;
  evidence_url?: string;
}

interface Tier1FormData {
  productionRuns: ProductionRun[];
}

interface Tier2FormData {
  total_facility_kwh: number;
  total_facility_waste_kg: number;
  evidence_url: string;
}

interface Tier3FormData {
  monetary_value: number;
  currency: string;
}

type SubmissionTier = 'tier1' | 'tier2' | 'tier3' | null;

export default function SupplierDataSubmissionPage() {
  const { currentOrganization } = useOrganization();
  const [reportingPeriod, setReportingPeriod] = useState<Date | null>(null);
  const [submissionTier, setSubmissionTier] = useState<SubmissionTier>(null);
  const [isAttested, setIsAttested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  const [tier1Data, setTier1Data] = useState<ProductionRun[]>([]);
  const [tier2Data, setTier2Data] = useState<Tier2FormData>({
    total_facility_kwh: 0,
    total_facility_waste_kg: 0,
    evidence_url: '',
  });
  const [tier3Data, setTier3Data] = useState<Tier3FormData>({
    monetary_value: 0,
    currency: 'GBP',
  });

  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (reportingPeriod && submissionTier === 'tier1') {
      fetchProductionRuns();
    }
  }, [reportingPeriod, submissionTier]);

  const fetchProductionRuns = async () => {
    if (!currentOrganization?.id || !reportingPeriod) return;

    setIsLoadingRuns(true);
    try {
      const formattedPeriod = format(reportingPeriod, 'yyyy-MM-dd');

      const runsData: ProductionRun[] = [
        { run_id: 'run-001', product_name: 'Product A - Batch 2025-11' },
        { run_id: 'run-002', product_name: 'Product B - Batch 2025-11' },
      ];

      setProductionRuns(runsData);
      setTier1Data(runsData.map(run => ({ ...run, energy_kwh: 0, waste_kg: 0, evidence_url: '' })));
    } catch (error) {
      console.error('Error fetching production runs:', error);
      toast.error('Failed to load production runs');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const handleFileUpload = async (file: File, context: string, index?: number) => {
    const uploadKey = index !== undefined ? `${context}-${index}` : context;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('You must be logged in to upload files');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${currentOrganization?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('supplier-evidence')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('supplier-evidence')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      if (context === 'tier1' && index !== undefined) {
        setTier1Data(prev => {
          const updated = [...prev];
          updated[index].evidence_url = publicUrl;
          return updated;
        });
      } else if (context === 'tier2') {
        setTier2Data(prev => ({ ...prev, evidence_url: publicUrl }));
      }

      toast.success('File uploaded successfully');
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleTier1DataChange = (index: number, field: keyof ProductionRun, value: any) => {
    setTier1Data(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateTier1 = (): boolean => {
    return tier1Data.every(run => {
      const hasEnergy = typeof run.energy_kwh === 'number' && run.energy_kwh >= 0;
      const hasWaste = typeof run.waste_kg === 'number' && run.waste_kg >= 0;
      return hasEnergy && hasWaste;
    });
  };

  const validateTier2 = (): boolean => {
    return (
      tier2Data.total_facility_kwh > 0 &&
      tier2Data.total_facility_waste_kg >= 0 &&
      tier2Data.evidence_url.length > 0
    );
  };

  const validateTier3 = (): boolean => {
    return tier3Data.monetary_value > 0 && tier3Data.currency.length > 0;
  };

  const isFormValid = (): boolean => {
    if (!isAttested || !reportingPeriod || !submissionTier) return false;

    switch (submissionTier) {
      case 'tier1':
        return validateTier1();
      case 'tier2':
        return validateTier2();
      case 'tier3':
        return validateTier3();
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!reportingPeriod || !submissionTier || !currentOrganization?.id) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const formattedPeriod = format(reportingPeriod, 'yyyy-MM-dd');
      let payload: any = {
        reporting_period: formattedPeriod,
      };

      switch (submissionTier) {
        case 'tier1':
          payload.allocation_method = 'direct_apportionment';
          payload.payload = tier1Data.map(run => ({
            run_id: run.run_id,
            energy_kwh: run.energy_kwh,
            waste_kg: run.waste_kg,
            evidence_url: run.evidence_url,
          }));
          break;
        case 'tier2':
          payload.allocation_method = 'economic_allocation';
          payload.payload = {
            total_facility_kwh: tier2Data.total_facility_kwh,
            total_facility_waste_kg: tier2Data.total_facility_waste_kg,
            evidence_url: tier2Data.evidence_url,
          };
          break;
        case 'tier3':
          payload.allocation_method = 'spend_based';
          payload.payload = {
            monetary_value: tier3Data.monetary_value,
            currency: tier3Data.currency,
          };
          break;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-supplier-data`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      toast.success('Data submitted successfully');

      setReportingPeriod(null);
      setSubmissionTier(null);
      setIsAttested(false);
      setTier1Data([]);
      setTier2Data({ total_facility_kwh: 0, total_facility_waste_kg: 0, evidence_url: '' });
      setTier3Data({ monetary_value: 0, currency: 'GBP' });
    } catch (error: any) {
      console.error('Error submitting data:', error);
      toast.error(error.message || 'Failed to submit data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setSubmissionTier(null);
    setIsAttested(false);
    setTier1Data([]);
    setTier2Data({ total_facility_kwh: 0, total_facility_waste_kg: 0, evidence_url: '' });
    setTier3Data({ monetary_value: 0, currency: 'GBP' });
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit Monthly Activity Data</h1>
        <p className="text-muted-foreground mt-2">
          Provide your activity data for the reporting period using one of three submission tiers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Reporting Period</CardTitle>
          <CardDescription>Choose the month you are reporting data for</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !reportingPeriod && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {reportingPeriod ? format(reportingPeriod, 'MMMM yyyy') : 'Select month'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={reportingPeriod || undefined}
                onSelect={(date) => {
                  setReportingPeriod(date || null);
                  resetWizard();
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {reportingPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Choose Submission Tier</CardTitle>
            <CardDescription>
              Select the data quality tier that matches your available information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <Card
                className={cn(
                  'cursor-pointer transition-all hover:border-primary',
                  submissionTier === 'tier1' && 'border-primary ring-2 ring-primary'
                )}
                onClick={() => {
                  setSubmissionTier('tier1');
                  setIsAttested(false);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Direct Apportionment</CardTitle>
                      <Badge variant="default" className="mt-2 bg-green-600">
                        High Quality
                      </Badge>
                    </div>
                    {submissionTier === 'tier1' && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    Provide data for specific production runs you performed for your customer. This is
                    the most accurate and preferred method.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all hover:border-primary',
                  submissionTier === 'tier2' && 'border-primary ring-2 ring-primary'
                )}
                onClick={() => {
                  setSubmissionTier('tier2');
                  setIsAttested(false);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Facility Allocation</CardTitle>
                      <Badge variant="secondary" className="mt-2 bg-amber-500 text-white">
                        Medium Quality
                      </Badge>
                    </div>
                    {submissionTier === 'tier2' && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    Provide total data for your entire facility. Your customer will then allocate their
                    specific share.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all hover:border-primary',
                  submissionTier === 'tier3' && 'border-primary ring-2 ring-primary'
                )}
                onClick={() => {
                  setSubmissionTier('tier3');
                  setIsAttested(false);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Spend-Based Estimate</CardTitle>
                      <Badge variant="destructive" className="mt-2">
                        Low Quality
                      </Badge>
                    </div>
                    {submissionTier === 'tier3' && (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    If no activity data is available, provide the total amount your customer paid you
                    for services in this period.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {submissionTier === 'tier1' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Enter Production Run Data</CardTitle>
            <CardDescription>
              Provide activity data for each production run performed for your customer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tier1Data.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Production Runs</AlertTitle>
                <AlertDescription>
                  No production runs found for the selected period.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {tier1Data.map((run, index) => (
                  <Card key={run.run_id} className="border-muted">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{run.product_name}</CardTitle>
                      <CardDescription className="text-xs">Run ID: {run.run_id}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`energy-${index}`}>Energy (kWh) *</Label>
                          <Input
                            id={`energy-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={run.energy_kwh || ''}
                            onChange={(e) =>
                              handleTier1DataChange(index, 'energy_kwh', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`waste-${index}`}>Waste (kg) *</Label>
                          <Input
                            id={`waste-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={run.waste_kg || ''}
                            onChange={(e) =>
                              handleTier1DataChange(index, 'waste_kg', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Evidence Upload (Optional)</Label>
                        {run.evidence_url ? (
                          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm flex-1">File uploaded</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTier1DataChange(index, 'evidence_url', '')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed rounded-lg p-4">
                            <input
                              type="file"
                              id={`file-${index}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, 'tier1', index);
                              }}
                              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                            />
                            <label
                              htmlFor={`file-${index}`}
                              className="flex flex-col items-center cursor-pointer"
                            >
                              {uploadingFiles[`tier1-${index}`] ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                  <span className="text-sm text-muted-foreground">
                                    Click to upload evidence
                                  </span>
                                </>
                              )}
                            </label>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {submissionTier === 'tier2' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Enter Facility-Wide Data</CardTitle>
            <CardDescription>
              Provide total activity data for your entire facility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-amber-500 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Allocation Required</AlertTitle>
              <AlertDescription className="text-amber-800">
                You are providing total data for your facility. This data will be sent to your customer
                to review and allocate their share. It will not be final until they complete this action.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total-energy">Total Facility Energy (kWh) *</Label>
                <Input
                  id="total-energy"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier2Data.total_facility_kwh || ''}
                  onChange={(e) =>
                    setTier2Data((prev) => ({
                      ...prev,
                      total_facility_kwh: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total-waste">Total Facility Waste (kg) *</Label>
                <Input
                  id="total-waste"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier2Data.total_facility_waste_kg || ''}
                  onChange={(e) =>
                    setTier2Data((prev) => ({
                      ...prev,
                      total_facility_waste_kg: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Evidence Upload (Required) *</Label>
              {tier2Data.evidence_url ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm flex-1">File uploaded successfully</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTier2Data((prev) => ({ ...prev, evidence_url: '' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6">
                  <input
                    type="file"
                    id="tier2-file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'tier2');
                    }}
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                  />
                  <label htmlFor="tier2-file" className="flex flex-col items-center cursor-pointer">
                    {uploadingFiles['tier2'] ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm font-medium">Click to upload facility evidence</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          PDF, Image, or Spreadsheet
                        </span>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {submissionTier === 'tier3' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Enter Spend-Based Information</CardTitle>
            <CardDescription>Provide the monetary value paid by your customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Low Quality Data</AlertTitle>
              <AlertDescription>
                Spend-based data is the least accurate method and will be clearly labelled as an
                "Estimate" throughout the platform. Consider providing activity data (Tier 1 or 2) for
                better data quality.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monetary-value">Total Amount Paid *</Label>
                <Input
                  id="monetary-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier3Data.monetary_value || ''}
                  onChange={(e) =>
                    setTier3Data((prev) => ({
                      ...prev,
                      monetary_value: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={tier3Data.currency}
                  onValueChange={(value) =>
                    setTier3Data((prev) => ({ ...prev, currency: value }))
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {submissionTier && (
        <>
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Final Step: Attestation and Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="attestation"
                  checked={isAttested}
                  onCheckedChange={(checked) => setIsAttested(checked as boolean)}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="attestation"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I attest that the data provided is accurate and verifiable to the best of my
                    knowledge
                  </label>
                  <p className="text-xs text-muted-foreground">
                    This attestation creates an audit trail for data quality assurance
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!isFormValid() || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Data...
                  </>
                ) : (
                  'Submit Monthly Data'
                )}
              </Button>

              {!isFormValid() && isAttested && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please complete all required fields before submitting.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
