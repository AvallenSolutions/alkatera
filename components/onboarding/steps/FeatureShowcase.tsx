'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Dog,
  Calculator,
  ShieldCheck,
  BarChart3,
  Target,
  FileText,
  BookOpen,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Dog,
    title: 'Ask Rosa for insights',
    description: '"What\'s my biggest emission source?"',
    color: 'text-studio-forest',
  },
  {
    icon: Calculator,
    title: 'Calculate Product LCAs',
    description: 'Full ISO 14044/14067 compliant assessments',
    color: 'text-studio-forest',
  },
  {
    icon: ShieldCheck,
    title: 'Use Greenwash Guardian',
    description: 'Verify your sustainability claims',
    color: 'text-studio-forest',
  },
  {
    icon: BarChart3,
    title: 'View Vitality Score',
    description: 'Multi-dimensional sustainability rating',
    color: 'text-studio-forest',
  },
  {
    icon: Target,
    title: 'Set reduction targets',
    description: 'Track progress toward your goals',
    color: 'text-studio-forest',
  },
  {
    icon: FileText,
    title: 'Generate reports',
    description: 'Professional sustainability reports in 1 click',
    color: 'text-studio-forest',
  },
  {
    icon: BookOpen,
    title: 'Access Knowledge Bank',
    description: 'Comprehensive sustainability resources',
    color: 'text-studio-forest',
  },
  {
    icon: TrendingUp,
    title: 'Compare to industry',
    description: 'See how you stack up against peers',
    color: 'text-studio-forest',
  },
]

export function FeatureShowcase() {
  const { completeStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-display font-bold text-foreground">
            New capabilities unlocked.
          </h3>
          <p className="text-sm text-muted-foreground">
            Now that you have your foundation set, you can:
          </p>
        </div>

        <div className="grid gap-3">
          {FEATURES.map(feature => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-[6px] border border-border bg-card"
            >
              <CheckCircle2 className={`w-5 h-5 ${feature.color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className="text-sm font-medium text-foreground">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          onClick={completeStep}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base rounded-[6px] w-full"
        >
          Almost done!
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
