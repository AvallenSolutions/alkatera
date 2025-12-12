'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MethodologyToggleProps {
  currentMethodology: 'recipe_2016' | 'ef_31';
  onMethodologyChange: (methodology: 'recipe_2016' | 'ef_31') => void;
  hasEF31Access: boolean;
  ef31Available: boolean;
}

export function MethodologyToggle({
  currentMethodology,
  onMethodologyChange,
  hasEF31Access,
  ef31Available,
}: MethodologyToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Methodology:</span>
      <Tabs
        value={currentMethodology}
        onValueChange={(value) => {
          if (value === 'ef_31' && !hasEF31Access) return;
          onMethodologyChange(value as 'recipe_2016' | 'ef_31');
        }}
      >
        <TabsList className="h-9">
          <TabsTrigger value="recipe_2016" className="text-xs px-3">
            ReCiPe 2016
          </TabsTrigger>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value="ef_31"
                  className="text-xs px-3 gap-1.5"
                  disabled={!hasEF31Access}
                >
                  EF 3.1
                  {!hasEF31Access && <Lock className="h-3 w-3" />}
                  {hasEF31Access && ef31Available && (
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  )}
                </TabsTrigger>
              </TooltipTrigger>
              {!hasEF31Access && (
                <TooltipContent>
                  <p>Upgrade to Premium to access EF 3.1 methodology</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TabsList>
      </Tabs>
      {currentMethodology === 'ef_31' && (
        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
          PEF Compliant
        </Badge>
      )}
    </div>
  );
}
