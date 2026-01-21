'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings2,
  GripVertical,
  RotateCcw,
  Leaf,
  Zap,
  Cloud,
  Users,
  Activity,
  BarChart3,
  Package,
  Rocket,
  Target,
  Droplet,
  TrendingDown,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { useDashboardPreferences, DashboardWidget } from '@/hooks/data/useDashboardPreferences';

const iconMap: Record<string, any> = {
  Leaf,
  Zap,
  Cloud,
  Users,
  Activity,
  BarChart3,
  Package,
  Rocket,
  Target,
  Droplet,
  TrendingDown,
  ShieldCheck,
};

const categoryLabels: Record<string, string> = {
  metrics: 'Metrics & Data',
  navigation: 'Navigation',
  activity: 'Activity & Updates',
  general: 'General',
};

interface DashboardCustomiseModalProps {
  children?: React.ReactNode;
}

export function DashboardCustomiseModal({ children }: DashboardCustomiseModalProps) {
  const [open, setOpen] = useState(false);
  const {
    widgets,
    preferences,
    toggleWidget,
    resetToDefaults,
    loading,
  } = useDashboardPreferences();

  const groupedWidgets = widgets.reduce((acc, widget) => {
    const category = widget.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(widget);
    return acc;
  }, {} as Record<string, DashboardWidget[]>);

  const isWidgetEnabled = (widgetId: string) => {
    const pref = preferences.find((p) => p.widget_id === widgetId);
    return pref?.enabled ?? true;
  };

  const handleToggle = async (widgetId: string) => {
    try {
      await toggleWidget(widgetId);
    } catch (err) {
      console.error('Failed to toggle widget:', err);
    }
  };

  const handleReset = async () => {
    try {
      await resetToDefaults();
    } catch (err) {
      console.error('Failed to reset preferences:', err);
    }
  };

  const getWidgetIcon = (iconName: string | null) => {
    if (!iconName) return BarChart3;
    return iconMap[iconName] || BarChart3;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Customise
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customise Dashboard</span>
            <Badge variant="secondary" className="text-xs font-normal">
              {preferences.filter(p => p.enabled).length} of {widgets.length} active
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Click any widget card to show or hide it on your dashboard
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedWidgets).map(([category, categoryWidgets]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {categoryLabels[category] || category}
                </h3>
                <div className="space-y-2">
                  {categoryWidgets.map((widget) => {
                    const Icon = getWidgetIcon(widget.icon);
                    const enabled = isWidgetEnabled(widget.id);

                    return (
                      <div
                        key={widget.id}
                        onClick={() => !loading && handleToggle(widget.id)}
                        className={`relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          enabled
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/50'
                        } ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {/* Selected indicator checkmark */}
                        {enabled && (
                          <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shadow-md">
                            <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                          </div>
                        )}

                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            enabled
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${
                              enabled
                                ? 'text-emerald-900 dark:text-emerald-100'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {widget.name}
                            </p>
                            {enabled && (
                              <Badge className="text-xs bg-emerald-500 dark:bg-emerald-600 text-white border-0">
                                Active
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs ${
                              enabled
                                ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}>
                              {widget.default_size}
                            </Badge>
                          </div>
                          <p className={`text-xs truncate ${
                            enabled
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-muted-foreground'
                          }`}>
                            {widget.description}
                          </p>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => {
                            // Prevent double-toggling from parent div click
                          }}
                          disabled={loading}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={loading}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
