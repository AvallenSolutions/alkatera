"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HelpCircle, Upload, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface DQIScores {
  reliability: number;
  temporal: number;
  geographical: number;
  technological: number;
  completeness: number;
}

interface QuantifiedInputData {
  value: number;
  unit: string;
  dqi: DQIScores;
  evidenceUrl?: string;
}

interface QuantifiedInputWithDQIProps {
  label: string;
  unit: string;
  onUpdate: (data: QuantifiedInputData) => void;
  initialValue?: QuantifiedInputData;
}

const DQI_DESCRIPTIONS = {
  reliability: {
    title: "Reliability",
    description: "How trustworthy is the data source?",
    levels: {
      1: "Verified data from measurements or invoices",
      2: "Verified data but from less reliable sources",
      3: "Non-verified data or calculated data",
      4: "Qualified estimate (e.g., by industrial expert)",
      5: "Non-qualified estimate or unknown origin",
    },
  },
  temporal: {
    title: "Temporal Correlation",
    description: "How recent is the data?",
    levels: {
      1: "Less than 3 years old",
      2: "Less than 6 years old",
      3: "Less than 10 years old",
      4: "Less than 15 years old",
      5: "Age unknown or more than 15 years old",
    },
  },
  geographical: {
    title: "Geographical Correlation",
    description: "How well does the data match your location?",
    levels: {
      1: "Data from area under study",
      2: "Average data from larger area (e.g., country)",
      3: "Data from area with similar production conditions",
      4: "Data from area with slightly different conditions",
      5: "Data from unknown or very different area",
    },
  },
  technological: {
    title: "Technological Correlation",
    description: "How well does the data match your technology?",
    levels: {
      1: "Data from identical technology",
      2: "Data from similar technology",
      3: "Data from technology with some differences",
      4: "Data from different technology",
      5: "Data from unknown or very different technology",
    },
  },
  completeness: {
    title: "Completeness",
    description: "How complete is the data coverage?",
    levels: {
      1: "Representative data from sufficient sample",
      2: "Representative data but small sample",
      3: "Representative data from adequate sample",
      4: "Representative data but very small sample",
      5: "Unknown or incomplete data",
    },
  },
};

export function QuantifiedInputWithDQI({ label, unit, onUpdate, initialValue }: QuantifiedInputWithDQIProps) {
  const [value, setValue] = useState<number>(initialValue?.value || 0);
  const [dqi, setDqi] = useState<DQIScores>(
    initialValue?.dqi || {
      reliability: 3,
      temporal: 3,
      geographical: 3,
      technological: 3,
      completeness: 3,
    }
  );
  const [evidenceUrl, setEvidenceUrl] = useState<string | undefined>(initialValue?.evidenceUrl);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const needsEvidence = dqi.reliability === 1 || dqi.reliability === 2;

  useEffect(() => {
    const data: QuantifiedInputData = {
      value,
      unit,
      dqi,
      ...(evidenceUrl && { evidenceUrl }),
    };
    onUpdate(data);
  }, [value, dqi, evidenceUrl, unit, onUpdate]);

  const handleDQIChange = (dimension: keyof DQIScores, score: number) => {
    setDqi((prev) => ({ ...prev, [dimension]: score }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadEvidence = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("You must be logged in to upload evidence");
        return;
      }

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${session.session.user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("lca-evidence")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from("lca-evidence")
        .getPublicUrl(data.path);

      setEvidenceUrl(publicUrlData.publicUrl);
      toast.success("Evidence uploaded successfully");
      setShowUploadModal(false);
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload evidence");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white dark:bg-slate-900">
      <div className="space-y-2">
        <Label htmlFor={`value-${label}`} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`value-${label}`}
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            placeholder="Enter value"
            className="flex-1"
          />
          <div className="flex items-center px-3 bg-slate-100 dark:bg-slate-800 rounded-md text-sm text-slate-600 dark:text-slate-400">
            {unit}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Data Quality Indicators</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <p className="text-sm font-medium">Data Quality Indicators (DQI)</p>
                <p className="text-xs text-muted-foreground">
                  DQI scores help assess the reliability and representativeness of your data.
                  Lower scores (1-2) indicate higher quality data, whilst higher scores (4-5)
                  indicate more uncertain or estimated data.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(DQI_DESCRIPTIONS) as Array<keyof typeof DQI_DESCRIPTIONS>).map((dimension) => {
            const info = DQI_DESCRIPTIONS[dimension];
            return (
              <div key={dimension} className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor={`dqi-${dimension}`} className="text-xs">
                    {info.title}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{info.title}</p>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                        <div className="space-y-1 text-xs">
                          {Object.entries(info.levels).map(([score, desc]) => (
                            <div key={score} className="flex gap-2">
                              <span className="font-semibold">{score}:</span>
                              <span className="text-muted-foreground">{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select
                  value={dqi[dimension as keyof DQIScores].toString()}
                  onValueChange={(val) => handleDQIChange(dimension as keyof DQIScores, parseInt(val))}
                >
                  <SelectTrigger id={`dqi-${dimension}`} className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <SelectItem key={score} value={score.toString()} className="text-xs">
                        {score} - {info.levels[score as keyof typeof info.levels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      {needsEvidence && (
        <div className="space-y-2">
          <Alert>
            <AlertDescription className="text-xs">
              High-quality data (Reliability 1-2) requires supporting evidence
            </AlertDescription>
          </Alert>

          {evidenceUrl ? (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-700 dark:text-green-300">Evidence uploaded</span>
              <a
                href={evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View
              </a>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Evidence
            </Button>
          )}
        </div>
      )}

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Supporting Evidence</DialogTitle>
            <DialogDescription>
              Upload documentation that supports this data point (invoices, measurements, reports, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Accepted formats: PDF, Images, Excel, CSV (max 50MB)
              </p>
            </div>

            {selectedFile && (
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUploadEvidence} disabled={!selectedFile || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
