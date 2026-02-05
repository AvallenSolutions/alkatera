"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

interface OpenLCAConfig {
  serverUrl: string;
  databaseName: string;
  enabled: boolean;
  preferUnitProcesses?: boolean;
  withRegionalization?: boolean;
  defaultAllocationMethod?: string;
}

interface OpenLCAConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (config: OpenLCAConfig) => void;
}

export function OpenLCAConfigDialog({
  open,
  onOpenChange,
  onSave,
}: OpenLCAConfigDialogProps) {
  const { currentOrganization } = useOrganization();
  const [config, setConfig] = useState<OpenLCAConfig>({
    serverUrl: "http://localhost:8080",
    databaseName: "ecoinvent_312_cutoff",
    enabled: false,
    preferUnitProcesses: true,
    withRegionalization: true,
    defaultAllocationMethod: "economic",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open && currentOrganization?.id) {
      loadConfiguration();
    }
  }, [open, currentOrganization?.id]);

  const loadConfiguration = async () => {
    if (!currentOrganization?.id) return;

    const { data, error } = await supabase
      .from('openlca_configurations')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .single();

    if (data && !error) {
      setConfig({
        serverUrl: data.server_url,
        databaseName: data.database_name,
        enabled: data.enabled,
        preferUnitProcesses: data.prefer_unit_processes,
        withRegionalization: data.with_regionalization,
        defaultAllocationMethod: data.default_allocation_method,
      });
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Route test connection through server-side API
      // The browser cannot directly reach the cloud OpenLCA server (API key + TLS)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated - please sign in again");
      }

      const response = await fetch("/api/openlca/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      setTestResult({
        success: data.success,
        message: data.message,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to connect to OpenLCA server",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    setIsSaving(true);

    try {
      const { data: existing } = await supabase
        .from('openlca_configurations')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .single();

      const configData = {
        organization_id: currentOrganization.id,
        server_url: config.serverUrl,
        database_name: config.databaseName,
        enabled: config.enabled,
        prefer_unit_processes: config.preferUnitProcesses ?? true,
        with_regionalization: config.withRegionalization ?? true,
        default_allocation_method: config.defaultAllocationMethod || 'economic',
        last_health_check: testResult?.success ? new Date().toISOString() : null,
      };

      let error;

      if (existing) {
        ({ error } = await supabase
          .from('openlca_configurations')
          .update(configData)
          .eq('id', existing.id));
      } else {
        ({ error } = await supabase
          .from('openlca_configurations')
          .insert(configData));
      }

      if (error) {
        throw error;
      }

      toast.success('OpenLCA configuration saved successfully');
      onSave?.(config);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save OpenLCA configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            OpenLCA Server Configuration
          </DialogTitle>
          <DialogDescription>
            Configure connection to your OpenLCA server with Ecoinvent database.
            This enables access to comprehensive LCA data for materials and processes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Cloud Integration:</strong> Alkatera connects to a secure OpenLCA
              server powered by Ecoinvent 3.12 for comprehensive LCA data.
              The connection is managed server-side with API key authentication.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable OpenLCA Integration</Label>
                <p className="text-xs text-muted-foreground">
                  Connect to OpenLCA server for Ecoinvent data
                </p>
              </div>
              <Switch
                id="enabled"
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                placeholder="http://localhost:8080"
                value={config.serverUrl}
                onChange={(e) =>
                  setConfig({ ...config, serverUrl: e.target.value })
                }
                disabled={!config.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Default IPC server address (typically port 8080)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="databaseName">Database Name</Label>
              <Input
                id="databaseName"
                placeholder="ecoinvent_3.9"
                value={config.databaseName}
                onChange={(e) =>
                  setConfig({ ...config, databaseName: e.target.value })
                }
                disabled={!config.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Name of the Ecoinvent database in OpenLCA
              </p>
            </div>

            {config.enabled && (
              <div className="pt-2">
                <Button
                  onClick={testConnection}
                  disabled={isTesting || !config.serverUrl}
                  variant="outline"
                  className="w-full"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>

                {testResult && (
                  <Alert
                    className={`mt-3 ${
                      testResult.success
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription
                      className={`text-xs ${
                        testResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
                      }`}
                    >
                      {testResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium mb-2">Data Source Priority</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>1. Supplier Verified Data</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                  Highest Quality
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>2. Internal Staging Factors</span>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                  Verified
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>3. Ecoinvent Proxies</span>
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                  Standard
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>4. OpenLCA (Ecoinvent Live)</span>
                <Badge
                  variant="outline"
                  className={config.enabled ? "" : "opacity-50"}
                >
                  {config.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
