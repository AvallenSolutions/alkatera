'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  HelpCircle,
  Database,
  Building,
  FileSpreadsheet,
  Droplet,
  Users,
  Handshake,
  Package,
  Box,
  AlertCircle,
  Book,
  Truck,
  Star,
  Plus,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import type { ActionButton, DataGapResponse } from '@/lib/gaia';
import ReactMarkdown from 'react-markdown';

interface GaiaDataGapResponseProps {
  response: DataGapResponse;
  onSuggestionClick: (question: string) => void;
  onExplainClick?: (topic: string) => void;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'bar-chart': BarChart,
  'help-circle': HelpCircle,
  database: Database,
  building: Building,
  'file-spreadsheet': FileSpreadsheet,
  droplet: Droplet,
  users: Users,
  handshake: Handshake,
  package: Package,
  box: Box,
  'alert-circle': AlertCircle,
  book: Book,
  truck: Truck,
  star: Star,
  plus: Plus,
  'layout-dashboard': LayoutDashboard,
};

function getIconComponent(iconName?: string): React.ComponentType<{ className?: string }> {
  if (!iconName) return HelpCircle;
  return iconMap[iconName] || HelpCircle;
}

export function GaiaDataGapResponse({
  response,
  onSuggestionClick,
  onExplainClick,
}: GaiaDataGapResponseProps) {
  const router = useRouter();

  const handleActionButton = (button: ActionButton) => {
    if (button.action === 'navigate' && button.target) {
      router.push(button.target);
    } else if (button.action === 'explain' && button.target && onExplainClick) {
      onExplainClick(button.target);
    } else if (button.action === 'suggest') {
      // Trigger showing available data - submit a question about available data
      onSuggestionClick('What sustainability data do I have available?');
    }
  };

  return (
    <div className="space-y-4">
      {/* Main message with markdown support */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 text-sm">{children}</p>,
            strong: ({ children }) => (
              <strong className="text-emerald-600 dark:text-emerald-400">{children}</strong>
            ),
            ul: ({ children }) => <ul className="list-disc list-inside mb-2 text-sm">{children}</ul>,
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-2 text-sm">{children}</ol>
            ),
            li: ({ children }) => <li className="mb-1">{children}</li>,
          }}
        >
          {response.message}
        </ReactMarkdown>
      </div>

      {/* Action buttons */}
      {response.actionButtons && response.actionButtons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {response.actionButtons.map((button, idx) => {
            const IconComponent = getIconComponent(button.icon);
            return (
              <Button
                key={idx}
                variant={idx === 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActionButton(button)}
                className={
                  idx === 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                    : 'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                }
              >
                <IconComponent className="h-3.5 w-3.5 mr-1.5" />
                {button.label}
                {button.action === 'navigate' && (
                  <ArrowRight className="h-3 w-3 ml-1" />
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Helpful suggestions */}
      {response.helpfulSuggestions && response.helpfulSuggestions.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Related questions:</p>
          <div className="flex flex-wrap gap-2">
            {response.helpfulSuggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                className="h-auto py-1.5 px-3 text-xs bg-muted/50 hover:bg-muted"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GaiaDataGapResponse;
