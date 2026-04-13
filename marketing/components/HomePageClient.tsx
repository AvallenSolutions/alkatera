'use client';

import { useState } from 'react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { ContactModal } from '@/marketing/components/ContactModal';
import { LandingHero } from '@/marketing/components/landing/Hero';
import { LandingMarquee } from '@/marketing/components/landing/Marquee';
import { LandingManifesto } from '@/marketing/components/landing/Manifesto';
import { LandingFeatures } from '@/marketing/components/landing/Features';
import { LandingShowcase } from '@/marketing/components/landing/Showcase';
import { LandingTrustedBy } from '@/marketing/components/landing/TrustedBy';
import { LandingPricing } from '@/marketing/components/landing/Pricing';
import { LandingCTA } from '@/marketing/components/landing/CTA';
import { LandingGreenwashGuardian } from '@/marketing/components/landing/GreenwashGuardian';
import { LandingPainPoints } from '@/marketing/components/landing/PainPoints';

export function HomePageClient() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isGuardianOpen, setIsGuardianOpen] = useState(false);

  return (
    <div className="bg-[#050505] min-h-screen w-full text-white selection:bg-[#ccff00] selection:text-black overflow-x-hidden">
      <Navigation onOpenContact={() => setIsContactOpen(true)} />
      <LandingHero onOpenGuardian={() => setIsGuardianOpen(true)} />
      <LandingMarquee />
      <LandingManifesto />
      <LandingPainPoints />
      <LandingFeatures />
      <LandingGreenwashGuardian isModal={true} isOpen={isGuardianOpen} onClose={() => setIsGuardianOpen(false)} />
      <LandingShowcase />
      <LandingTrustedBy />
      <LandingPricing onOpenContact={() => setIsContactOpen(true)} />
      <LandingCTA onOpenContact={() => setIsContactOpen(true)} onOpenGuardian={() => setIsGuardianOpen(true)} />
      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
