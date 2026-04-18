"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Leaf,
  Droplets,
  Recycle,
  TreePine,
  Zap,
  Users,
  Factory,
  Truck,
  Package,
  ClipboardList,
  Check,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDismissedActions } from "@/hooks/useDismissedActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ActionPriority = "high" | "medium" | "low";

interface HeroAction {
  id: string;
  priority: ActionPriority;
  title: string;
  description?: string;
  impactValue?: string;
  category: string;
  href?: string;
}

interface ThreeThingsTodayHeroProps {
  actions: HeroAction[];
  className?: string;
  onHideForToday?: () => void;
  onHidePermanently?: () => void;
}

const categoryIcons: Record<string, LucideIcon> = {
  climate: Leaf,
  water: Droplets,
  waste: Recycle,
  nature: TreePine,
  energy: Zap,
  suppliers: Users,
  facilities: Factory,
  transport: Truck,
  setup: ClipboardList,
  products: Package,
};

const priorityPill: Record<ActionPriority, { label: string; cls: string }> = {
  high:   { label: "Urgent", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  medium: { label: "Medium", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  low:    { label: "Low",    cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

export function ThreeThingsTodayHero({
  actions,
  className,
  onHideForToday,
  onHidePermanently,
}: ThreeThingsTodayHeroProps) {
  const { dismissed, dismiss, clearAll } = useDismissedActions();
  const canClose = Boolean(onHideForToday || onHidePermanently);

  const closeMenu = canClose ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Close priority actions"
        >
          <X className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onHideForToday && (
          <DropdownMenuItem onSelect={() => onHideForToday()}>Hide for today</DropdownMenuItem>
        )}
        {onHidePermanently && (
          <DropdownMenuItem onSelect={() => onHidePermanently()}>Don&apos;t show again</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const sorted = [...actions].sort((a, b) => {
    const order: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
  const visible = sorted.filter((a) => !dismissed.has(a.id));
  const top = visible.slice(0, 3);

  const anyDismissed = actions.some((a) => dismissed.has(a.id));

  if (top.length === 0) {
    return (
      <Card className={cn("border-emerald-400/20 bg-emerald-500/5", className)}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium">All caught up for today.</p>
              <p className="text-xs text-muted-foreground">No priority actions right now — explore your reports for deeper insights.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {anyDismissed && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={clearAll}>
                <RotateCcw className="h-3.5 w-3.5" />
                Restore dismissed
              </Button>
            )}
            {closeMenu}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-[#ccff00]/20 bg-gradient-to-br from-[#ccff00]/5 via-transparent to-transparent", className)}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ccff00]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#8da300] dark:text-[#ccff00]" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-tight">Three things today</h2>
            <p className="text-xs text-muted-foreground">The highest-leverage steps for your sustainability data right now.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {anyDismissed && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={clearAll}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restore dismissed
            </Button>
          )}
          {closeMenu}
        </div>
      </div>

      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((action, idx) => {
          const Icon = categoryIcons[action.category] ?? Leaf;
          const pill = priorityPill[action.priority];
          return (
            <div
              key={action.id}
              className="group relative flex h-full flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                  {idx + 1}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", pill.cls)}>
                  {pill.label}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{action.title}</p>
                  {action.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                  )}
                </div>
              </div>

              {action.impactValue && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {action.impactValue}
                </p>
              )}

              <div className="mt-auto flex items-center gap-2 pt-1">
                {action.href && (
                  <Button
                    asChild
                    size="sm"
                    variant={action.priority === "high" ? "default" : "outline"}
                    className="flex-1 gap-1.5"
                  >
                    <Link href={action.href}>
                      Take action
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => dismiss(action.id)}
                  title="Mark this as done — hides it from the dashboard"
                >
                  <Check className="h-3.5 w-3.5" />
                  Done
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
