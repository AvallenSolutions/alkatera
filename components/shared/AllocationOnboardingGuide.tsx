"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/studio/eyebrow";
import { Panel } from "@/components/studio/panel";
import { PillButton } from "@/components/studio/pill-button";
import { StateChip } from "@/components/studio/state-chip";

interface AllocationOnboardingGuideProps {
  organizationId: string;
  onDismiss?: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
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
            .from("product_carbon_footprint_production_sites")
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
          title: "Add your facilities",
          description:
            "Start with the sites where your products are made, owned or contract manufactured",
          completed: hasFacilities,
          action: {
            label: "Add facilities",
            href: "/company/facilities",
          },
        },
        {
          id: "products",
          title: "Create products",
          description:
            "Add the products you make, with their ingredients and packaging",
          completed: hasProducts,
          action: {
            label: "Add products",
            href: "/products/new",
          },
        },
        {
          id: "assignments",
          title: "Link facilities and products",
          description:
            "Set which products are made at which facilities in the matrix",
          completed: hasAssignments,
          action: {
            label: "Set up assignments",
            href: "/company/facilities",
          },
        },
        {
          id: "reporting",
          title: "Set up reporting periods",
          description:
            "Define reporting periods for each facility and log emissions, water and waste",
          completed: hasProduction,
          action: {
            label: "Configure periods",
            href: "/company/facilities",
          },
        },
        {
          id: "allocations",
          title: "Allocate emissions",
          description:
            "Share facility emissions across products by production volume",
          completed: hasAllocations,
          action: {
            label: "Start allocating",
            href: "/company/facilities",
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
  const isComplete = completedSteps === totalSteps;

  if (loading) {
    return null;
  }

  // Nothing to say once the setup is done.
  if (isComplete) {
    return null;
  }

  if (!expanded) {
    return (
      <div className="flex items-center justify-between border-y border-studio-hairline py-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          Allocation setup · {completedSteps} of {totalSteps} steps
        </span>
        <PillButton variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          Show the steps
        </PillButton>
      </div>
    );
  }

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>GETTING SET UP · {completedSteps} OF {totalSteps} STEPS</Eyebrow>
          <p className="mt-1.5 text-sm text-studio-dim">
            Five steps stand between here and allocated emissions.
          </p>
        </div>
        <PillButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            onDismiss?.();
          }}
        >
          Hide
        </PillButton>
      </div>

      <ul className="mt-4 divide-y divide-studio-hairline">
        {steps.map((step, index) => {
          const isNextStep = !step.completed && steps.slice(0, index).every((s) => s.completed);

          return (
            <li key={step.id} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "font-display text-sm font-semibold",
                      step.completed ? "text-studio-dim line-through" : "text-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  {step.completed ? (
                    <StateChip tone="good">Done</StateChip>
                  ) : isNextStep ? (
                    <StateChip tone="attention">Next</StateChip>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-studio-dim">{step.description}</p>
              </div>
              {!step.completed && (
                <PillButton
                  variant={isNextStep ? "ink" : "ghost"}
                  size="sm"
                  onClick={() => router.push(step.action.href)}
                >
                  {step.action.label}
                </PillButton>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-studio-dim">
        Stuck? The{" "}
        <button
          type="button"
          onClick={() => router.push("/knowledge-bank")}
          className="underline underline-offset-2 hover:text-foreground"
        >
          knowledge bank
        </button>{" "}
        has step-by-step guides.
      </p>
    </Panel>
  );
}
