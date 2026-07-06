'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, FileCheck, FileBadge, FileSpreadsheet, Shield, Award, FileText } from 'lucide-react'

const evidenceTypes = [
  {
    icon: FileCheck,
    title: 'EPDs',
    description: 'Environmental Product Declarations: the gold standard for verified product impact data.',
  },
  {
    icon: FileBadge,
    title: 'LCA Reports',
    description: 'Life Cycle Assessment reports detailing full cradle-to-gate or cradle-to-grave impacts.',
  },
  {
    icon: Award,
    title: 'Certificates',
    description: 'Carbon, water, or sustainability certificates from recognised bodies.',
  },
  {
    icon: Shield,
    title: 'Third-Party Verifications',
    description: 'Independent audits and verification statements from accredited verifiers.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Specification Sheets',
    description: 'Technical data sheets with environmental performance metrics.',
  },
  {
    icon: FileText,
    title: 'Supplier Declarations',
    description: 'Self-declared environmental data, useful when formal verification is pending.',
  },
]

export function SupplierUploadEvidence() {
  const { completeStep, previousStep } = useSupplierOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Why evidence matters.
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Supporting your environmental data with evidence builds trust. Verified data is weighted
            more heavily in your customers&apos; sustainability assessments.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {evidenceTypes.map(type => (
            <div
              key={type.title}
              className="rounded-[6px] border border-border bg-card p-3 space-y-2 text-center"
            >
              <div className="w-8 h-8 rounded-[6px] bg-secondary flex items-center justify-center mx-auto">
                <type.icon className="w-4 h-4 text-studio-forest" />
              </div>
              <h3 className="text-xs font-semibold text-foreground">{type.title}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{type.description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[6px] border border-border bg-card p-4 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">
            You can upload evidence for each product from its detail page.
          </p>
          <p className="text-xs text-studio-dim">
            Supported formats: PDF, Excel, CSV, JPG, PNG, up to 20MB per file.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
