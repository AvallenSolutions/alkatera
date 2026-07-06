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

interface GreenwashGuardianProps {
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const LandingGreenwashGuardian = ({ isModal = false, isOpen = false, onClose }: GreenwashGuardianProps) => {
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
      // Step 1: Start the scan (fetches page, creates DB row, returns scanId)
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

      const { scanId } = startData;
      if (!scanId) {
        throw new Error('Failed to start analysis');
      }

      // Step 2: Trigger the Supabase Edge Function from the browser
      // (fire-and-forget, same pattern as authenticated Greenwash Guardian)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        fetch(`${supabaseUrl}/functions/v1/analyze-public-greenwash`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ scan_id: scanId }),
        }).catch(err => console.error('Failed to trigger analysis:', err));
      }

      // Step 3: Poll for results every 3 seconds (up to 2 minutes)
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pollResponse = await fetch(`/api/greenwash/public?scanId=${scanId}`);
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

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!result || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch('/api/greenwash/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });

      if (!response.ok) throw new Error('PDF generation failed');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const hostname = (() => {
        try { return new URL(result.url).hostname; }
        catch { return 'website'; }
      })();
      a.download = `greenwash-assessment-${hostname}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const innerContent = (
    <div id="greenwash-guardian" className="relative py-24 md:py-32 px-6 md:px-20 bg-background text-foreground overflow-hidden w-full">
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6">
            <Shield className="h-4 w-4 text-[#205E40]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#205E40]">Free Tool</span>
          </div>
          <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl mb-4 leading-[0.95]">
            Greenwash Guardian.
          </h2>
          <p className="font-sans text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
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
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScanClick()}
                    placeholder="Enter your website URL..."
                    disabled={viewState !== 'idle'}
                    className="w-full bg-card border border-border rounded-full pl-12 pr-4 py-4 text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition-colors duration-200 ease-studio disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleScanClick}
                  disabled={!url.trim() || viewState !== 'idle'}
                  className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Scan
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground font-mono text-center">
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
                className="absolute inset-0 bg-[#1A1B1D]/50"
                onClick={() => setViewState('idle')}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border rounded-[6px] p-8 max-w-md w-full shadow-[0_20px_60px_rgba(26,27,29,0.2)]"
              >
                <button
                  onClick={() => setViewState('idle')}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-studio"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-6 w-6 text-[#205E40]" />
                  </div>
                  <h3 className="font-display font-bold tracking-[-0.02em] text-2xl text-foreground mb-2">
                    Unlock your free report.
                  </h3>
                  <p className="text-sm text-muted-foreground font-sans">
                    Enter your email to receive your greenwash risk assessment for{' '}
                    <span className="text-[#205E40]">{url}</span>
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
                      className="w-full bg-background border border-border rounded-[6px] px-4 py-3 text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition-colors duration-200 ease-studio"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name"
                      className="bg-background border border-border rounded-[6px] px-4 py-3 text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition-colors duration-200 ease-studio"
                    />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Company"
                      className="bg-background border border-border rounded-[6px] px-4 py-3 text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition-colors duration-200 ease-studio"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio flex items-center justify-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Scan My Website
                  </button>
                  <p className="text-[10px] text-muted-foreground text-center font-mono">
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
                <div className="w-20 h-20 rounded-full border-2 border-border flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-[#205E40]" />
                </div>
              </div>
              <h3 className="font-display font-bold tracking-[-0.02em] text-2xl text-foreground mb-3">Scanning {url}</h3>
              <p className="text-sm text-muted-foreground font-sans mb-6">
                We're analysing your website content against UK and EU anti-greenwashing legislation.
              </p>
              <div className="w-64 h-1 bg-secondary rounded-full mx-auto overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 25, ease: 'easeOut' }}
                  className="h-full bg-[#205E40] rounded-full"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-3">
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
              <div className="w-16 h-16 bg-[#BE123C]/10 border border-[#BE123C]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-8 w-8 text-[#BE123C]" />
              </div>
              <h3 className="font-display font-bold tracking-[-0.02em] text-2xl text-foreground mb-3">Scan failed.</h3>
              <p className="text-sm text-muted-foreground font-sans mb-6 max-w-md mx-auto">{error}</p>
              {error.includes('already used') ? (
                <Link
                  href="/getaccess"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio"
                >
                  Get Unlimited Scans <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={resetScan}
                  className="bg-card border border-border text-foreground px-8 py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:bg-secondary transition-colors duration-200 ease-studio"
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
                  className="text-sm text-muted-foreground hover:text-foreground font-mono transition-colors duration-200 ease-studio"
                >
                  ← Scan another URL
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-secondary transition-colors duration-200 ease-studio disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {isExporting ? 'Generating...' : 'Download PDF'}
                </button>
              </div>

              {/* Overview Card */}
              <div className="bg-card border border-border rounded-[6px] p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-display font-bold tracking-[-0.02em] text-2xl text-foreground flex items-center gap-3 mb-1">
                      <Shield className="h-6 w-6 text-[#205E40]" />
                      Risk Assessment
                    </h3>
                    <p className="text-sm text-muted-foreground font-mono">{result.url}</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                  <div className={`flex items-center gap-3 px-6 py-4 rounded-[6px] shrink-0 ${
                    result.overall_risk_level === 'high' ? 'bg-[#BE123C]/10 border border-[#BE123C]/25' :
                    result.overall_risk_level === 'medium' ? 'bg-[#B45309]/10 border border-[#B45309]/25' :
                    'bg-[#047857]/10 border border-[#047857]/25'
                  }`}>
                    {result.overall_risk_level === 'high' ? (
                      <AlertTriangle className="h-8 w-8 text-[#BE123C]" />
                    ) : result.overall_risk_level === 'medium' ? (
                      <AlertCircle className="h-8 w-8 text-[#B45309]" />
                    ) : (
                      <CheckCircle2 className="h-8 w-8 text-[#047857]" />
                    )}
                    <div>
                      <p className={`text-2xl font-mono font-bold ${
                        result.overall_risk_level === 'high' ? 'text-[#BE123C]' :
                        result.overall_risk_level === 'medium' ? 'text-[#B45309]' :
                        'text-[#047857]'
                      }`}>
                        {result.overall_risk_level.toUpperCase()} RISK
                      </p>
                      <p className="text-muted-foreground text-sm font-mono">
                        Score: {result.overall_risk_score}/100
                      </p>
                    </div>
                  </div>
                  <p className="text-foreground/80 leading-relaxed">{result.summary}</p>
                </div>

                {/* Legislation Applied */}
                {result.legislation_applied && result.legislation_applied.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.legislation_applied.map((leg, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs font-mono text-muted-foreground"
                      >
                        {getJurisdictionLabel(leg.jurisdiction)} {leg.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Claims */}
              {result.claims && result.claims.length > 0 && (
                <div className="bg-card border border-border rounded-[6px] p-6 md:p-8">
                  <h4 className="font-display font-bold tracking-[-0.02em] text-xl text-foreground mb-1 flex items-center gap-2">
                    Identified Claims ({result.claims.length})
                  </h4>
                  <p className="text-sm text-muted-foreground font-sans mb-6">
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
                <div className="bg-[#047857]/10 border border-[#047857]/25 rounded-[6px] p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-[#047857] mx-auto mb-4" />
                  <h3 className="font-display font-bold tracking-[-0.02em] text-xl text-foreground mb-2">No issues found.</h3>
                  <p className="text-sm text-muted-foreground font-sans">
                    We did not identify any significant greenwashing risks in your content.
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="bg-card border border-border rounded-[6px] p-6 md:p-8">
                  <h4 className="font-display font-bold tracking-[-0.02em] text-xl text-foreground mb-6 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-[#A97C14]" />
                    Recommendations
                  </h4>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-foreground/80">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-[#205E40]/10 text-[#205E40] flex items-center justify-center text-sm font-mono font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-sm leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-[#B45309]/10 border border-[#B45309]/20 rounded-[6px] p-4 text-center">
                <p className="text-xs text-foreground/70 font-mono">
                  <strong>Disclaimer:</strong> This report provides guidance only and is not legal advice.
                  Consult qualified legal counsel for compliance decisions.
                </p>
              </div>

              {/* CTA */}
              <div className="text-center pt-8 pb-4">
                <p className="text-muted-foreground font-sans text-sm mb-4">
                  Want unlimited scans, document analysis, and full compliance tracking?
                </p>
                <Link
                  href="/getaccess"
                  className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-10 py-5 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio"
                >
                  Get Started with alkatera <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          >
            <div
              className="absolute inset-0 bg-[#1A1B1D]/60"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative w-full max-w-5xl mx-auto my-8 rounded-[6px] overflow-hidden border border-border shadow-[0_20px_60px_rgba(26,27,29,0.25)]"
            >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 z-10 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-studio"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
              {innerContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return <section className="border-t border-b border-border">{innerContent}</section>;
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
    <div className={`rounded-[6px] border transition-colors duration-200 ease-studio ${
      claim.risk_level === 'high' ? 'bg-[#BE123C]/[0.06] border-[#BE123C]/25' :
      claim.risk_level === 'medium' ? 'bg-[#B45309]/[0.06] border-[#B45309]/25' :
      'bg-[#047857]/[0.06] border-[#047857]/25'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-[#1A1B1D]/[0.03] transition-colors duration-200 ease-studio rounded-[6px]"
      >
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          claim.risk_level === 'high' ? 'bg-[#BE123C]/15' :
          claim.risk_level === 'medium' ? 'bg-[#B45309]/15' :
          'bg-[#047857]/15'
        }`}>
          {claim.risk_level === 'high' ? (
            <AlertTriangle className="h-4 w-4 text-[#BE123C]" />
          ) : claim.risk_level === 'medium' ? (
            <AlertCircle className="h-4 w-4 text-[#B45309]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[#047857]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground text-sm font-medium">&quot;{claim.claim_text}&quot;</p>
          <p className="text-muted-foreground text-xs mt-1 line-clamp-1">{claim.issue_description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono font-bold uppercase ${
            claim.risk_level === 'high' ? 'text-[#BE123C]' :
            claim.risk_level === 'medium' ? 'text-[#B45309]' :
            'text-[#047857]'
          }`}>
            {claim.risk_level}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 ml-11">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h5 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.22em] mb-1">Issue Type</h5>
                  <p className="text-sm text-foreground">{claim.issue_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                </div>
                <div>
                  <h5 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.22em] mb-1">Risk Score</h5>
                  <p className="text-sm text-foreground">{claim.risk_score}/100</p>
                </div>
              </div>

              <div>
                <h5 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.22em] mb-1">Issue Description</h5>
                <p className="text-sm text-foreground/80 leading-relaxed">{claim.issue_description}</p>
              </div>

              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">
                  {getJurisdictionLabel(claim.legislation_jurisdiction)} {claim.legislation_name}
                  {claim.legislation_article && ` (${claim.legislation_article})`}
                </span>
              </div>

              <div className="bg-[#047857]/[0.07] border border-[#047857]/20 rounded-[6px] p-4">
                <h5 className="text-[10px] font-mono font-bold text-[#047857] uppercase tracking-[0.22em] mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Suggestion
                </h5>
                <p className="text-sm text-foreground/80 leading-relaxed">{claim.suggestion}</p>
                {claim.suggested_revision && (
                  <div className="mt-3 p-3 bg-background rounded-[6px]">
                    <h6 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.22em] mb-1">Suggested Revision</h6>
                    <p className="text-sm text-foreground italic">&quot;{claim.suggested_revision}&quot;</p>
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
