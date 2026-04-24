'use client';

import { Pencil, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WIDGET_REGISTRY, type WidgetId } from '@/lib/pulse/widget-registry';

export interface PulseEditToolbarProps {
  editMode: boolean;
  onToggleEdit: () => void;
  hiddenWidgets: WidgetId[];
  onAddWidget: (id: WidgetId) => void;
  onResetToDefault: () => Promise<void> | void;
  /** Adaptive ranking: on by default; users can toggle off to freeze order. */
  adaptiveEnabled?: boolean;
  onToggleAdaptive?: () => void;
}

/**
 * Floating toolbar above the grid:
 *   - Edit layout toggle (highlighted when active)
 *   - Add widget dropdown (lists currently-hidden widgets)
 *   - Reset to default
 */
export function PulseEditToolbar({
  editMode,
  onToggleEdit,
  hiddenWidgets,
  onAddWidget,
  onResetToDefault,
  adaptiveEnabled,
  onToggleAdaptive,
}: PulseEditToolbarProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {/* Adaptive-ranking pill. Clicking toggles user preference. */}
      {onToggleAdaptive && (
        <button
          type="button"
          onClick={onToggleAdaptive}
          title={
            adaptiveEnabled
              ? 'Adaptive ordering is on. Cards you open most often float to the top. Click to freeze.'
              : 'Layout is frozen. Click to enable adaptive ordering.'
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
            adaptiveEnabled
              ? 'border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00]'
              : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="h-3 w-3" />
          Adaptive {adaptiveEnabled ? 'on' : 'off'}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add widget
            {hiddenWidgets.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#ccff00]/15 px-1.5 text-[10px] font-semibold text-[#ccff00]">
                {hiddenWidgets.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Hidden widgets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hiddenWidgets.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              All widgets are on the dashboard. Remove one in edit mode to free a slot.
            </p>
          ) : (
            hiddenWidgets.map(id => {
              const meta = WIDGET_REGISTRY[id];
              if (!meta) return null;
              return (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => onAddWidget(id)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground">{meta.description}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="ghost"
        onClick={onResetToDefault}
        className="text-xs"
        title="Restore role-default layout"
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        Reset
      </Button>

      <Button
        size="sm"
        variant={editMode ? 'default' : 'outline'}
        onClick={onToggleEdit}
        className={cn('text-xs', editMode && 'bg-[#ccff00] text-black hover:bg-[#ccff00]/90')}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        {editMode ? 'Done editing' : 'Edit layout'}
      </Button>
    </div>
  );
}
