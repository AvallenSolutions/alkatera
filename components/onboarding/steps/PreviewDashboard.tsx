'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, SkipForward, TrendingDown, Droplets, Recycle, Package, Factory, BarChart3 } from 'lucide-react'

export function PreviewDashboard() {
  const { completeStep, previousStep, skipStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-serif font-bold text-white">
              This is what your dashboard will look like
            </h3>
            <span className="text-xs border border-[#ccff00]/50 text-[#ccff00] px-2 py-0.5 rounded-full font-medium">
              DEMO
            </span>
          </div>
          <p className="text-sm text-white/50">
            Once you&apos;ve added your data, you&apos;ll see insights like these:
          </p>
        </div>

        {/* Mock dashboard cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-[#ccff00]" />
              <span className="text-xs text-white/40">Vitality Score</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">72<span className="text-sm text-white/50">/100</span></div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/40">Climate Impact</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">1,234 <span className="text-xs text-emerald-400">-15%</span></div>
            <p className="text-xs text-white/30">tCO2e/year</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-white/40">Water Usage</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">45,678</div>
            <p className="text-xs text-white/30">L/month &mdash; stable</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Recycle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/40">Waste Diversion</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">68% <span className="text-xs text-emerald-400">+12%</span></div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-white/40">Product LCAs</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">8</div>
            <p className="text-xs text-white/30">products calculated</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Factory className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/40">Facilities</span>
            </div>
            <div className="text-2xl font-bold font-data text-white">3</div>
            <p className="text-xs text-white/30">tracked</p>
          </div>
        </div>

        <p className="text-xs text-white/30 text-center italic">
          This is sample data. Your actual dashboard will reflect your real data.
        </p>

        {/* Rosa quote */}
        <div className="bg-emerald-400/5 backdrop-blur-md border border-emerald-400/20 rounded-xl p-4">
          <p className="text-sm text-white">
            <span className="font-medium text-emerald-400">Rosa:</span>{' '}
            &quot;This is YOUR future dashboard. Let&apos;s build it together in ~12 minutes.&quot;
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={completeStep}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              I&apos;m ready! Let&apos;s build mine
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
