'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Leaf,
  Factory,
  Truck,
  Users,
  Trash2,
  ArrowRight,
  ClipboardList,
  BookOpen,
  Layers,
  CheckCircle2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface GuideStepProps {
  skipGuide: boolean;
  onToggleSkip: (skip: boolean) => void;
}

// ============================================================================
// BOUNDARY DIAGRAM
// ============================================================================

const BOUNDARY_STAGES = [
  { label: 'Raw Materials', icon: Leaf },
  { label: 'Processing', icon: Factory },
  { label: 'Packaging', icon: Layers },
  { label: 'Distribution', icon: Truck },
  { label: 'Use Phase', icon: Users },
  { label: 'End of Life', icon: Trash2 },
];

const BOUNDARIES = [
  {
    name: 'Cradle-to-Gate',
    tier: 'Seed',
    stageCount: 3,
    description: 'Most common for manufacturers. Covers raw materials through production.',
  },
  {
    name: 'Cradle-to-Shelf',
    tier: 'Blossom',
    stageCount: 4,
    description: 'Adds distribution to the point of sale.',
  },
  {
    name: 'Cradle-to-Consumer',
    tier: 'Canopy',
    stageCount: 5,
    description: 'Includes how consumers use the product (refrigeration, etc.).',
  },
  {
    name: 'Cradle-to-Grave',
    tier: 'Canopy',
    stageCount: 6,
    description: 'Full lifecycle including end-of-life disposal and recycling credits.',
  },
];

function BoundaryDiagram() {
  return (
    <div className="space-y-3">
      {/* Stage icons row */}
      <div className="flex flex-wrap items-center gap-2">
        {BOUNDARY_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.label}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {stage.label}
                </span>
              </div>
              {idx < BOUNDARY_STAGES.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Boundary brackets */}
      <div className="space-y-2 pl-1">
        {BOUNDARIES.map((b) => (
          <div key={b.name} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${(b.stageCount / 6) * 120}px` }}
              />
              <span className="whitespace-nowrap text-xs font-medium">
                {b.name}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              ({b.tier}) &mdash; {b.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DATA CHECKLIST
// ============================================================================

const DATA_CHECKLIST = [
  {
    category: 'Ingredients & Materials',
    items: [
      'List of all ingredients with quantities per batch or per unit',
      'Country or region of origin for each ingredient',
      'Any processing aids or additives used',
    ],
  },
  {
    category: 'Packaging',
    items: [
      'All packaging materials (primary, secondary, tertiary)',
      'Weight of each packaging component',
      'Material type (glass, aluminium, PET, cardboard, etc.)',
    ],
  },
  {
    category: 'Production',
    items: [
      'Production facility linked to this product',
      'Total production volume at the facility (for allocation)',
      'Your product\'s volume share at that facility',
    ],
  },
  {
    category: 'Distribution (Blossom+)',
    items: [
      'Transport distances from factory to warehouse/retailer',
      'Transport mode (road, rail, sea, air)',
    ],
  },
  {
    category: 'Consumer Use & End of Life (Canopy)',
    items: [
      'Whether the product needs refrigeration',
      'Target disposal region (UK, EU, or US)',
    ],
  },
];

function DataChecklist() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DATA_CHECKLIST.map((group) => (
        <div key={group.category} className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">{group.category}</p>
          <ul className="space-y-1.5">
            {group.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// WIZARD FLOW OVERVIEW
// ============================================================================

const WIZARD_PHASES = [
  {
    phase: 'Data Validation',
    steps: ['Verify material emission factors', 'Assign facility production volumes'],
    stepNumbers: '1-2',
  },
  {
    phase: 'Boundary & Calculation',
    steps: ['Choose system boundary & functional unit', 'Run the LCA calculation'],
    stepNumbers: '3-4',
  },
  {
    phase: 'ISO Documentation',
    steps: [
      'Define goal & purpose (ISO 14044)',
      'Set cut-off criteria & assumptions',
      'Assess data quality',
      'Review interpretation & results',
      'Select critical review type',
    ],
    stepNumbers: '5-9',
  },
  {
    phase: 'Completion',
    steps: ['Review summary and generate your LCA report'],
    stepNumbers: '10',
  },
];

function WizardFlowOverview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {WIZARD_PHASES.map((phase) => (
        <div
          key={phase.phase}
          className="rounded-lg border p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Steps {phase.stepNumbers}
            </span>
            <p className="text-sm font-medium">{phase.phase}</p>
          </div>
          <ul className="space-y-1">
            {phase.steps.map((step) => (
              <li key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GuideStep({ skipGuide, onToggleSkip }: GuideStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Welcome to the LCA Wizard</h3>
        <p className="text-sm text-muted-foreground">
          This guide will help you understand what a Lifecycle Assessment is,
          what data you need, and how the wizard works. Click <strong>Next</strong> when
          you are ready to begin.
        </p>
      </div>

      {/* Section 1: What is an LCA? */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">What is a Lifecycle Assessment?</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A Lifecycle Assessment (LCA) is a standardised method for measuring the
          environmental impact of a product across its entire life &mdash; from raw
          material extraction to end-of-life disposal. It follows the
          international standards <strong>ISO 14040</strong> and{' '}
          <strong>ISO 14044</strong>, and for carbon footprints specifically,{' '}
          <strong>ISO 14067</strong>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The result is a science-based environmental profile of your product,
          expressed in <strong>kg CO&#8322;e</strong> (kilograms of carbon dioxide equivalent)
          and, for wider assessments, additional impact categories like water use
          and land occupation.
        </p>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Why does it matter?</strong> An LCA helps you identify the biggest
              environmental hotspots in your product (often ingredients or packaging),
              make data-driven improvements, meet customer and retailer requirements,
              and support credible sustainability claims.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: System Boundaries */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">System Boundaries</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The &ldquo;system boundary&rdquo; defines which lifecycle stages are included in your
          assessment. A wider boundary captures more of the product&rsquo;s real-world impact
          but requires more data.
        </p>
        <BoundaryDiagram />
      </section>

      {/* Section 3: Data Checklist */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">What data will you need?</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before you start, it helps to have the following information ready. Don&rsquo;t
          worry if you don&rsquo;t have everything &mdash; the wizard will guide you through
          each piece and can use industry defaults where primary data is unavailable.
        </p>
        <DataChecklist />
      </section>

      {/* Section 4: How the Wizard Works */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">How the wizard works</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The wizard is divided into four phases. Your progress is automatically
          saved after the calculation step, so you can close the wizard and come
          back at any time.
        </p>
        <WizardFlowOverview />
      </section>

      {/* Don't show again checkbox */}
      <div className="flex items-center space-x-2 rounded-lg border bg-muted/30 p-4">
        <Checkbox
          id="skip-guide"
          checked={skipGuide}
          onCheckedChange={(checked) => onToggleSkip(checked === true)}
        />
        <Label
          htmlFor="skip-guide"
          className="text-sm font-normal text-muted-foreground cursor-pointer"
        >
          Don&rsquo;t show this guide again (you can re-enable it in Settings)
        </Label>
      </div>
    </div>
  );
}
