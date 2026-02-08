'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/lib/onboarding'
import { GUIDE_STEPS, getVisibleSteps, type GuideStep } from '@/lib/dashboard-guide'

// ─── Typewriter Hook ───────────────────────────────────────────────────────────

function useTypewriter(text: string, speed: number = 25) {
  const [displayed, setDisplayed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setDisplayed('')
    setIsComplete(false)
    let index = 0

    intervalRef.current = setInterval(() => {
      index++
      if (index >= text.length) {
        setDisplayed(text)
        setIsComplete(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setDisplayed(text.slice(0, index))
      }
    }, speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text, speed])

  const skipToEnd = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setDisplayed(text)
    setIsComplete(true)
  }, [text])

  return { displayed, isComplete, skipToEnd }
}

// ─── Sparkle Particles (Final Step) ────────────────────────────────────────────

function SparkleParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        size: 4 + Math.random() * 6,
      })),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#ccff00]/30"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── Step Dots ─────────────────────────────────────────────────────────────────

function StepDots({
  total,
  current,
}: {
  total: number
  current: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-4 bg-emerald-400'
              : i < current
                ? 'w-1.5 bg-emerald-400/50'
                : 'w-1.5 bg-white/20'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Rosa Card ─────────────────────────────────────────────────────────────────

interface RosaCardProps {
  step: GuideStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onAction: (href: string) => void
}

function RosaCard({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  onAction,
}: RosaCardProps) {
  const { displayed, isComplete, skipToEnd } = useTypewriter(step.rosa, 25)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === totalSteps - 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-black/80 backdrop-blur-xl border border-emerald-400/20 rounded-2xl p-5 max-w-sm shadow-2xl relative"
    >
      {isLastStep && <SparkleParticles />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-emerald-400 font-medium text-sm">Rosa</p>
          <p className="text-white/30 text-xs">Your sustainability guide</p>
        </div>
      </div>

      {/* Message with typewriter effect */}
      <div
        className="text-white/80 text-sm leading-relaxed mb-4 min-h-[60px] cursor-pointer"
        onClick={!isComplete ? skipToEnd : undefined}
      >
        {displayed}
        {!isComplete && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-text-bottom"
          />
        )}
      </div>

      {/* Final step CTAs */}
      {isLastStep && step.actions && (
        <div className="flex flex-col gap-2 mb-4">
          {step.actions.map((action) =>
            action.variant === 'primary' ? (
              <Button
                key={action.label}
                onClick={() => onAction(action.href)}
                className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {action.label}
              </Button>
            ) : (
              <Button
                key={action.label}
                variant="ghost"
                onClick={() => onAction('')}
                className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl w-full"
              >
                {action.label}
              </Button>
            )
          )}
        </div>
      )}

      {/* Footer: dots + navigation */}
      <div className="flex items-center justify-between">
        <StepDots total={totalSteps} current={stepIndex} />

        {!isLastStep && (
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-white/40 hover:text-white hover:bg-white/10 h-8 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-lg h-8 px-3"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Skip link */}
      {!isLastStep && (
        <button
          onClick={onSkip}
          className="w-full text-center text-xs text-white/30 hover:text-white/50 mt-3 transition-colors"
        >
          Skip tour
        </button>
      )}
    </motion.div>
  )
}

// ─── Spotlight Overlay ─────────────────────────────────────────────────────────

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

function GuideOverlay({
  targetRect,
  highlight,
}: {
  targetRect: SpotlightRect | null
  highlight?: 'pulse' | 'glow'
}) {
  if (!targetRect) {
    // Full overlay, no spotlight (final step)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[55] bg-black/70"
      />
    )
  }

  const padding = 12

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[55] pointer-events-none"
    >
      {/* Dark overlay with cutout via box-shadow */}
      <motion.div
        className="absolute rounded-xl"
        animate={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
        }}
      />

      {/* Highlight ring */}
      <motion.div
        className={`absolute rounded-xl ring-2 ring-emerald-400/30 ${
          highlight === 'pulse'
            ? 'animate-pulse'
            : highlight === 'glow'
              ? 'shadow-[0_0_30px_rgba(52,211,153,0.25)]'
              : 'shadow-[0_0_20px_rgba(52,211,153,0.1)]'
        }`}
        animate={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// ─── Main DashboardGuide Component ─────────────────────────────────────────────

export function DashboardGuide() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, markGuideCompleted } = useOnboarding()

  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const measureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Determine visible steps based on viewport
  const visibleSteps = useMemo(() => getVisibleSteps(isMobile), [isMobile])
  const currentStep = visibleSteps[currentStepIndex]

  // Check viewport size (debounced to avoid excessive re-renders)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    let timer: ReturnType<typeof setTimeout>
    const debouncedCheck = () => {
      clearTimeout(timer)
      timer = setTimeout(check, 150)
    }
    window.addEventListener('resize', debouncedCheck)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', debouncedCheck)
    }
  }, [])

  // Auto-start: if ?guide=1 and guide not completed
  useEffect(() => {
    if (searchParams.get('guide') === '1' && !state.dashboardGuideCompleted) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setIsOpen(true)
        setCurrentStepIndex(0)
      }, 800)

      // Clean up the query param
      const url = new URL(window.location.href)
      url.searchParams.delete('guide')
      window.history.replaceState({}, '', url.pathname + url.search)

      return () => clearTimeout(timer)
    }
  }, [searchParams, state.dashboardGuideCompleted])

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!currentStep || !currentStep.targetSelector) {
      setTargetRect(null)
      return
    }

    const el = document.querySelector(`[data-guide="${currentStep.targetSelector}"]`)
    if (!el) {
      setTargetRect(null)
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })
  }, [currentStep])

  // Measure on step change and periodically (handles scroll/resize)
  useEffect(() => {
    if (!isOpen) return

    measureTarget()

    // Re-measure periodically in case of layout shifts
    measureIntervalRef.current = setInterval(measureTarget, 500)

    return () => {
      if (measureIntervalRef.current) clearInterval(measureIntervalRef.current)
    }
  }, [isOpen, currentStepIndex, measureTarget])

  // Scroll target into view
  useEffect(() => {
    if (!isOpen || !currentStep?.targetSelector) return

    const el = document.querySelector(`[data-guide="${currentStep.targetSelector}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Re-measure after scroll settles
      setTimeout(measureTarget, 400)
    }
  }, [isOpen, currentStepIndex, currentStep?.targetSelector, measureTarget])

  const handleNext = useCallback(() => {
    if (currentStepIndex < visibleSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }, [currentStepIndex, visibleSteps.length])

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [currentStepIndex])

  const handleSkip = useCallback(() => {
    setIsOpen(false)
    markGuideCompleted()
  }, [markGuideCompleted])

  const handleAction = useCallback(
    (href: string) => {
      setIsOpen(false)
      markGuideCompleted()
      if (href) {
        router.push(href)
      }
    },
    [markGuideCompleted, router]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleSkip()
          break
        case 'ArrowRight':
        case 'Enter':
          handleNext()
          break
        case 'ArrowLeft':
          handleBack()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleNext, handleBack, handleSkip])

  // Public method to restart the tour
  const startTour = useCallback(() => {
    setCurrentStepIndex(0)
    setIsOpen(true)
  }, [])

  // Expose startTour via a global event for the replay button
  useEffect(() => {
    const handler = () => startTour()
    window.addEventListener('dashboard-guide:start', handler)
    return () => window.removeEventListener('dashboard-guide:start', handler)
  }, [startTour])

  if (!isOpen) return null

  // Compute popover position
  const getPopoverStyle = (): React.CSSProperties => {
    if (!currentStep) return {}

    if (currentStep.popoverPosition === 'center' || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 56,
      }
    }

    const padding = 12
    const cardWidth = 384 // max-w-sm = 24rem = 384px
    const gap = 16

    switch (currentStep.popoverPosition) {
      case 'right':
        return {
          position: 'fixed',
          top: Math.max(20, targetRect.top - padding),
          left: targetRect.left + targetRect.width + padding + gap,
          zIndex: 56,
          maxWidth: `min(${cardWidth}px, calc(100vw - ${targetRect.left + targetRect.width + padding + gap + 20}px))`,
        }
      case 'left':
        return {
          position: 'fixed',
          top: Math.max(20, targetRect.top - padding),
          left: Math.max(20, targetRect.left - padding - gap - cardWidth),
          zIndex: 56,
          maxWidth: `min(${cardWidth}px, ${targetRect.left - padding - gap - 20}px)`,
        }
      case 'below':
      default:
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height + padding + gap,
          left: Math.max(20, targetRect.left + targetRect.width / 2 - cardWidth / 2),
          zIndex: 56,
          maxWidth: cardWidth,
        }
    }
  }

  return (
    <>
      <AnimatePresence>
        <GuideOverlay
          targetRect={targetRect}
          highlight={currentStep?.highlight}
        />
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <div style={getPopoverStyle()} key={currentStepIndex}>
          <RosaCard
            step={currentStep}
            stepIndex={currentStepIndex}
            totalSteps={visibleSteps.length}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            onAction={handleAction}
          />
        </div>
      </AnimatePresence>
    </>
  )
}

// ─── Replay Button ─────────────────────────────────────────────────────────────

export function DashboardGuideTrigger() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => window.dispatchEvent(new Event('dashboard-guide:start'))}
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      title="Take a guided tour of your dashboard"
    >
      <Bot className="h-3.5 w-3.5" />
      Take a tour
    </Button>
  )
}
