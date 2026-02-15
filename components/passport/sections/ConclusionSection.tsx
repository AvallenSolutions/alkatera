"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, ArrowRight, ShieldCheck } from 'lucide-react';
import { AlkaTeraLogoHorizontal, AlkaTeraWordmark } from '@/components/lca-report/Logo';
import type { LCADataConclusion, LCADataMeta, TierVisibility } from '@/lib/types/passport';

interface ConclusionSectionProps {
  data: LCADataConclusion;
  meta: LCADataMeta;
  visibility: TierVisibility;
  onDownloadPDF?: () => void;
  onShare?: () => void;
}

export default function ConclusionSection({
  data,
  meta,
  visibility,
  onDownloadPDF,
  onShare,
}: ConclusionSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (onShare) {
      onShare();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${meta.productName} - Product Passport`,
          text: `View the environmental impact data for ${meta.productName}`,
          url: window.location.href,
        });
      } catch {
        navigator.clipboard?.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const metadataItems: string[] = [];
  if (meta.referenceYear) {
    metadataItems.push(`Based on ${meta.referenceYear} data`);
  }
  if (meta.systemBoundary) {
    metadataItems.push(`${meta.systemBoundary} Assessment`);
  }

  return (
    <section className="py-24 px-6 md:px-12 max-w-4xl mx-auto text-center bg-stone-50">
      <div className="inline-flex items-center gap-2 bg-brand-accent/10 border border-brand-accent/30 rounded-full px-4 py-2 mb-8">
        <ShieldCheck className="w-5 h-5 text-lime-700" />
        <span className="font-mono text-xs text-lime-800 uppercase tracking-widest flex items-center gap-1.5">
          Verified by <AlkaTeraWordmark className="text-xs text-lime-800 inline-flex" />
        </span>
      </div>

      <h2 className="font-serif text-4xl md:text-5xl mb-8 text-stone-900">
        {data.title}
      </h2>
      <p className="text-stone-600 leading-relaxed text-lg max-w-2xl mx-auto mb-6">
        {data.content}
      </p>

      {metadataItems.length > 0 && (
        <p className="font-mono text-xs text-stone-400 uppercase tracking-wider mb-12">
          {metadataItems.join(' \u00B7 ')}
        </p>
      )}

      {meta.organizationLogo && (
        <div className="mb-12">
          <Image
            src={meta.organizationLogo}
            alt={meta.organizationName}
            width={120}
            height={40}
            className="object-contain mx-auto opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      )}

      {visibility.showMethodologyLink && meta.methodologyPageUrl && (
        <div className="mb-12 p-6 bg-white rounded-xl border border-stone-200 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BookOpen className="w-5 h-5 text-lime-600" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">
              Technical Documentation
            </h3>
          </div>
          <p className="text-sm text-stone-600 mb-4">
            Learn more about the standards, tools, and methodology used to calculate this LCA.
          </p>
          <Link
            href={meta.methodologyPageUrl}
            className="inline-flex items-center gap-2 text-lime-700 hover:text-lime-800 font-medium transition-colors"
          >
            <span>View Full Methodology</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-center gap-6">
        {visibility.showDownloadPDF && (
          <button
            onClick={onDownloadPDF}
            className="bg-stone-900 text-white px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-brand-accent hover:text-black transition-colors duration-300"
          >
            Download Full PDF
          </button>
        )}
        <button
          onClick={handleShare}
          className={`border px-8 py-4 font-mono text-xs uppercase tracking-widest transition-colors duration-300 ${
            copied
              ? 'bg-brand-accent/10 border-brand-accent text-lime-800'
              : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-50'
          }`}
        >
          {copied ? 'Link Copied!' : 'Share Report'}
        </button>
      </div>

      <div className="mt-24 pt-8 border-t border-stone-200 bg-brand-accent/5 -mx-6 md:-mx-12 px-6 md:px-12 pb-8 rounded-b-xl">
        <div className="flex flex-col md:flex-row justify-between items-center text-xs font-mono text-stone-400">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <AlkaTeraLogoHorizontal
              iconSize="h-4 w-4"
              textSize="text-sm"
              iconClassName="text-lime-800"
              wordmarkClassName="text-lime-800"
            />
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span>ISO 14040/44 Compliant</span>
            <span>Verified Data</span>
          </div>
        </div>
      </div>
    </section>
  );
}
