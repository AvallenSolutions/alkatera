'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scale,
  Lightbulb,
  ArrowRight,
  Search,
  Mail,
  Download,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { generateGreenwashPDF } from '@/lib/pdf/render-greenwash-pdf';

interface ClaimResult {
  claim_text: string;
  claim_context?: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  issue_type: string;
  issue_description: string;
  legislation_name: string;
  legislation_article?: string;
  legislation_jurisdiction: 'uk' | 'eu' | 'both';
  suggestion: string;
  suggested_revision?: string;
}

interface AnalysisResult {
  success: boolean;
  url: string;
  overall_risk_level: 'low' | 'medium' | 'high';
  overall_risk_score: number;
  summary: string;
  recommendations: string[];
  legislation_applied: Array<{
    name: string;
    jurisdiction: 'uk' | 'eu' | 'both';
    key_requirement: string;
  }>;
  claims: ClaimResult[];
}

type ViewState = 'idle' | 'email-gate' | 'loading' | 'results' | 'error';

function getJurisdictionLabel(jurisdiction: string): string {
  switch (jurisdiction) {
    case 'uk': return '🇬🇧 UK';
    case 'eu': return '🇪🇺 EU';
    case 'both': return '🇬🇧🇪🇺 UK & EU';
    default: return jurisdiction;
  }
}

export const LandingGreenwashGuardian = () => {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleScanClick = () => {
    if (!url.trim()) return;
    setViewState('email-gate');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setViewState('loading');
    setError('');

    try {
      // Step 1: Start the scan (returns a job ID immediately)
      const startResponse = await fetch('/api/greenwash/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, name, company }),
      });

      const contentType = startResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Service temporarily unavailable. Please try again.');
      }

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        if (startData.rateLimited) {
          setError(startData.error);
          setViewState('error');
          return;
        }
        throw new Error(startData.error || 'Analysis failed');
      }

      const { jobId } = startData;
      if (!jobId) {
        throw new Error('Failed to start analysis');
      }

      // Step 2: Poll for results every 3 seconds (up to 2 minutes)
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pollResponse = await fetch(`/api/greenwash/public?jobId=${jobId}`);
        const pollContentType = pollResponse.headers.get('content-type') || '';

        if (!pollContentType.includes('application/json')) {
          continue; // Transient error, keep polling
        }

        const pollData = await pollResponse.json();

        if (pollResponse.status === 202) {
          continue; // Still processing
        }

        if (!pollResponse.ok) {
          throw new Error(pollData.error || 'Analysis failed');
        }

        // Analysis complete
        setResult(pollData);
        setViewState('results');

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return;
      }

      throw new Error('Analysis is taking longer than expected. Please try again.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setViewState('error');
    }
  };

  const toggleClaim = (index: number) => {
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const resetScan = () => {
    setUrl('');
    setEmail('');
    setName('');
    setCompany('');
    setResult(null);
    setError('');
    setExpandedClaims(new Set());
    setViewState('idle');
  };

  const handleExportPDF = async () => {
    if (!result) return;
    await generateGreenwashPDF(result);
  };

  return (
    <section id="greenwash-guardian" className="relative py-24 md:py-32 px-6 md:px-20 bg-[#050505] text-white border-t border-b border-white/10 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#ccff00]/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">Free Tool</span>
          </div>
          <h2 className="font-serif text-4xl md:text-6xl mb-4">
            Greenwash Guardian
          </h2>
          <p className="font-mono text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Scan your website against UK and EU anti-greenwashing legislation. Get an instant risk
            assessment with actionable recommendations to keep your environmental claims compliant.
          </p>
        </div>

        {/* Input Section */}
        {viewState !== 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-16"
          >
            <div className="relative">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScanClick()}
                    placeholder="Enter your website URL..."
                    disabled={viewState !== 'idle'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-4 text-white placeholder:text-gray-500 font-mono text-sm focus:outline-none focus:border-[#ccff00]/50 focus:ring-1 focus:ring-[#ccff00]/20 transition-all disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleScanClick}
                  disabled={!url.trim() || viewState !== 'idle'}
                  className="bg-[#ccff00] text-black px-8 py-4 rounded-lg font-mono text-sm uppercase tracking-widest hover:bg-[#d4ff33] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Scan
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-500 font-mono text-center">
                e.g. www.avallenspirits.com or yourcompany.com/about
              </p>
            </div>
          </motion.div>
        )}

        {/* Email Gate Modal */}
        <AnimatePresence>
          {viewState === 'email-gate' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
            >
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setViewState('idle')}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl"
              >
                <button
                  onClick={() => setViewState('idle')}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-[#ccff00]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-6 w-6 text-[#ccff00]" />
                  </div>
                  <h3 className="font-serif text-2xl text-white mb-2">
                    Unlock Your Free Report
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">
                    Enter your email to receive your greenwash risk assessment for{' '}
                    <span className="text-[#ccff00]">{url}</span>
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com *"
                      required
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 font-mono text-sm focus:outline-none focus:border-[#ccff00]/50 focus:ring-1 focus:ring-[#ccff00]/20 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 font-mono text-sm focus:outline-none focus:border-[#ccff00]/50 focus:ring-1 focus:ring-[#ccff00]/20 transition-all"
                    />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Company"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 font-mono text-sm focus:outline-none focus:border-[#ccff00]/50 focus:ring-1 focus:ring-[#ccff00]/20 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#ccff00] text-black py-4 rounded-lg font-mono text-sm uppercase tracking-widest hover:bg-[#d4ff33] transition-all flex items-center justify-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Scan My Website
                  </button>
                  <p className="text-[10px] text-gray-500 text-center font-mono">
                    By submitting, you agree to receive occasional emails from alkatera.
                    We never share your data.
                  </p>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {viewState === 'loading' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto text-center py-16"
            >
              <div className="relative inline-block mb-6">
                <div className="w-20 h-20 rounded-full border-2 border-[#ccff00]/20 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-[#ccff00] animate-spin" />
                </div>
              </div>
              <h3 className="font-serif text-2xl text-white mb-3">Scanning {url}</h3>
              <p className="text-sm text-gray-400 font-mono mb-6">
                Our AI is analysing your website content against UK and EU anti-greenwashing legislation...
              </p>
              <div className="w-64 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 25, ease: 'easeOut' }}
                  className="h-full bg-[#ccff00] rounded-full"
                />
              </div>
              <p className="text-xs text-gray-500 font-mono mt-3">
                This usually takes 15 to 30 seconds
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {viewState === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto text-center py-16"
            >
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="font-serif text-2xl text-white mb-3">Scan Failed</h3>
              <p className="text-sm text-gray-400 font-mono mb-6 max-w-md mx-auto">{error}</p>
              {error.includes('already used') ? (
                <Link
                  href="/getaccess"
                  className="inline-flex items-center gap-2 bg-[#ccff00] text-black px-8 py-4 rounded-lg font-mono text-sm uppercase tracking-widest hover:bg-[#d4ff33] transition-all"
                >
                  Get Unlimited Scans <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={resetScan}
                  className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-lg font-mono text-sm uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Try Again
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {viewState === 'results' && result && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Scan another + Download */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={resetScan}
                  className="text-sm text-gray-400 hover:text-white font-mono transition-colors"
                >
                  ← Scan another URL
                </button>
                <button
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>

              {/* Overview Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-serif text-2xl text-white flex items-center gap-3 mb-1">
                      <Shield className="h-6 w-6 text-emerald-400" />
                      Risk Assessment
                    </h3>
                    <p className="text-sm text-gray-400 font-mono">{result.url}</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                  <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shrink-0 ${
                    result.overall_risk_level === 'high' ? 'bg-red-500/20 border border-red-500/30' :
                    result.overall_risk_level === 'medium' ? 'bg-amber-500/20 border border-amber-500/30' :
                    'bg-green-500/20 border border-green-500/30'
                  }`}>
                    {result.overall_risk_level === 'high' ? (
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    ) : result.overall_risk_level === 'medium' ? (
                      <AlertCircle className="h-8 w-8 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    )}
                    <div>
                      <p className={`text-2xl font-bold ${
                        result.overall_risk_level === 'high' ? 'text-red-400' :
                        result.overall_risk_level === 'medium' ? 'text-amber-400' :
                        'text-green-400'
                      }`}>
                        {result.overall_risk_level.toUpperCase()} RISK
                      </p>
                      <p className="text-gray-400 text-sm font-mono">
                        Score: {result.overall_risk_score}/100
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{result.summary}</p>
                </div>

                {/* Legislation Applied */}
                {result.legislation_applied && result.legislation_applied.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.legislation_applied.map((leg, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs font-mono text-gray-300"
                      >
                        {getJurisdictionLabel(leg.jurisdiction)} {leg.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Claims */}
              {result.claims && result.claims.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                  <h4 className="font-serif text-xl text-white mb-1 flex items-center gap-2">
                    Identified Claims ({result.claims.length})
                  </h4>
                  <p className="text-sm text-gray-400 font-mono mb-6">
                    Environmental claims found in your content with risk assessments
                  </p>
                  <div className="space-y-3">
                    {result.claims.map((claim, idx) => (
                      <ClaimCard
                        key={idx}
                        claim={claim}
                        isExpanded={expandedClaims.has(idx)}
                        onToggle={() => toggleClaim(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No Claims */}
              {(!result.claims || result.claims.length === 0) && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h3 className="font-serif text-xl text-white mb-2">No Issues Found</h3>
                  <p className="text-sm text-gray-400 font-mono">
                    We did not identify any significant greenwashing risks in your content.
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                  <h4 className="font-serif text-xl text-white mb-6 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                    Recommendations
                  </h4>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-300">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-mono font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-sm leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-amber-200/80 font-mono">
                  <strong>Disclaimer:</strong> This report provides guidance only and is not legal advice.
                  Consult qualified legal counsel for compliance decisions.
                </p>
              </div>

              {/* CTA */}
              <div className="text-center pt-8 pb-4">
                <p className="text-gray-400 font-mono text-sm mb-4">
                  Want unlimited scans, document analysis, and full compliance tracking?
                </p>
                <Link
                  href="/getaccess"
                  className="inline-flex items-center gap-3 bg-[#ccff00] text-black px-10 py-5 rounded-full font-mono text-sm uppercase tracking-widest hover:scale-105 transition-transform duration-300"
                >
                  Get Started with alkatera <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

function ClaimCard({
  claim,
  isExpanded,
  onToggle,
}: {
  claim: ClaimResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      claim.risk_level === 'high' ? 'bg-red-500/10 border-red-500/20' :
      claim.risk_level === 'medium' ? 'bg-amber-500/10 border-amber-500/20' :
      'bg-green-500/10 border-green-500/20'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors rounded-xl"
      >
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          claim.risk_level === 'high' ? 'bg-red-500/20' :
          claim.risk_level === 'medium' ? 'bg-amber-500/20' :
          'bg-green-500/20'
        }`}>
          {claim.risk_level === 'high' ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : claim.risk_level === 'medium' ? (
            <AlertCircle className="h-4 w-4 text-amber-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">&quot;{claim.claim_text}&quot;</p>
          <p className="text-gray-400 text-xs mt-1 line-clamp-1">{claim.issue_description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono font-bold uppercase ${
            claim.risk_level === 'high' ? 'text-red-400' :
            claim.risk_level === 'medium' ? 'text-amber-400' :
            'text-green-400'
          }`}>
            {claim.risk_level}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 ml-11">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h5 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Issue Type</h5>
                  <p className="text-sm text-white">{claim.issue_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                </div>
                <div>
                  <h5 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Risk Score</h5>
                  <p className="text-sm text-white">{claim.risk_score}/100</p>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Issue Description</h5>
                <p className="text-sm text-gray-300 leading-relaxed">{claim.issue_description}</p>
              </div>

              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs text-gray-400 font-mono">
                  {getJurisdictionLabel(claim.legislation_jurisdiction)} {claim.legislation_name}
                  {claim.legislation_article && ` (${claim.legislation_article})`}
                </span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <h5 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Suggestion
                </h5>
                <p className="text-sm text-gray-300 leading-relaxed">{claim.suggestion}</p>
                {claim.suggested_revision && (
                  <div className="mt-3 p-3 bg-white/5 rounded-lg">
                    <h6 className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Suggested Revision</h6>
                    <p className="text-sm text-white italic">&quot;{claim.suggested_revision}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
