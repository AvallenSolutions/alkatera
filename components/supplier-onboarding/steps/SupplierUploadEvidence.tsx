'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, FileCheck, FileBadge, FileSpreadsheet, Shield, Award, FileText } from 'lucide-react'

const evidenceTypes = [
  {
    icon: FileCheck,
    title: 'EPDs',
    description: 'Environmental Product Declarations — the gold standard for verified product impact data.',
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
    description: 'Self-declared environmental data — useful when formal verification is pending.',
  },
]

export function SupplierUploadEvidence() {
  const { completeStep, previousStep } = useSupplierOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-serif font-bold text-white">
            Why Evidence Matters
          </h2>
          <p className="text-sm text-white/50 max-w-md mx-auto">
            Supporting your environmental data with evidence builds trust. Verified data is weighted
            more heavily in your customers&apos; sustainability assessments.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {evidenceTypes.map(type => (
            <div
              key={type.title}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2 text-center"
            >
              <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 border border-[#ccff00]/20 flex items-center justify-center mx-auto">
                <type.icon className="w-4 h-4 text-[#ccff00]" />
              </div>
              <h3 className="text-xs font-semibold text-white">{type.title}</h3>
              <p className="text-[10px] text-white/40 leading-relaxed">{type.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-xl p-4 text-center space-y-2">
          <p className="text-sm text-white/70 font-medium">
            You can upload evidence for each product from its detail page.
          </p>
          <p className="text-xs text-white/40">
            Supported formats: PDF, Excel, CSV, JPG, PNG — up to 20MB per file.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
