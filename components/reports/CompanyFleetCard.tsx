"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Plus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CompanyFleetCardProps {
  totalCO2e?: number;
  year: number;
}

export function CompanyFleetCard({ totalCO2e = 0, year }: CompanyFleetCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleOpenFleet = () => {
    router.push("/company/fleet");
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-600 group"
        onClick={() => setIsOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Company Fleet & Vehicles</CardTitle>
                <div className="flex gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs">Scope 1</Badge>
                  <Badge variant="default" className="text-xs">Scope 2</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalCO2e.toFixed(3)} tCO₂e
              </div>
              <p className="text-xs text-muted-foreground mt-1">Vehicle journey emissions</p>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-muted-foreground">
                Track ICE vehicles (Scope 1) and electric vehicles (Scope 2)
              </p>
            </div>

            <Button size="sm" variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}>
              <Plus className="h-3 w-3 mr-2" />
              Manage Fleet
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Company Fleet & Vehicles
            </DialogTitle>
            <DialogDescription>
              Track emissions from your organizational fleet with automatic scope routing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Smart Scope Routing
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    Vehicle emissions are automatically routed to the correct scope based on propulsion type:
                  </p>
                  <div className="space-y-1 ml-4 text-xs text-blue-800 dark:text-blue-200">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Scope 1</Badge>
                      <span>ICE vehicles (Diesel, Petrol) - Direct combustion emissions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">Scope 2</Badge>
                      <span>BEV vehicles (Electric) - Indirect grid electricity emissions</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">What you can do:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Register vehicles with propulsion type classification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Log journeys with automatic emission calculations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>View emissions split by Scope 1 and Scope 2</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Full audit trail using DEFRA 2025 emission factors</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleOpenFleet} className="flex-1">
                <Car className="h-4 w-4 mr-2" />
                Open Fleet Management
              </Button>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
