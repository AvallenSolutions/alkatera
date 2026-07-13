'use client';

import { useState } from 'react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { LandingHero } from '@/marketing/components/landing/Hero';
import { LandingManifesto } from '@/marketing/components/landing/Manifesto';
import { LandingFeatures } from '@/marketing/components/landing/Features';
import { LandingTrustedBy } from '@/marketing/components/landing/TrustedBy';
import { PricingTeaser } from '@/marketing/components/landing/PricingTeaser';
import { LandingCTA } from '@/marketing/components/landing/CTA';
import { LandingGreenwashGuardian } from '@/marketing/components/landing/GreenwashGuardian';
import { LandingPainPoints } from '@/marketing/components/landing/PainPoints';

export function HomePageClient() {
  const [isGuardianOpen, setIsGuardianOpen] = useState(false);

  return (
    <div className="bg-[#050505] min-h-screen w-full text-white selection:bg-[#ccff00] selection:text-black overflow-x-hidden">
      <Navigation />
      <LandingHero onOpenGuardian={() => setIsGuardianOpen(true)} />
      <LandingManifesto />
      <LandingPainPoints />
      <LandingFeatures />
      <LandingGreenwashGuardian isModal={true} isOpen={isGuardianOpen} onClose={() => setIsGuardianOpen(false)} />
      <LandingTrustedBy />
      <PricingTeaser />
      <LandingCTA />
      <Footer />
    </div>
  );
}
