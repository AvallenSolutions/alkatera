"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dog, ChevronDown, ChevronRight, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { SEARCH_GUIDE_SECTIONS } from "@/lib/search-guide";

export function SearchGuidePanel() {
  const { state, markSearchGuideCompleted, resetSearchGuide } = useOnboarding();
  const isGuideVisible = !state.searchGuideCompleted;

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionId(prev => (prev === sectionId ? null : sectionId));
    setExpandedTipId(null);
  };

  const toggleTip = (tipId: string) => {
    setExpandedTipId(prev => (prev === tipId ? null : tipId));
  };

  // Dismissed state: show a small re-enable button
  if (!isGuideVisible) {
    return (
      <div className="flex justify-end pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSearchGuide}
          className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7 px-2"
        >
          <HelpCircle className="h-3 w-3" />
          Search Tips
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mb-3"
      >
        <div className="bg-black/60 backdrop-blur-xl border border-emerald-400/20 rounded-xl overflow-hidden">
          {/* Header bar — always visible */}
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Rosa avatar */}
            <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 border border-emerald-400/30 flex items-center justify-center">
              <Dog className="h-4 w-4 text-emerald-400" />
            </div>

            {/* Teaser or title */}
            <div className="flex-1 min-w-0">
              {isExpanded ? (
                <p className="text-sm font-medium text-white/90">Rosa&apos;s Search Guide</p>
              ) : (
                <p className="text-sm text-white/70">
                  Need help navigating the databases? I&apos;ve got tips!
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0 text-white/40 hover:text-white/70 hover:bg-white/10"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={markSearchGuideCompleted}
                className="h-7 w-7 p-0 text-white/30 hover:text-white/50 hover:bg-white/10"
                title="Hide search tips"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 max-h-[400px] overflow-y-auto space-y-1">
                  {SEARCH_GUIDE_SECTIONS.map((section) => {
                    const isSectionOpen = expandedSectionId === section.id;

                    return (
                      <div key={section.id} className="rounded-lg overflow-hidden">
                        {/* Section header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-emerald-400/60 shrink-0 transition-transform duration-200 ${
                              isSectionOpen ? "rotate-90" : ""
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-400">{section.title}</p>
                            <p className="text-xs text-white/40">{section.description}</p>
                          </div>
                        </button>

                        {/* Section tips */}
                        <AnimatePresence>
                          {isSectionOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pl-6 pr-2 pb-2 space-y-0.5">
                                {section.tips.map((tip) => {
                                  const isTipOpen = expandedTipId === tip.id;

                                  return (
                                    <div key={tip.id}>
                                      <button
                                        type="button"
                                        onClick={() => toggleTip(tip.id)}
                                        className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-white/5 rounded-md transition-colors"
                                      >
                                        <ChevronRight
                                          className={`h-3 w-3 text-white/30 shrink-0 transition-transform duration-200 ${
                                            isTipOpen ? "rotate-90" : ""
                                          }`}
                                        />
                                        <p className="text-xs font-medium text-white/60">{tip.title}</p>
                                      </button>

                                      <AnimatePresence>
                                        {isTipOpen && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="overflow-hidden"
                                          >
                                            <p className="px-7 pb-3 text-xs text-white/70 leading-relaxed">
                                              {tip.rosa}
                                            </p>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
