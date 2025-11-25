import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2 } from "lucide-react";

interface DataProvenanceBadgeProps {
  source?: string;
  year?: number;
  variant?: "inline" | "block";
  className?: string;
}

export function DataProvenanceBadge({
  source = "DEFRA (UK Gov)",
  year = 2025,
  variant = "inline",
  className = "",
}: DataProvenanceBadgeProps) {
  const content = (
    <Badge
      variant="outline"
      className={`text-xs gap-1 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 ${className}`}
    >
      <CheckCircle2 className="h-3 w-3" />
      Verified Source: {source} {year}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {variant === "inline" ? (
            <span className="inline-flex">{content}</span>
          ) : (
            <div className="flex items-center mt-1">{content}</div>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            Calculated using official UK Government GHG conversion factors from {source} ({year} dataset).
            All factors are traceable and auditable.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
