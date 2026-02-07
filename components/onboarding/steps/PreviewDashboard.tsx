'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, SkipForward, TrendingDown, Droplets, Recycle, Package, Factory, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function PreviewDashboard() {
  const { completeStep, previousStep, skipStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-serif font-bold text-foreground">
              This is what your dashboard will look like
            </h3>
            <Badge variant="outline" className="text-xs border-[#ccff00]/50 text-[#ccff00]">
              DEMO
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Once you&apos;ve added your data, you&apos;ll see insights like these:
          </p>
        </div>

        {/* Mock dashboard cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-[#ccff00]" />
                <span className="text-xs text-muted-foreground">Vitality Score</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">72<span className="text-sm text-muted-foreground">/100</span></div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">Carbon Footprint</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">1,234 <span className="text-xs text-emerald-400">-15%</span></div>
              <p className="text-xs text-muted-foreground">tCO2e/year</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Water Usage</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">45,678</div>
              <p className="text-xs text-muted-foreground">L/month &mdash; stable</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Recycle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">Waste Diversion</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">68% <span className="text-xs text-emerald-400">+12%</span></div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Product LCAs</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">8</div>
              <p className="text-xs text-muted-foreground">products calculated</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Factory className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-muted-foreground">Facilities</span>
              </div>
              <div className="text-2xl font-bold font-data text-foreground">3</div>
              <p className="text-xs text-muted-foreground">tracked</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          This is sample data. Your actual dashboard will reflect your real data.
        </p>

        {/* Rosa quote */}
        <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4">
          <p className="text-sm text-foreground">
            <span className="font-medium text-emerald-400">Rosa:</span>{' '}
            &quot;This is YOUR future dashboard. Let&apos;s build it together in ~12 minutes.&quot;
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground text-sm">
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
