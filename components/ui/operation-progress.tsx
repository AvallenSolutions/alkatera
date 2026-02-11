"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OperationStep {
  label: string;
  status: "pending" | "active" | "completed" | "error";
  detail?: string;
}

interface OperationProgressProps {
  title: string;
  steps: OperationStep[];
  progress?: number;
  message?: string;
  className?: string;
}

export function OperationProgress({
  title,
  steps,
  progress,
  message,
  className,
}: OperationProgressProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const activeStep = steps.find((s) => s.status === "active");
  const calculatedProgress =
    progress ?? Math.round((completedCount / Math.max(steps.length, 1)) * 100);

  return (
    <div
      className={cn(
        "w-full max-w-md space-y-6 p-6 rounded-xl bg-card border shadow-lg",
        className
      )}
    >
      {/* Title */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={calculatedProgress} indicatorColor="lime" className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {completedCount} of {steps.length} steps
          </span>
          <span>{calculatedProgress}%</span>
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3 py-2 px-3 rounded-lg transition-colors",
              step.status === "active" && "bg-lime-500/10",
              step.status === "completed" && "opacity-70",
              step.status === "error" && "bg-red-500/10"
            )}
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {step.status === "completed" && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {step.status === "active" && (
                <Loader2 className="h-4 w-4 text-lime-500 animate-spin" />
              )}
              {step.status === "pending" && (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              {step.status === "error" && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            {/* Label and detail */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm",
                  step.status === "active" && "font-medium text-foreground",
                  step.status === "completed" && "text-muted-foreground",
                  step.status === "pending" && "text-muted-foreground/60",
                  step.status === "error" && "text-red-600 dark:text-red-400"
                )}
              >
                {step.label}
              </p>
              {step.detail && step.status === "active" && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full-screen overlay variant for blocking operations like LCA calculation
 */
interface OperationOverlayProps extends OperationProgressProps {
  open: boolean;
}

export function OperationOverlay({ open, ...props }: OperationOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <OperationProgress {...props} />
    </div>
  );
}
