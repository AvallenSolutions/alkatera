'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cloud,
  Droplet,
  Box,
  Users,
  TrendingUp,
  PieChart,
  BarChart,
  HelpCircle,
  Compass,
  Calculator,
  Truck,
  Factory,
  Star,
  Target,
  AlertCircle,
  Package,
  Zap,
  Book,
  Fuel,
  Percent,
} from 'lucide-react';
import type { SmartSuggestion } from '@/lib/gaia';

interface GaiaSmartSuggestionsProps {
  suggestions: SmartSuggestion[];
  onSuggestionClick: (question: string) => void;
  isLoading?: boolean;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  cloud: Cloud,
  droplet: Droplet,
  box: Box,
  users: Users,
  'trending-up': TrendingUp,
  'pie-chart': PieChart,
  'bar-chart': BarChart,
  'help-circle': HelpCircle,
  compass: Compass,
  calculator: Calculator,
  truck: Truck,
  factory: Factory,
  star: Star,
  target: Target,
  'alert-circle': AlertCircle,
  package: Package,
  zap: Zap,
  book: Book,
  fuel: Fuel,
  percent: Percent,
};

function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
  return iconMap[iconName] || HelpCircle;
}

export function GaiaSmartSuggestions({
  suggestions,
  onSuggestionClick,
  isLoading = false,
}: GaiaSmartSuggestionsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-48 rounded-md" />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion, index) => {
        const IconComponent = getIconComponent(suggestion.icon);
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-xs bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors"
            onClick={() => onSuggestionClick(suggestion.question)}
          >
            <IconComponent className="h-3 w-3 mr-1.5 text-emerald-500" />
            {suggestion.question}
          </Button>
        );
      })}
    </div>
  );
}

export default GaiaSmartSuggestions;
