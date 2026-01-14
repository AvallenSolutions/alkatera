"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Factory,
  Link as LinkIcon,
  Package,
  PlayCircle,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useRouter } from "next/navigation";

interface AllocationOnboardingGuideProps {
  organizationId: string;
  onDismiss?: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: any;
  action: {
    label: string;
    href: string;
  };
}

export function AllocationOnboardingGuide({
  organizationId,
  onDismiss,
}: AllocationOnboardingGuideProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    checkOnboardingProgress();
  }, [organizationId]);

  const checkOnboardingProgress = async () => {
    try {
      setLoading(true);

      const [facilitiesRes, productsRes, assignmentsRes, allocationsRes, productionRes] =
        await Promise.all([
          supabase
            .from("facilities")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),

          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("is_draft", false),

          supabase
            .from("facility_product_assignments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),

          supabase
            .from("product_lca_production_sites")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),

          supabase
            .from("production_logs")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),
        ]);

      const hasFacilities = (facilitiesRes.count || 0) > 0;
      const hasProducts = (productsRes.count || 0) > 0;
      const hasAssignments = (assignmentsRes.count || 0) > 0;
      const hasAllocations = (allocationsRes.count || 0) > 0;
      const hasProduction = (productionRes.count || 0) > 0;

      const onboardingSteps: OnboardingStep[] = [
        {
          id: "facilities",
          title: "Add Your Facilities",
          description:
            "Start by adding the facilities where you manufacture your products (owned sites or contract manufacturers)",
          completed: hasFacilities,
          icon: Building2,
          action: {
            label: "Add Facilities",
            href: "/company/facilities",
          },
        },
        {
          id: "products",
          title: "Create Products",
          description:
            "Add the products you manufacture with their ingredients and packaging specifications",
          completed: hasProducts,
          icon: Package,
          action: {
            label: "Add Products",
            href: "/products/new",
          },
        },
        {
          id: "assignments",
          title: "Link Facilities & Products",
          description:
            "Define which products are manufactured at which facilities using the allocation matrix",
          completed: hasAssignments,
          icon: LinkIcon,
          action: {
            label: "Set Up Assignments",
            href: "/company/production-allocation",
          },
        },
        {
          id: "reporting",
          title: "Set Up Reporting Periods",
          description:
            "Define reporting periods for each facility and log their emissions, water, and waste data",
          completed: hasProduction,
          icon: Calendar,
          action: {
            label: "Configure Periods",
            href: "/company/facilities",
          },
        },
        {
          id: "allocations",
          title: "Allocate Emissions",
          description:
            "Allocate facility emissions to products based on production volumes and attribution ratios",
          completed: hasAllocations,
          icon: Factory,
          action: {
            label: "Start Allocating",
            href: "/company/production-allocation",
          },
        },
      ];

      setSteps(onboardingSteps);
    } catch (error) {
      console.error("Error checking onboarding progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isComplete = completedSteps === totalSteps;

  if (loading) {
    return null;
  }

  if (isComplete && !expanded) {
    return null;
  }

  if (!expanded) {
    return (
      <Card className="bg-gradient-to-r from-lime-500/10 to-green-500/10 border-lime-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-lime-400" />
              <div>
                <p className="text-sm font-medium text-white">Allocation Setup</p>
                <p className="text-xs text-slate-400">
                  {completedSteps}/{totalSteps} steps complete
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
              className="text-lime-400"
            >
              Show Guide
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-lime-500/5 via-green-500/5 to-lime-500/5 border-lime-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-lime-400" />
              {isComplete
                ? "Setup Complete!"
                : "Get Started with Production Allocation"}
            </CardTitle>
            <CardDescription>
              {isComplete
                ? "You've completed all setup steps. You're ready to track and allocate emissions!"
                : "Follow these steps to set up your production allocation workflow"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isComplete && (
              <Badge className="bg-lime-500/20 text-lime-300 border-lime-500/50">
                {completedSteps}/{totalSteps} Complete
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(false);
                onDismiss?.();
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {!isComplete && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Overall Progress</span>
              <span className="font-medium text-white">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {isComplete ? (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200">
              <div className="space-y-2">
                <p className="font-medium">You're all set!</p>
                <p className="text-sm">
                  Your allocation workflow is configured. You can now:
                </p>
                <ul className="text-sm space-y-1 ml-4 mt-2">
                  <li>• View allocation status in the matrix</li>
                  <li>• Track emissions flow in the Sankey diagram</li>
                  <li>• Monitor data quality and temporal alignment</li>
                  <li>• Generate allocation reports</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isNextStep = !step.completed && steps.slice(0, index).every((s) => s.completed);

              return (
                <div
                  key={step.id}
                  className={`
                    p-4 rounded-lg border transition-all
                    ${
                      step.completed
                        ? "bg-green-500/5 border-green-500/30"
                        : isNextStep
                        ? "bg-lime-500/10 border-lime-500/50 shadow-lg"
                        : "bg-slate-800/30 border-slate-700"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`
                        h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0
                        ${
                          step.completed
                            ? "bg-green-500/20"
                            : isNextStep
                            ? "bg-lime-500/20"
                            : "bg-slate-700/50"
                        }
                      `}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : (
                          <StepIcon
                            className={`h-5 w-5 ${
                              isNextStep ? "text-lime-400" : "text-slate-400"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4
                            className={`font-medium ${
                              step.completed
                                ? "text-green-300"
                                : isNextStep
                                ? "text-lime-300"
                                : "text-white"
                            }`}
                          >
                            {step.title}
                          </h4>
                          {isNextStep && (
                            <Badge className="bg-lime-500/20 text-lime-300 text-xs">
                              Next
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">{step.description}</p>
                      </div>
                    </div>
                    {!step.completed && (
                      <Button
                        variant={isNextStep ? "default" : "outline"}
                        size="sm"
                        onClick={() => router.push(step.action.href)}
                        className={
                          isNextStep
                            ? "bg-lime-500 hover:bg-lime-600 text-black"
                            : "border-slate-600 text-slate-300"
                        }
                      >
                        {step.action.label}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Text */}
        {!isComplete && (
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-sm">
              Need help? Check out our{" "}
              <button
                onClick={() => router.push("/knowledge-bank")}
                className="underline hover:text-blue-100"
              >
                Knowledge Bank
              </button>{" "}
              for detailed guides and best practices.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
