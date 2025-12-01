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

interface OpenLCAConfig {
  serverUrl: string;
  databaseName: string;
  enabled: boolean;
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
  const [config, setConfig] = useState<OpenLCAConfig>({
    serverUrl: "http://localhost:8080",
    databaseName: "ecoinvent_3.9",
    enabled: false,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem("openlca_config");
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      } catch (error) {
        console.error("Failed to parse saved OpenLCA config:", error);
      }
    }
  }, [open]);

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${config.serverUrl}/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "get/descriptors",
          params: {
            "@type": "Process",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Unknown error");
      }

      setTestResult({
        success: true,
        message: `Successfully connected! Found ${
          Array.isArray(data.result) ? data.result.length : 0
        } processes.`,
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

  const handleSave = () => {
    localStorage.setItem("openlca_config", JSON.stringify(config));
    onSave?.(config);
    onOpenChange(false);
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
            Configure connection to your local OpenLCA instance with Ecoinvent database.
            This enables access to comprehensive LCA data for materials and processes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Setup Required:</strong> You need to have OpenLCA installed locally
              with the Ecoinvent 3.9+ database imported and the IPC server running.
              Visit{" "}
              <a
                href="https://www.openlca.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                openlca.org
              </a>{" "}
              to download.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable OpenLCA Integration</Label>
                <p className="text-xs text-muted-foreground">
                  Connect to local OpenLCA server for Ecoinvent data
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
